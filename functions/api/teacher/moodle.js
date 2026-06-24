import { extractReadableText, getUploadFileKind } from "../../_shared/document-text.js";
import { json, requireTeacher } from "../../_shared/auth.js";

const AGENT_KEYS = new Set(["assignment", "technical", "critique", "client"]);
const DEFAULT_AGENT_KEY = "assignment";
const MAX_MOODLE_FILE_BYTES = 8_000_000;

export async function onRequestGet({ request, env }) {
  const { teacher, response } = await requireTeacher(request, env);
  if (response) return response;
  if (!env.DB) return json({ error: "D1 binding DB is missing." }, 500);

  try {
    const target = getMoodleScanTarget(env, teacher);
    const scan = await scanMoodleCourse(env, target.courseId);
    const imported = await importedSourceUrls(env, scan.courseId);
    return json({
      ok: true,
      courseId: scan.courseId,
      courseName: target.courseTitle || scan.courseName,
      courseSource: target.source,
      launchedCourseId: teacher.moodleCourseId || null,
      launchedCourseTitle: teacher.courseTitle || null,
      baseUrl: scan.baseUrl,
      items: scan.items.map((item) => ({
        ...publicItem(item),
        imported: imported.has(item.sourceUrl)
      }))
    });
  } catch (error) {
    return json({ error: error.message || "Moodle scan failed." }, 400);
  }
}

export async function onRequestPost({ request, env }) {
  const { teacher, response } = await requireTeacher(request, env);
  if (response) return response;
  if (!env.DB) return json({ error: "D1 binding DB is missing." }, 500);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Import request must be JSON." }, 400);
  }

  const ids = Array.isArray(body?.itemIds)
    ? body.itemIds.map((id) => String(id)).filter(Boolean)
    : [];
  if (!ids.length) return json({ error: "Choose at least one Moodle item to import." }, 400);

  const agentKey = normalizeAgentKey(body?.agentKey);

  try {
    const target = getMoodleScanTarget(env, teacher);
    const scan = await scanMoodleCourse(env, target.courseId);
    const selected = scan.items.filter((item) => ids.includes(item.id));
    if (!selected.length) return json({ error: "No matching Moodle items were found." }, 400);

    const existing = await importedSourceUrls(env, scan.courseId);
    const imported = [];
    const skipped = [];

    for (const item of selected) {
      if (existing.has(item.sourceUrl)) {
        skipped.push({ id: item.id, title: item.title, reason: "Already imported" });
        continue;
      }

      const extracted = await getMoodleItemText(env, item);
      const cleanText = normalizeText(extracted.text);
      if (cleanText.length < 20) {
        skipped.push({ id: item.id, title: item.title, reason: "No readable text" });
        continue;
      }

      const resource = await storeMoodleResource(env, {
        courseId: scan.courseId,
        agentKey,
        teacherEmail: teacher.name || teacher.email,
        item,
        text: cleanText,
        fileName: extracted.fileName,
        mimeType: extracted.mimeType,
        byteSize: extracted.byteSize
      });

      existing.add(item.sourceUrl);
      imported.push(resource);
    }

    return json({ imported, skipped });
  } catch (error) {
    return json({ error: error.message || "Moodle import failed." }, 400);
  }
}

function getMoodleScanTarget(env, teacher) {
  const launchedCourseId = String(teacher?.moodleCourseId || "").trim();
  if (teacher?.mode === "moodle-lti" && launchedCourseId) {
    return {
      courseId: launchedCourseId,
      courseTitle: teacher.courseTitle || "",
      source: "moodle-lti"
    };
  }

  return {
    courseId: String(env.MOODLE_COURSE_ID || "").trim(),
    courseTitle: "",
    source: "environment"
  };
}

async function scanMoodleCourse(env, requestedCourseId) {
  const baseUrl = cleanBaseUrl(env.MOODLE_BASE_URL);
  const courseId = String(requestedCourseId || "").trim();
  if (!baseUrl) throw new Error("MOODLE_BASE_URL is not configured.");
  if (!courseId) {
    throw new Error(
      "No Moodle course id is available. Launch Teacher Studio from a Moodle course, or set MOODLE_COURSE_ID as a fallback."
    );
  }
  if (!env.MOODLE_API_TOKEN) throw new Error("MOODLE_API_TOKEN is not configured.");

  await callMoodle(env, "core_webservice_get_site_info", {});
  const sections = await callMoodle(env, "core_course_get_contents", { courseid: courseId });

  if (!Array.isArray(sections)) {
    throw new Error("Moodle returned an unexpected course contents response.");
  }

  const items = [];
  for (const section of sections) {
    const sectionName = cleanHtml(section?.name || `Section ${section?.id || ""}`);
    const sectionText = cleanHtml(section?.summary || "");
    if (sectionText.length >= 20) {
      items.push({
        id: stableId(["section", section?.id || sectionName]),
        kind: "section",
        title: sectionName || "Course section",
        sourceUrl: `moodle://${courseId}/section/${section?.id || encodeURIComponent(sectionName)}`,
        sectionName,
        text: sectionText
      });
    }

    for (const module of section?.modules || []) {
      const moduleName = cleanHtml(module?.name || "Moodle activity");
      const moduleType = String(module?.modname || "activity");
      const moduleUrl = sanitizeUrl(module?.url || "");
      const description = cleanHtml(module?.description || module?.intro || "");

      if (description.length >= 20) {
        items.push({
          id: stableId(["module", module?.id, "description"]),
          kind: "activity",
          title: `${moduleName} description`,
          sourceUrl: moduleUrl || `moodle://${courseId}/module/${module?.id}`,
          sectionName,
          moduleName,
          moduleType,
          text: description
        });
      }

      for (const content of module?.contents || []) {
        const fileName = String(content?.filename || "").trim();
        const fileUrl = String(content?.fileurl || "").trim();
        const mimeType = String(content?.mimetype || guessMimeType(fileName)).trim();
        const byteSize = Number(content?.filesize || 0);

        if (!fileName || !fileUrl) continue;
        if (byteSize > MAX_MOODLE_FILE_BYTES) continue;
        if (getUploadFileKind(fileName, mimeType) === "unsupported") continue;

        items.push({
          id: stableId(["file", module?.id, fileName, fileUrl]),
          kind: "file",
          title: fileName,
          sourceUrl: sanitizeUrl(fileUrl),
          fileUrl,
          fileName,
          mimeType,
          byteSize,
          sectionName,
          moduleName,
          moduleType
        });
      }

      if (moduleType === "url" && moduleUrl) {
        const linkText = [moduleName, description, moduleUrl].filter(Boolean).join("\n\n");
        if (linkText.length >= 20) {
          items.push({
            id: stableId(["link", module?.id, moduleUrl]),
            kind: "link",
            title: moduleName,
            sourceUrl: moduleUrl,
            sectionName,
            moduleName,
            moduleType,
            text: linkText
          });
        }
      }
    }
  }

  return {
    baseUrl,
    courseId,
    courseName: findCourseName(sections) || `Moodle course ${courseId}`,
    items: dedupeItems(items).slice(0, 120)
  };
}

async function callMoodle(env, wsfunction, params) {
  const baseUrl = cleanBaseUrl(env.MOODLE_BASE_URL);
  const body = new URLSearchParams({
    wstoken: env.MOODLE_API_TOKEN,
    wsfunction,
    moodlewsrestformat: "json",
    ...Object.fromEntries(
      Object.entries(params).map(([key, value]) => [key, String(value)])
    )
  });

  const response = await fetch(`${baseUrl}/webservice/rest/server.php`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(`Moodle request failed with status ${response.status}.`);
  }
  if (data?.exception || data?.errorcode) {
    throw new Error(data.message || data.errorcode || "Moodle rejected the request.");
  }
  return data;
}

async function getMoodleItemText(env, item) {
  if (item.text) {
    return {
      text: item.text,
      fileName: null,
      mimeType: "text/plain",
      byteSize: new TextEncoder().encode(item.text).length
    };
  }

  if (item.kind !== "file") throw new Error(`"${item.title}" is not importable yet.`);

  const fileUrl = moodleFileUrlWithToken(item.fileUrl, env.MOODLE_API_TOKEN);
  const response = await fetch(fileUrl);
  if (!response.ok) {
    throw new Error(`Could not download "${item.title}" from Moodle.`);
  }

  const buffer = await response.arrayBuffer();
  if (buffer.byteLength > MAX_MOODLE_FILE_BYTES) {
    throw new Error(`"${item.title}" is larger than 8 MB.`);
  }

  const mimeType = item.mimeType || response.headers.get("Content-Type") || guessMimeType(item.fileName);
  validateDownloadedMoodleFile(buffer, item, mimeType, response.headers.get("Content-Type"));
  const file = new File([buffer], item.fileName || item.title, { type: mimeType });
  const text = await extractReadableText(file, file.name, mimeType);

  return {
    text,
    fileName: file.name,
    mimeType,
    byteSize: buffer.byteLength
  };
}

function validateDownloadedMoodleFile(buffer, item, mimeType, responseContentType) {
  const kind = getUploadFileKind(item.fileName || item.title, mimeType);
  if (kind !== "pdf") return;

  const bytes = new Uint8Array(buffer.slice(0, 160));
  const header = new TextDecoder().decode(bytes);
  if (header.startsWith("%PDF-")) return;

  const trimmed = header.trim();
  if (trimmed.startsWith("{")) {
    try {
      const data = JSON.parse(trimmed);
      if (data?.errorcode === "accessexception" || /access/i.test(data?.error || "")) {
        throw new Error(
          `Moodle blocked file download for "${item.title}". In the Iris Course Sync external service, enable file downloads and confirm the iris-sync user can access this file.`
        );
      }
    } catch (error) {
      if (error.message?.startsWith("Moodle blocked")) throw error;
    }
  }

  const preview = trimmed.replace(/\s+/g, " ").slice(0, 100);
  throw new Error(
    `Moodle returned ${responseContentType || mimeType || "a non-PDF response"} instead of PDF bytes for "${item.title}". ${preview ? `Response starts: ${preview}` : ""}`
  );
}

async function storeMoodleResource(env, data) {
  const chunks = chunkText(data.text);
  const now = new Date().toISOString();
  const resourceId = crypto.randomUUID();

  const statements = [
    env.DB.prepare(
      `insert into resources (
        id,
        course_id,
        agent_key,
        title,
        source_type,
        storage_url,
        processing_status,
        uploaded_by,
        file_name,
        mime_type,
        byte_size,
        summary,
        created_at,
        updated_at
      ) values (?, ?, ?, ?, 'moodle', ?, 'ready', ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      resourceId,
      data.courseId,
      data.agentKey,
      data.item.title,
      data.item.sourceUrl,
      data.teacherEmail,
      data.fileName,
      data.mimeType,
      data.byteSize,
      data.text.slice(0, 500),
      now,
      now
    )
  ];

  chunks.forEach((chunk, index) => {
    statements.push(
      env.DB.prepare(
        "insert into resource_chunks (id, resource_id, chunk_index, content, word_count, created_at) values (?, ?, ?, ?, ?, ?)"
      ).bind(crypto.randomUUID(), resourceId, index, chunk, countWords(chunk), now)
    );
  });

  await env.DB.batch(statements);
  return {
    id: resourceId,
    title: data.item.title,
    agentKey: data.agentKey,
    sourceType: "moodle",
    chunks: chunks.length,
    createdAt: now
  };
}

async function importedSourceUrls(env, courseId) {
  const result = await env.DB.prepare(
    "select storage_url as sourceUrl from resources where source_type = 'moodle' and course_id = ?"
  )
    .bind(courseId)
    .all();

  return new Set((result.results || []).map((row) => row.sourceUrl).filter(Boolean));
}

function publicItem(item) {
  return {
    id: item.id,
    kind: item.kind,
    title: item.title,
    sourceUrl: item.sourceUrl,
    sectionName: item.sectionName,
    moduleName: item.moduleName,
    moduleType: item.moduleType,
    fileName: item.fileName,
    mimeType: item.mimeType,
    byteSize: item.byteSize,
    hasInlineText: Boolean(item.text)
  };
}

function dedupeItems(items) {
  const seen = new Set();
  const deduped = [];

  for (const item of items) {
    const key = item.sourceUrl || item.id;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
  }

  return deduped;
}

function findCourseName(sections) {
  const first = sections.find((section) => cleanHtml(section?.name).length > 0);
  return first ? cleanHtml(first.name) : "";
}

function cleanBaseUrl(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

function cleanHtml(value) {
  return decodeEntities(
    String(value || "")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function decodeEntities(value) {
  return String(value || "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)));
}

function moodleFileUrlWithToken(fileUrl, token) {
  const url = new URL(fileUrl);
  url.searchParams.set("token", token);
  return url.toString();
}

function sanitizeUrl(value) {
  if (!value) return "";

  try {
    const url = new URL(value);
    url.searchParams.delete("token");
    url.searchParams.delete("wstoken");
    return url.toString();
  } catch {
    return String(value);
  }
}

function stableId(parts) {
  const source = parts.map((part) => String(part || "")).join("|");
  let hash = 0;
  for (let index = 0; index < source.length; index += 1) {
    hash = ((hash << 5) - hash + source.charCodeAt(index)) | 0;
  }
  return `moodle-${Math.abs(hash).toString(36)}`;
}

function normalizeAgentKey(value) {
  const key = String(value || DEFAULT_AGENT_KEY).trim().toLowerCase();
  return AGENT_KEYS.has(key) ? key : DEFAULT_AGENT_KEY;
}

function guessMimeType(fileName) {
  const lower = String(fileName || "").toLowerCase();
  if (lower.endsWith(".md")) return "text/markdown";
  if (lower.endsWith(".csv")) return "text/csv";
  if (lower.endsWith(".json")) return "application/json";
  if (lower.endsWith(".docx")) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  if (lower.endsWith(".doc")) return "application/msword";
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".html") || lower.endsWith(".htm")) return "text/html";
  return "text/plain";
}

function normalizeText(value) {
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\t/g, " ")
    .replace(/[ ]{2,}/g, " ")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}

function chunkText(text) {
  const paragraphs = text.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);
  const chunks = [];
  let current = "";

  for (const paragraph of paragraphs.length ? paragraphs : [text]) {
    if ((current + "\n\n" + paragraph).trim().length > 1400 && current) {
      chunks.push(current.trim());
      current = paragraph;
    } else {
      current = `${current}\n\n${paragraph}`.trim();
    }
  }

  if (current) chunks.push(current.trim());
  return chunks.flatMap((chunk) => splitLongChunk(chunk)).slice(0, 80);
}

function splitLongChunk(chunk) {
  if (chunk.length <= 1600) return [chunk];

  const pieces = [];
  for (let start = 0; start < chunk.length; start += 1400) {
    pieces.push(chunk.slice(start, start + 1400).trim());
  }
  return pieces.filter(Boolean);
}

function countWords(text) {
  return text.split(/\s+/).filter(Boolean).length;
}
