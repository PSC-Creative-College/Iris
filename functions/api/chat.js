const AGENTS = {
  assignment: {
    name: "Assignment Guide",
    purpose:
      "Help PSC students understand assignments, rubrics, deliverables, constraints, and next steps without completing the work for them.",
    instructions: `
Act as a calm assignment guide, not a shortcut or answer generator.

Use this teaching pattern:
- Identify what the assignment is asking the student to demonstrate.
- Separate requirements into deliverables, constraints, assessment criteria, evidence, and next actions.
- Translate rubric language into practical checkpoints and reflective questions.
- Help the student test whether an idea fits the assignment without deciding the final concept for them.
- Offer planning structures, checklists, question lists, and interpretation help.

Do not write final submissions, artist statements, captions, reflections, research responses, or assessment-ready text for the student. If the uploaded material does not specify a rule, due date, required format, or grading expectation, say that it is not visible in the provided material and suggest checking Moodle or the teacher.
`.trim()
  },
  technical: {
    name: "Technical Tutor",
    purpose:
      "Help PSC students reason through photography, studio, production, software, colour, print, and workflow problems.",
    instructions: `
Act as a practical studio and workflow tutor.

Use this teaching pattern:
- Ask for the student's goal, current setup, file/software/equipment details, and what they have already tried when those details are missing.
- Give diagnostic steps before conclusions.
- Explain why a setting, process, or workflow choice matters.
- Offer safe, realistic studio checks for lighting, exposure, colour, file handling, print preparation, and production planning.
- Give options with trade-offs rather than a single magic answer.

Do not claim to see an image, file, camera setting, screen, print, or artwork unless the student has described it or it appears in the uploaded resource context. For safety-sensitive studio work, encourage teacher or technician support.
`.trim()
  },
  critique: {
    name: "Portfolio Coach",
    purpose:
      "Give formative creative critique through questions, trade-offs, revision paths, intent, audience, and rubric-aware feedback.",
    instructions: `
Act as a formative portfolio and creative critique coach.

Use this teaching pattern:
- Start from the student's intent, audience, context, constraints, and current concern.
- Discuss concept, coherence, sequencing, selection, craft, risk, presentation, and evidence of process.
- Give observations as possibilities to test, not final judgments.
- Use critique questions, revision experiments, comparison prompts, and decision criteria.
- Help the student articulate why a choice strengthens or weakens the work.

Do not make final creative decisions, rank work as objectively good or bad, or rewrite the student's creative rationale into finished assessment text. Keep critique developmental, specific, and anchored to the student's stated intent and any uploaded assignment or rubric context.
`.trim()
  },
  client: {
    name: "Client Simulator",
    purpose:
      "Role-play a client, editor, producer, curator, or creative director so PSC students can practise professional communication.",
    instructions: `
Act as a realistic but educational creative stakeholder.

Use this teaching pattern:
- Ask the student what scenario, client type, project context, and pressure level they want to practise.
- Stay in role during the role-play and ask concise, plausible stakeholder questions.
- Challenge clarity, audience fit, constraints, budget/time assumptions, and decision-making without being hostile.
- When the student asks for feedback or the role-play ends, step out of character and debrief communication strengths, missed opportunities, and next practice moves.

Do not create abusive, discriminatory, humiliating, or unsafe role-play. Keep the simulation useful for learning professional communication.
`.trim()
  }
};

const AGENT_ALIASES = {
  brief: "assignment"
};

const DEFAULT_AGENT_KEY = "assignment";

const SYSTEM_INSTRUCTIONS = `
You are Iris, PSC Creative College's AI studio for creative learning.

You support students with creative thinking, critique, technical reasoning, reflective practice, and assessment clarification.

Core rules:
- Do not complete final assessment work for the student.
- Do not give or predict grades.
- Do not invent PSC policy, due dates, assessment rules, or course requirements.
- Ask clarifying questions when the student's context is missing.
- Give practical next steps that help the student think and revise.
- Encourage the student to check assessment-critical decisions with their teacher.
- Keep creative judgment human: offer options, trade-offs, and critique questions.
- If a question involves wellbeing, safety, legal, medical, or formal complaints, direct the student to human support.
`.trim();

export async function onRequestOptions() {
  return new Response(null, { headers: corsHeaders() });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json();
    const clean = normalizeBody(body);
    const agent = AGENTS[clean.agent] || AGENTS[DEFAULT_AGENT_KEY];
    const resourceContext = await retrieveResourceContext(env, clean.agent, clean.message);

    const provider = resolveProvider(env, clean.agent);
    let reply;
    let mode = "live";

    if (provider.mode === "demo") {
      mode = "demo";
      reply = demoReply(agent, clean.message, resourceContext, provider);
    } else if (provider.provider === "openrouter") {
      reply = await callOpenRouter({
        apiKey: provider.apiKey,
        model: provider.model,
        fallbackModels: provider.fallbackModels,
        agent,
        message: clean.message,
        history: clean.history,
        resourceContext,
        env
      });
    } else {
      reply = await callOpenAI({
        apiKey: provider.apiKey,
        model: provider.model,
        agent,
        message: clean.message,
        history: clean.history,
        resourceContext
      });
    }

    await logConversation(env, {
      conversationId: clean.conversationId,
      agentKey: clean.agent,
      userMessage: clean.message,
      assistantMessage: reply,
      model: provider.model,
      mode
    });

    return json({
      reply,
      mode,
      provider: provider.provider,
      model: provider.model,
      conversationId: clean.conversationId
    });
  } catch (error) {
    return json({ error: error.message || "Unable to process chat request." }, 400);
  }
}

function normalizeBody(body) {
  const message = String(body?.message || "").trim();
  if (!message) {
    throw new Error("Message is required.");
  }

  if (message.length > 6000) {
    throw new Error("Message is too long for this prototype.");
  }

  const agent = normalizeAgentKey(body?.agent);
  const conversationId = isUuid(body?.conversationId)
    ? body.conversationId
    : crypto.randomUUID();

  const history = Array.isArray(body?.history)
    ? body.history
        .slice(-8)
        .map((item) => ({
          role: item?.role === "assistant" ? "assistant" : "user",
          content: String(item?.content || "").slice(0, 3000)
        }))
        .filter((item) => item.content.trim())
    : [];

  return {
    agent,
    conversationId,
    message,
    history
  };
}

function normalizeAgentKey(value) {
  const raw = String(value || DEFAULT_AGENT_KEY).trim().toLowerCase();
  const canonical = AGENT_ALIASES[raw] || raw;
  return AGENTS[canonical] ? canonical : DEFAULT_AGENT_KEY;
}

async function callOpenAI({ apiKey, model, agent, message, history, resourceContext }) {
  const transcript = buildTranscript(history, message, resourceContext);
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      store: false,
      instructions: `${SYSTEM_INSTRUCTIONS}\n\nActive Iris agent: ${agent.name}\nAgent purpose: ${agent.purpose}\n\nAgent instructions:\n${agent.instructions}\n\nUse the teacher-uploaded resource context when it is relevant. If the context does not answer the question, say what is missing instead of inventing course details.`,
      input: transcript
    })
  });

  const data = await response.json();
  if (!response.ok) {
    const messageText =
      data?.error?.message || `OpenAI request failed with status ${response.status}.`;
    throw new Error(messageText);
  }

  return extractOutputText(data);
}

async function callOpenRouter({
  apiKey,
  model,
  fallbackModels,
  agent,
  message,
  history,
  resourceContext,
  env
}) {
  const messages = buildChatMessages(history, message, resourceContext, agent);
  const body = {
    model,
    messages,
    temperature: Number(env.OPENROUTER_TEMPERATURE || "0.4")
  };

  if (fallbackModels.length > 0) {
    body.models = [model, ...fallbackModels];
  }

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": env.OPENROUTER_SITE_URL || "https://iris-7jo.pages.dev",
      "X-Title": env.OPENROUTER_APP_TITLE || "Iris PSC AI Studio"
    },
    body: JSON.stringify(body)
  });

  const data = await response.json();
  if (!response.ok) {
    const messageText =
      data?.error?.message || `OpenRouter request failed with status ${response.status}.`;
    throw new Error(messageText);
  }

  return extractChatCompletionText(data);
}

function buildTranscript(history, message, resourceContext = []) {
  const previous = history
    .slice(-8)
    .map((item) => `${item.role === "assistant" ? "Iris" : "Student"}: ${item.content}`)
    .join("\n\n");

  const contextBlock = resourceContext.length
    ? resourceContext
        .map((item, index) => {
          return `Resource ${index + 1}: ${item.title}\n${item.content}`;
        })
        .join("\n\n")
    : "No teacher-uploaded resource context matched this question.";

  return `
Conversation so far:
${previous || "No previous messages."}

Teacher-uploaded resource context:
${contextBlock}

Latest student message:
${message}
`.trim();
}

function buildChatMessages(history, message, resourceContext, agent) {
  const resourceBlock = formatResourceContext(resourceContext);
  const system = `${SYSTEM_INSTRUCTIONS}

Active Iris agent: ${agent.name}
Agent purpose: ${agent.purpose}

Agent instructions:
${agent.instructions}

Use teacher-uploaded resource context when it is relevant. If the context does not answer the question, say what is missing instead of inventing course details.

Teacher-uploaded resource context:
${resourceBlock}`;

  const previous = history.slice(-8).map((item) => ({
    role: item.role === "assistant" ? "assistant" : "user",
    content: item.content
  }));

  return [
    { role: "system", content: system },
    ...previous,
    { role: "user", content: message }
  ];
}

function formatResourceContext(resourceContext = []) {
  if (!resourceContext.length) {
    return "No teacher-uploaded resource context matched this question.";
  }

  return resourceContext
    .map((item, index) => `Resource ${index + 1}: ${item.title}\n${item.content}`)
    .join("\n\n");
}

function extractOutputText(data) {
  if (typeof data?.output_text === "string" && data.output_text.trim()) {
    return data.output_text.trim();
  }

  const text = [];
  for (const item of data?.output || []) {
    for (const content of item?.content || []) {
      if (typeof content?.text === "string") {
        text.push(content.text);
      }
    }
  }

  const joined = text.join("\n").trim();
  if (!joined) {
    throw new Error("OpenAI returned an empty response.");
  }
  return joined;
}

function extractChatCompletionText(data) {
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content === "string" && content.trim()) {
    return content.trim();
  }

  if (Array.isArray(content)) {
    const joined = content
      .map((part) => part?.text || part?.content || "")
      .filter(Boolean)
      .join("\n")
      .trim();
    if (joined) return joined;
  }

  throw new Error("OpenRouter returned an empty response.");
}

function demoReply(agent, message, resourceContext = [], provider) {
  const contextLines = resourceContext.length
    ? [
        "",
        "Teacher-uploaded material I found:",
        ...resourceContext.slice(0, 3).map((item) => {
          return `- ${item.title}: ${item.content.slice(0, 220)}${item.content.length > 220 ? "..." : ""}`;
        })
      ]
    : [
        "",
        "No teacher-uploaded material matched this question yet. Once teachers upload assignments, rubrics, or notes, Iris will use them here."
      ];

  return [
    `Iris is running in demo mode because no ${provider.expectedSecret} is configured yet.`,
    "",
    `${agent.name}: ${agent.purpose}`,
    ...contextLines,
    "",
    `For your prompt, I would start by separating the question into intent, constraints, evidence, and next action. You wrote: "${message.slice(0, 220)}${message.length > 220 ? "..." : ""}"`,
    "",
    "A useful next move is to add the actual assignment, rubric line, image description, or production constraint so Iris can give more specific formative guidance."
  ].join("\n");
}

function resolveProvider(env, agentKey) {
  const requested = String(env.AI_PROVIDER || "").toLowerCase().trim();
  const wantsOpenRouter = requested === "openrouter" || (!requested && env.OPENROUTER_API_KEY);

  if (wantsOpenRouter) {
    return {
      provider: "openrouter",
      mode: env.OPENROUTER_API_KEY ? "live" : "demo",
      expectedSecret: "OPENROUTER_API_KEY",
      apiKey: env.OPENROUTER_API_KEY,
      model: resolveOpenRouterModel(env, agentKey),
      fallbackModels: splitCsv(env.OPENROUTER_FALLBACK_MODELS)
    };
  }

  return {
    provider: "openai",
    mode: env.OPENAI_API_KEY ? "live" : "demo",
    expectedSecret: "OPENAI_API_KEY",
    apiKey: env.OPENAI_API_KEY,
    model: env.OPENAI_MODEL || "gpt-5.5",
    fallbackModels: []
  };
}

function resolveOpenRouterModel(env, agentKey) {
  const suffix = normalizeAgentKey(agentKey).toUpperCase();
  return (
    env[`OPENROUTER_MODEL_${suffix}`] ||
    (suffix === "ASSIGNMENT" ? env.OPENROUTER_MODEL_BRIEF : undefined) ||
    env.OPENROUTER_MODEL ||
    "openai/gpt-5.4-mini"
  );
}

function splitCsv(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

async function retrieveResourceContext(env, agentKey, message) {
  if (!env.DB) return [];

  const keys = resourceAgentKeys(agentKey);
  const terms = importantTerms(message);
  try {
    if (terms.length) {
      const conditions = terms.map(() => "lower(c.content) like ?").join(" or ");
      const binds = [
        ...keys,
        ...terms.map((term) => `%${term}%`)
      ];
      const result = await env.DB.prepare(
        `select
          r.title,
          r.agent_key as agentKey,
          c.content
        from resource_chunks c
        join resources r on r.id = c.resource_id
        where r.processing_status = 'ready'
          and (r.agent_key in (${keys.map(() => "?").join(", ")}) or r.agent_key is null)
          and (${conditions})
        order by r.created_at desc, c.chunk_index asc
        limit 5`
      )
        .bind(...binds)
        .all();

      if (result.results?.length) return result.results;
    }

    const fallback = await env.DB.prepare(
      `select
        r.title,
        r.agent_key as agentKey,
        c.content
      from resource_chunks c
      join resources r on r.id = c.resource_id
      where r.processing_status = 'ready'
        and (r.agent_key in (${keys.map(() => "?").join(", ")}) or r.agent_key is null)
      order by r.created_at desc, c.chunk_index asc
      limit 3`
    )
      .bind(...keys)
      .all();

    return fallback.results || [];
  } catch (error) {
    console.warn("Iris resource retrieval failed", error);
    return [];
  }
}

function resourceAgentKeys(agentKey) {
  const canonical = normalizeAgentKey(agentKey);
  if (canonical === "assignment") return ["assignment", "brief"];
  return [canonical];
}

function importantTerms(message) {
  const stopWords = new Set([
    "about",
    "after",
    "again",
    "also",
    "brief",
    "could",
    "from",
    "have",
    "help",
    "into",
    "need",
    "should",
    "that",
    "their",
    "there",
    "this",
    "what",
    "when",
    "where",
    "which",
    "with",
    "would",
    "your"
  ]);

  return [...new Set(
    String(message || "")
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, " ")
      .split(/\s+/)
      .map((term) => term.trim())
      .filter((term) => term.length > 3 && !stopWords.has(term))
  )].slice(0, 6);
}

async function logConversation(env, event) {
  if (!env.DB) return;

  try {
    const now = new Date().toISOString();
    await env.DB.batch([
      env.DB.prepare(
        "insert or ignore into conversations (id, agent_key, title, created_at, updated_at) values (?, ?, ?, ?, ?)"
      ).bind(event.conversationId, event.agentKey, "Iris chat", now, now),
      env.DB.prepare("update conversations set updated_at = ? where id = ?").bind(
        now,
        event.conversationId
      ),
      env.DB.prepare(
        "insert into messages (id, conversation_id, role, content, model, mode, created_at) values (?, ?, ?, ?, ?, ?, ?)"
      ).bind(
        crypto.randomUUID(),
        event.conversationId,
        "user",
        event.userMessage,
        null,
        event.mode,
        now
      ),
      env.DB.prepare(
        "insert into messages (id, conversation_id, role, content, model, mode, created_at) values (?, ?, ?, ?, ?, ?, ?)"
      ).bind(
        crypto.randomUUID(),
        event.conversationId,
        "assistant",
        event.assistantMessage,
        event.model,
        event.mode,
        now
      )
    ]);
  } catch (error) {
    console.warn("Iris database logging failed", error);
  }
}

function isUuid(value) {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value
    )
  );
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders(),
      "Content-Type": "application/json; charset=utf-8"
    }
  });
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };
}
