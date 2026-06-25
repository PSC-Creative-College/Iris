import { json, requireTeacher } from "../../_shared/auth.js";
import { ensureLtiTables } from "../../_shared/lti.js";

const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 25;
const MAX_EXPORT_LIMIT = 2000;

export async function onRequestGet({ request, env }) {
  const { teacher, response } = await requireTeacher(request, env);
  if (response) return response;
  if (!env.DB) return json({ error: "D1 binding DB is missing." }, 500);

  await ensureLtiTables(env);

  const url = new URL(request.url);
  const exportCsv = url.searchParams.get("format") === "csv";
  const scope = resolveScope(url, teacher);
  if (scope.error) return json({ error: scope.error }, scope.status || 403);

  const filters = buildConversationFilters(url, teacher, scope.value);
  const limit = exportCsv
    ? clampLimit(url.searchParams.get("limit"), MAX_EXPORT_LIMIT, MAX_EXPORT_LIMIT)
    : clampLimit(url.searchParams.get("limit"), MAX_LIMIT, DEFAULT_LIMIT);

  const conversations = await loadConversations(env, filters, limit);
  const messages = conversations.length ? await loadMessages(env, filters, limit) : [];
  const messagesByConversation = groupMessages(messages);
  const enriched = conversations.map((item) => ({
    ...item,
    messageCount: Number(item.messageCount || 0),
    messages: messagesByConversation.get(item.id) || []
  }));

  if (exportCsv) {
    if (!teacher.canViewAllTranscripts) {
      return json({ error: "Only elevated Moodle roles can download transcript archives." }, 403);
    }
    return csvResponse(enriched, filters);
  }

  const courses = teacher.canViewAllTranscripts ? await loadCourses(env) : [];

  return json({
    scope: filters.scope,
    canViewAllTranscripts: Boolean(teacher.canViewAllTranscripts),
    currentCourseId: teacher.moodleCourseId || null,
    currentCourseTitle: teacher.courseTitle || null,
    selectedCourseId: filters.selectedCourseId || null,
    courses,
    conversations: enriched
  });
}

async function loadConversations(env, filters, limit) {
  const rows = await env.DB.prepare(
    `select
      c.id,
      c.agent_key as agentKey,
      c.moodle_user_id as moodleUserId,
      c.moodle_course_id as moodleCourseId,
      c.created_at as createdAt,
      c.updated_at as updatedAt,
      (
        select ls.user_name
        from lti_sessions ls
        where ls.moodle_user_id = c.moodle_user_id
          and (ls.moodle_course_id = c.moodle_course_id or c.moodle_course_id is null)
        order by ls.last_seen_at desc
        limit 1
      ) as studentName,
      (
        select ls.user_email
        from lti_sessions ls
        where ls.moodle_user_id = c.moodle_user_id
          and (ls.moodle_course_id = c.moodle_course_id or c.moodle_course_id is null)
        order by ls.last_seen_at desc
        limit 1
      ) as studentEmail,
      (
        select ls.course_title
        from lti_sessions ls
        where ls.moodle_user_id = c.moodle_user_id
          and (ls.moodle_course_id = c.moodle_course_id or c.moodle_course_id is null)
        order by ls.last_seen_at desc
        limit 1
      ) as courseTitle,
      (
        select ls.resource_link_title
        from lti_sessions ls
        where ls.moodle_user_id = c.moodle_user_id
          and (ls.moodle_course_id = c.moodle_course_id or c.moodle_course_id is null)
        order by ls.last_seen_at desc
        limit 1
      ) as resourceLinkTitle,
      (
        select count(*)
        from messages m
        where m.conversation_id = c.id
      ) as messageCount,
      (
        select m.content
        from messages m
        where m.conversation_id = c.id and m.role = 'user'
        order by m.created_at desc
        limit 1
      ) as lastQuestion
    from conversations c
    ${filters.whereSql}
    order by c.updated_at desc
    limit ?`
  )
    .bind(...filters.params, limit)
    .all();

  return rows.results || [];
}

async function loadMessages(env, filters, limit) {
  const result = await env.DB.prepare(
    `select
      m.id,
      m.conversation_id as conversationId,
      m.role,
      m.content,
      m.model,
      m.mode,
      m.created_at as createdAt
    from messages m
    join (
      select c.id
      from conversations c
      ${filters.whereSql}
      order by c.updated_at desc
      limit ?
    ) scoped on scoped.id = m.conversation_id
    order by
      m.conversation_id,
      m.created_at asc,
      case m.role when 'user' then 0 when 'assistant' then 1 else 2 end`
  )
    .bind(...filters.params, limit)
    .all();

  return result.results || [];
}

async function loadCourses(env) {
  const result = await env.DB.prepare(
    `select
      c.moodle_course_id as courseId,
      coalesce(
        (
          select ls.course_title
          from lti_sessions ls
          where ls.moodle_course_id = c.moodle_course_id
          order by ls.last_seen_at desc
          limit 1
        ),
        c.moodle_course_id,
        'No Moodle course'
      ) as courseTitle,
      count(*) as conversationCount
    from conversations c
    group by c.moodle_course_id
    order by courseTitle collate nocase`
  ).all();

  return (result.results || []).map((row) => ({
    courseId: row.courseId || "",
    courseTitle: row.courseTitle || "No Moodle course",
    conversationCount: Number(row.conversationCount || 0)
  }));
}

function resolveScope(url, teacher) {
  const requested = String(url.searchParams.get("scope") || "course").trim().toLowerCase();
  if (requested === "all") {
    if (!teacher.canViewAllTranscripts) {
      return {
        error: "Only Convenor or Provider Administrator roles can view all-course transcripts.",
        status: 403
      };
    }
    return { value: "all" };
  }

  if (requested && requested !== "course") {
    return { error: "Unknown transcript scope.", status: 400 };
  }

  return { value: "course" };
}

function buildConversationFilters(url, teacher, scope) {
  const where = [];
  const params = [];
  let selectedCourseId = "";

  if (scope === "all") {
    selectedCourseId = String(url.searchParams.get("courseId") || "").trim();
    if (selectedCourseId) {
      where.push("c.moodle_course_id = ?");
      params.push(selectedCourseId);
    }
  } else if (teacher.moodleCourseId) {
    selectedCourseId = teacher.moodleCourseId;
    where.push("c.moodle_course_id = ?");
    params.push(teacher.moodleCourseId);
  } else if (!teacher.canViewAllTranscripts) {
    where.push("1 = 0");
  }

  return {
    scope,
    selectedCourseId,
    whereSql: where.length ? `where ${where.join(" and ")}` : "",
    params
  };
}

function groupMessages(messages) {
  const grouped = new Map();
  for (const message of messages) {
    if (!grouped.has(message.conversationId)) {
      grouped.set(message.conversationId, []);
    }
    grouped.get(message.conversationId).push(message);
  }
  return grouped;
}

function csvResponse(conversations, filters) {
  const rows = [
    [
      "conversation_id",
      "course_id",
      "course_title",
      "student_name",
      "student_email",
      "agent",
      "tool",
      "conversation_created_at",
      "conversation_updated_at",
      "message_created_at",
      "role",
      "content"
    ]
  ];

  for (const conversation of conversations) {
    const messages = conversation.messages || [];
    if (!messages.length) {
      rows.push(conversationCsvRow(conversation, null));
      continue;
    }

    for (const message of messages) {
      rows.push(conversationCsvRow(conversation, message));
    }
  }

  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\n");
  const filename = filters.selectedCourseId
    ? `iris-transcripts-${safeFilePart(filters.selectedCourseId)}.csv`
    : "iris-transcripts-all-courses.csv";

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store"
    }
  });
}

function conversationCsvRow(conversation, message) {
  return [
    conversation.id,
    conversation.moodleCourseId || "",
    conversation.courseTitle || "",
    conversation.studentName || "",
    conversation.studentEmail || "",
    conversation.agentKey || "",
    conversation.resourceLinkTitle || "",
    conversation.createdAt || "",
    conversation.updatedAt || "",
    message?.createdAt || "",
    message?.role || "",
    message?.content || ""
  ];
}

function csvCell(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function safeFilePart(value) {
  return String(value || "course").replace(/[^a-z0-9_-]+/gi, "-").replace(/^-+|-+$/g, "");
}

function clampLimit(value, max, fallback) {
  const parsed = Number(value || fallback);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(Math.floor(parsed), max);
}
