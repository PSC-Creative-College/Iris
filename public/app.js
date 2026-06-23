const AGENTS = {
  assignment: {
    name: "Assignment Guide",
    type: "Assessment clarity",
    contextTitle: "Assessment support",
    contextCopy:
      "Iris can clarify assignment requirements, translate rubric language, and help plan next steps without writing the work for the student.",
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
    type: "Studio and workflow",
    contextTitle: "Technical support",
    contextCopy:
      "Iris can help troubleshoot production choices, camera settings, lighting setups, software workflows, and preparation for print or presentation.",
    prompts: [
      "Why are my studio portraits underexposed?",
      "How should I think about aperture for this shoot?",
      "What should I check before sending files to print?"
    ],
    opener:
      "Tell me what you are trying to make, what equipment or software you are using, and what is going wrong."
  },
  critique: {
    name: "Portfolio Coach",
    type: "Formative critique",
    contextTitle: "Creative critique",
    contextCopy:
      "Iris can ask critique questions, test intent against audience, and suggest revision paths while keeping final creative judgment with the student.",
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
    type: "Pitch practice",
    contextTitle: "Professional practice",
    contextCopy:
      "Iris can role-play a client or creative stakeholder, then give feedback on clarity, confidence, questions, and professional tone.",
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
  history: []
};

const messagesEl = document.querySelector("#messages");
const form = document.querySelector("#chatForm");
const input = document.querySelector("#messageInput");
const sendButton = document.querySelector("#sendButton");
const clearButton = document.querySelector("#clearChat");
const statusEl = document.querySelector("#serviceStatus");
const agentNameEl = document.querySelector("#agentName");
const agentTypeEl = document.querySelector("#agentType");
const contextTitleEl = document.querySelector("#contextTitle");
const contextCopyEl = document.querySelector("#contextCopy");
const promptStackEl = document.querySelector("#promptStack");

function setStatus(text, busy = false) {
  statusEl.textContent = text;
  sendButton.disabled = busy;
}

function renderAgent() {
  const agent = AGENTS[state.agent];
  agentNameEl.textContent = agent.name;
  agentTypeEl.textContent = agent.type;
  contextTitleEl.textContent = agent.contextTitle;
  contextCopyEl.textContent = agent.contextCopy;

  document.querySelectorAll(".agent-button").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.agent === state.agent);
  });

  promptStackEl.replaceChildren(
    ...agent.prompts.map((prompt) => {
      const button = document.createElement("button");
      button.className = "prompt-button";
      button.type = "button";
      button.textContent = prompt;
      button.addEventListener("click", () => {
        input.value = prompt;
        input.focus();
      });
      return button;
    })
  );
}

function appendMessage(role, content, label) {
  const article = document.createElement("article");
  article.className = `message ${role}`;

  const roleLabel = document.createElement("span");
  roleLabel.className = "message-label";
  roleLabel.textContent = label || (role === "user" ? "You" : "Iris");

  const paragraph = document.createElement("p");
  paragraph.textContent = content;

  article.append(roleLabel, paragraph);
  messagesEl.append(article);
  messagesEl.scrollTop = messagesEl.scrollHeight;
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
