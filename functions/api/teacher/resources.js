import { json, requireTeacher } from "../../_shared/auth.js";
import { extractReadableText, getUploadFileKind } from "../../_shared/document-text.js";

const AGENT_KEYS = new Set(["assignment", "technical", "critique"]);
const AGENT_ALIASES = {
  brief: "assignment"
};
const DEFAULT_AGENT_KEY = "assignment";
const MAX_UPLOAD_BYTES = 8_000_000;

export async function onRequestGet({ request, env }) {
  const { response } = await requireTeacher(request, env);
  if (response) return response;
  if (!env.DB) return json({ error: "D1 binding DB is missing." }, 500);

  const rows = await env.DB.prepare(
    `select
      r.id,
      r.title,
      r.agent_key as agentKey,
      r.source_type as sourceType,
      r.storage_url as storageUrl,
      r.file_name as fileName,
      r.mime_type as mimeType,
      r.byte_size as byteSize,
      r.processing_status as status,
      r.uploaded_by as uploadedBy,
      r.created_at as createdAt,
      count(c.id) as chunks
    from resources r
    left join resource_chunks c on c.resource_id = r.id
    where r.source_type in ('upload', 'moodle')
    group by r.id
    order by r.created_at desc
    limit 100`
  ).all();

  return json({ resources: rows.results || [] });
}

export async function onRequestPost({ request, env }) {
  const { teacher, response } = await requireTeacher(request, env);
  if (response) return response;
  if (!env.DB) return json({ error: "D1 binding DB is missing." }, 500);

  const form = await request.formData();
  const file = form.get("file");
  const title = String(form.get("title") || "").trim();
  const agentKey = normalizeAgentKey(form.get("agentKey"));

  if (!file || typeof file === "string") {
    return json({ error: "Choose a text file to upload." }, 400);
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return json({ error: "Upload teaching files under 8 MB." }, 400);
  }

  const fileName = file.name || "uploaded-resource.txt";
  const mimeType = file.type || guessMimeType(fileName);
  const fileKind = getUploadFileKind(fileName, mimeType);
  if (fileKind === "unsupported") {
    return json(
      {
        error:
          "Iris accepts .txt, .md, .csv, .json, .docx, and text-based .pdf files."
      },
      400
    );
  }

  let rawText;
  try {
    rawText = await extractReadableText(file, fileName, mimeType);
  } catch (error) {
    return json({ error: error.message || "Iris could not read that file." }, 400);
  }

  const cleanText = normalizeText(rawText);
  if (cleanText.length < 20) {
    return json({ error: "The uploaded file does not contain enough readable text." }, 400);
  }

  const chunks = chunkText(cleanText);
  const now = new Date().toISOString();
  const resourceId = crypto.randomUUID();
  const resourceTitle = title || stripExtension(fileName);

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
      ) values (?, ?, ?, ?, 'upload', ?, 'ready', ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      resourceId,
      null,
      agentKey,
      resourceTitle,
      null,
      teacher.name || teacher.email,
      fileName,
      mimeType,
      file.size,
      cleanText.slice(0, 500),
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

  return json(
    {
      resource: {
        id: resourceId,
        title: resourceTitle,
        agentKey,
        fileName,
        chunks: chunks.length,
        uploadedBy: teacher.email,
        uploadedByName: teacher.name || teacher.email,
        createdAt: now
      }
    },
    201
  );
}

export async function onRequestDelete({ request, env }) {
  const { response } = await requireTeacher(request, env);
  if (response) return response;
  if (!env.DB) return json({ error: "D1 binding DB is missing." }, 500);

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) return json({ error: "Resource id is required." }, 400);

  await env.DB.batch([
    env.DB.prepare("delete from resource_chunks where resource_id = ?").bind(id),
    env.DB.prepare("delete from resources where id = ? and source_type in ('upload', 'moodle')").bind(id)
  ]);

  return json({ deleted: true, id });
}

function normalizeAgentKey(value) {
  const raw = String(value || DEFAULT_AGENT_KEY).trim().toLowerCase();
  const key = AGENT_ALIASES[raw] || raw;
  return AGENT_KEYS.has(key) ? key : DEFAULT_AGENT_KEY;
}

function guessMimeType(fileName) {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".md")) return "text/markdown";
  if (lower.endsWith(".csv")) return "text/csv";
  if (lower.endsWith(".json")) return "application/json";
  if (lower.endsWith(".docx")) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  if (lower.endsWith(".doc")) return "application/msword";
  if (lower.endsWith(".pdf")) return "application/pdf";
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

function stripExtension(fileName) {
  return fileName.replace(/\.[^.]+$/, "");
}
