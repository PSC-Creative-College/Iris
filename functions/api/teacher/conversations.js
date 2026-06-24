import { json, requireTeacher } from "../../_shared/auth.js";
import { ensureLtiTables } from "../../_shared/lti.js";

const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 25;

export async function onRequestGet({ request, env }) {
  const { response } = requireTeacher(request, env);
  if (response) return response;
  if (!env.DB) return json({ error: "D1 binding DB is missing." }, 500);

  await ensureLtiTables(env);

  const url = new URL(request.url);
  const limit = clampLimit(url.searchParams.get("limit"));

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
    order by c.updated_at desc
    limit ?`
  )
    .bind(limit)
    .all();

  const conversations = rows.results || [];
  const messages = conversations.length
    ? await loadMessages(env, conversations.map((item) => item.id))
    : [];
  const messagesByConversation = groupMessages(messages);

  return json({
    conversations: conversations.map((item) => ({
      ...item,
      messageCount: Number(item.messageCount || 0),
      messages: messagesByConversation.get(item.id) || []
    }))
  });
}

async function loadMessages(env, conversationIds) {
  const placeholders = conversationIds.map(() => "?").join(", ");
  const result = await env.DB.prepare(
    `select
      id,
      conversation_id as conversationId,
      role,
      content,
      model,
      mode,
      created_at as createdAt
    from messages
    where conversation_id in (${placeholders})
    order by
      conversation_id,
      created_at asc,
      case role when 'user' then 0 when 'assistant' then 1 else 2 end`
  )
    .bind(...conversationIds)
    .all();

  return result.results || [];
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

function clampLimit(value) {
  const parsed = Number(value || DEFAULT_LIMIT);
  if (!Number.isFinite(parsed) || parsed < 1) return DEFAULT_LIMIT;
  return Math.min(Math.floor(parsed), MAX_LIMIT);
}
