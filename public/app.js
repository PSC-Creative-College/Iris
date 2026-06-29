const AGENTS = {
  assignment: {
    name: "Assignment Guide",
    prompts: [
      "What does this assignment mean by visual coherence?",
      "Help me turn this rubric into a project checklist.",
      "Does my project idea fit the assignment?"
    ],
    opener:
      "I can help unpack an assignment, rubric, or project requirement. Paste the part that feels unclear and I will help you reason through it."
  },
  technical: {
    name: "Technical Tutor",
    prompts: [
      "Why are my studio portraits underexposed?",
      "How should I think about aperture for this shoot?",
      "What should I check before sending files to print?"
    ],
    opener:
      "Tell me what you are trying to make, what equipment or software you are using, and what is going wrong."
  },
  critique: {
    name: "Creative Critique",
    prompts: [
      "Ask me critique questions about my portfolio sequence.",
      "How can I make my concept clearer?",
      "What might be distracting from my strongest work?"
    ],
    opener:
      "Describe your work, intent, audience, and current concern. I will focus on formative critique and revision questions."
  },
  client: {
    name: "Client Simulator",
    prompts: [
      "Act as a client who is unsure about my concept.",
      "Challenge my pitch so I can practise defending it.",
      "Give me feedback on how I handled that response."
    ],
    opener:
      "I can role-play a client, editor, producer, or creative director. Give me the scenario and the kind of pressure you want to practise."
  }
};

const state = {
  agent: "assignment",
  conversationId: crypto.randomUUID(),
  history: [],
  placeholderIndex: 0,
  placeholderTimer: null
};

const messagesEl = document.querySelector("#messages");
const form = document.querySelector("#chatForm");
const input = document.querySelector("#messageInput");
const sendButton = document.querySelector("#sendButton");
const clearButton = document.querySelector("#clearChat");
const statusEl = document.querySelector("#serviceStatus");
const agentNameEl = document.querySelector("#agentName");
const moodleContextEl = document.querySelector("#moodleContext");
const moodleCourseEl = document.querySelector("#moodleCourse");
const moodleUserEl = document.querySelector("#moodleUser");

const DEFAULT_PLACEHOLDER = "Ask Iris about your assignment, concept, process, or technical problem.";

function setStatus(text, busy = false) {
  statusEl.textContent = text;
  sendButton.disabled = busy;
}

function renderAgent() {
  const agent = AGENTS[state.agent];
  agentNameEl.textContent = agent.name;
  state.placeholderIndex = 0;
  startPlaceholderCycle();

  document.querySelectorAll(".agent-button").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.agent === state.agent);
  });
}

function startPlaceholderCycle() {
  window.clearInterval(state.placeholderTimer);
  updatePromptPlaceholder();
  state.placeholderTimer = window.setInterval(() => {
    if (input.value.trim()) return;
    const prompts = AGENTS[state.agent].prompts || [];
    state.placeholderIndex = prompts.length
      ? (state.placeholderIndex + 1) % prompts.length
      : 0;
    updatePromptPlaceholder();
  }, 5500);
}

function updatePromptPlaceholder() {
  const prompts = AGENTS[state.agent].prompts || [];
  const prompt = prompts[state.placeholderIndex] || DEFAULT_PLACEHOLDER;
  input.placeholder = prompt;
}

function appendMessage(role, content, label) {
  const article = document.createElement("article");
  article.className = `message ${role}`;

  const roleLabel = document.createElement("span");
  roleLabel.className = "message-label";
  roleLabel.textContent = label || (role === "user" ? "You" : "Iris");

  const messageContent = document.createElement("div");
  messageContent.className = "message-content";
  messageContent.append(...renderFormattedText(content));

  article.append(roleLabel, messageContent);
  messagesEl.append(article);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function renderFormattedText(content) {
  const blocks = [];
  const lines = String(content || "").split(/\r?\n/);
  let index = 0;

  while (index < lines.length) {
    const line = lines[index].trim();
    if (!line) {
      index += 1;
      continue;
    }

    if (isHeadingLine(line)) {
      blocks.push(createTextBlock("h4", stripHeadingMarker(line)));
      index += 1;
      continue;
    }

    if (isBulletLine(line)) {
      const list = document.createElement("ul");
      while (index < lines.length && isBulletLine(lines[index].trim())) {
        list.append(createTextBlock("li", lines[index].trim().replace(/^[-*]\s+/, "")));
        index += 1;
      }
      blocks.push(list);
      continue;
    }

    if (isNumberedLine(line)) {
      const list = document.createElement("ol");
      while (index < lines.length && isNumberedLine(lines[index].trim())) {
        list.append(createTextBlock("li", lines[index].trim().replace(/^\d+[.)]\s+/, "")));
        index += 1;
      }
      blocks.push(list);
      continue;
    }

    const paragraphLines = [];
    while (index < lines.length) {
      const current = lines[index].trim();
      if (!current || isHeadingLine(current) || isBulletLine(current) || isNumberedLine(current)) {
        break;
      }
      paragraphLines.push(current);
      index += 1;
    }
    blocks.push(createTextBlock("p", paragraphLines.join(" ")));
  }

  return blocks.length ? blocks : [createTextBlock("p", "")];
}

function createTextBlock(tagName, text) {
  const element = document.createElement(tagName);
  element.append(...renderInlineFormatting(text));
  return element;
}

function renderInlineFormatting(text) {
  const parts = [];
  const pattern = /\*\*([^*]+)\*\*/g;
  let start = 0;
  let match;

  while ((match = pattern.exec(text))) {
    if (match.index > start) {
      parts.push(document.createTextNode(text.slice(start, match.index)));
    }

    const strong = document.createElement("strong");
    strong.textContent = match[1];
    parts.push(strong);
    start = pattern.lastIndex;
  }

  if (start < text.length) {
    parts.push(document.createTextNode(text.slice(start)));
  }

  return parts;
}

function isHeadingLine(line) {
  return (
    /^#{1,4}\s+\S/.test(line) ||
    (/^[A-Z][A-Z0-9\s&:/()-]{3,}$/.test(line) && line.length <= 72) ||
    (/^[A-Z][^.!?]{2,}:$/.test(line) && line.length <= 72)
  );
}

function stripHeadingMarker(line) {
  return line.replace(/^#{1,4}\s+/, "").replace(/:$/, "");
}

function isBulletLine(line) {
  return /^[-*]\s+\S/.test(line);
}

function isNumberedLine(line) {
  return /^\d+[.)]\s+\S/.test(line);
}

function resetConversation() {
  state.conversationId = crypto.randomUUID();
  state.history = [];
  messagesEl.replaceChildren();
  appendMessage("assistant", AGENTS[state.agent].opener, AGENTS[state.agent].name);
  setStatus("Ready");
}

async function sendMessage(message) {
  const activeAgent = AGENTS[state.agent];
  appendMessage("user", message, "You");
  state.history.push({ role: "user", content: message });
  setStatus("Thinking", true);

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agent: state.agent,
        conversationId: state.conversationId,
        message,
        history: state.history.slice(-8)
      })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Iris could not respond.");
    }

    const reply = data.reply || "Iris did not return a response.";
    appendMessage("assistant", reply, activeAgent.name);
    state.history.push({ role: "assistant", content: reply });
    setStatus(data.mode === "demo" ? "Demo mode" : "Ready");
  } catch (error) {
    appendMessage(
      "system",
      error.message || "Something went wrong. Check the Cloudflare function logs.",
      "System"
    );
    setStatus("Needs attention");
  } finally {
    sendButton.disabled = false;
  }
}

async function loadMoodleContext() {
  try {
    const response = await fetch("/api/lti/session", {
      headers: { Accept: "application/json" }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.authenticated) return;

    moodleContextEl.hidden = false;
    moodleCourseEl.textContent = data.courseTitle || data.courseLabel || "Moodle course";
    moodleUserEl.textContent = [
      data.userName ? `Signed in as ${data.userName}` : "Signed in from Moodle",
      data.resourceLinkTitle || ""
    ]
      .filter(Boolean)
      .join(" | ");
  } catch {
    // The normal non-LTI chatbot path should stay quiet.
  }
}

document.querySelectorAll(".agent-button").forEach((button) => {
  button.addEventListener("click", () => {
    state.agent = button.dataset.agent;
    renderAgent();
    resetConversation();
  });
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const message = input.value.trim();
  if (!message) return;
  input.value = "";
  sendMessage(message);
});

input.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    form.requestSubmit();
  }
});

clearButton.addEventListener("click", resetConversation);

renderAgent();
resetConversation();
loadMoodleContext();
