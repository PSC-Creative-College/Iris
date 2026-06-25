const state = {
  authenticated: false,
  moodleItems: [],
  moodleFilter: "content",
  moodleScanContext: null
};

const API_BASE = location.pathname.startsWith("/studio") ? "/api/studio" : "/api/teacher";

const authNotice = document.querySelector("#authNotice");
const accessPanel = document.querySelector("#accessPanel");
const studioGrid = document.querySelector("#studioGrid");
const uploadForm = document.querySelector("#uploadForm");
const uploadButton = document.querySelector("#uploadButton");
const resourceList = document.querySelector("#resourceList");
const moodleAgentKey = document.querySelector("#moodleAgentKey");
const moodleScanButton = document.querySelector("#moodleScanButton");
const moodleImportButton = document.querySelector("#moodleImportButton");
const moodleStatus = document.querySelector("#moodleStatus");
const moodleFilterBar = document.querySelector("#moodleFilterBar");
const moodleItemList = document.querySelector("#moodleItemList");
const conversationRefreshButton = document.querySelector("#conversationRefreshButton");
const conversationStatus = document.querySelector("#conversationStatus");
const conversationList = document.querySelector("#conversationList");

const AGENT_LABELS = {
  assignment: "Assignment Guide",
  brief: "Assignment Guide",
  technical: "Technical Tutor",
  critique: "Creative Critique"
};

const SELECTABLE_AGENT_KEYS = new Set(["assignment", "technical"]);

const MOODLE_FILTER_LABELS = {
  content: "Content",
  file: "Files",
  activity: "Activities",
  link: "Links",
  section: "Sections",
  all: "All"
};

function authHeaders() {
  return {};
}

function setNotice(message, type = "warning") {
  authNotice.textContent = message;
  authNotice.className = `notice is-${type}`;
}

function normalizeAgentSelects() {
  [moodleAgentKey, document.querySelector("#agentKey")].forEach((select) => {
    if (!select) return;
    Array.from(select.options).forEach((option) => {
      const label = AGENT_LABELS[option.value];
      if (!label || !SELECTABLE_AGENT_KEYS.has(option.value)) {
        option.remove();
        return;
      }
      option.textContent = label;
    });
  });
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      ...(options.headers || {}),
      ...authHeaders()
    }
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || data.message || "Request failed.");
  }
  return data;
}

async function checkSession() {
  try {
    const data = await api(`${API_BASE}/session`);
    if (data.authenticated) {
      state.authenticated = true;
      accessPanel.hidden = true;
      studioGrid.hidden = false;
      setNotice(formatSignedInNotice(data), "good");
      await Promise.all([loadResources(), loadConversations()]);
      return;
    }

    state.authenticated = false;
    accessPanel.hidden = false;
    studioGrid.hidden = true;
    setNotice(data.message || "Teacher login is required.", "warning");
  } catch (error) {
    state.authenticated = false;
    accessPanel.hidden = false;
    studioGrid.hidden = true;
    setNotice(error.message, "error");
  }
}

async function loadResources() {
  resourceList.innerHTML = "<p class=\"empty-state\">Loading resources...</p>";
  const data = await api(`${API_BASE}/resources`);
  const resources = data.resources || [];

  if (!resources.length) {
    resourceList.innerHTML =
      "<p class=\"empty-state\">No uploaded materials yet. Add an assignment, rubric, or notes file to start grounding Iris.</p>";
    return;
  }

  resourceList.replaceChildren(
    ...resources.map((resource) => {
      const item = document.createElement("article");
      item.className = "resource-item";

      const top = document.createElement("div");
      top.className = "resource-title-row";

      const title = document.createElement("p");
      title.className = "resource-title";
      title.textContent = resource.title;

      const pill = document.createElement("span");
      pill.className = "agent-pill";
      pill.textContent = AGENT_LABELS[resource.agentKey] || resource.agentKey;

      const meta = document.createElement("p");
      meta.className = "resource-meta";
      meta.textContent = [
        resource.sourceType === "moodle" ? "Moodle" : "Upload",
        resource.fileName || "Text resource",
        `${resource.chunks || 0} chunks`,
        resource.uploadedBy || "unknown teacher",
        formatDate(resource.createdAt)
      ].join(" | ");

      const del = document.createElement("button");
      del.className = "delete-button";
      del.type = "button";
      del.textContent = "Delete";
      del.addEventListener("click", () => deleteResource(resource.id, resource.title));

      top.append(title, pill);
      item.append(top, meta, del);
      return item;
    })
  );
}

async function loadConversations() {
  conversationList.innerHTML = "<p class=\"empty-state\">Loading conversations...</p>";
  conversationStatus.textContent = "Loading recent Moodle-launched Iris conversations...";

  try {
    const data = await api(`${API_BASE}/conversations`);
    const conversations = data.conversations || [];

    if (!conversations.length) {
      conversationStatus.textContent = "No conversations logged yet.";
      conversationList.innerHTML =
        "<p class=\"empty-state\">Launch Iris from Moodle and send a test message to create the first conversation log.</p>";
      return;
    }

    conversationStatus.textContent = `Showing ${conversations.length} recent conversation${conversations.length === 1 ? "" : "s"}.`;
    conversationList.replaceChildren(
      ...conversations.map((conversation) => renderConversation(conversation))
    );
  } catch (error) {
    conversationStatus.textContent = error.message;
    conversationList.innerHTML =
      "<p class=\"empty-state\">Conversation logs could not be loaded.</p>";
  }
}

function renderConversation(conversation) {
  const item = document.createElement("article");
  item.className = "conversation-item";

  const top = document.createElement("div");
  top.className = "conversation-top";

  const titleBlock = document.createElement("div");
  const title = document.createElement("p");
  title.className = "resource-title";
  title.textContent = conversation.studentName || "Unknown Moodle user";

  const course = document.createElement("p");
  course.className = "resource-meta";
  course.textContent = (conversation.courseTitle || conversation.moodleCourseId)
    ? `${conversation.courseTitle || "Moodle course"}${conversation.moodleCourseId ? ` (${conversation.moodleCourseId})` : ""}`
    : "No Moodle course context";

  titleBlock.append(title, course);

  const pill = document.createElement("span");
  pill.className = "agent-pill";
  pill.textContent = AGENT_LABELS[conversation.agentKey] || conversation.agentKey || "Iris";

  top.append(titleBlock, pill);

  const meta = document.createElement("p");
  meta.className = "resource-meta";
  meta.textContent = [
    conversation.resourceLinkTitle ? `Tool: ${conversation.resourceLinkTitle}` : "",
    `${conversation.messageCount || 0} messages`,
    `Updated ${formatDate(conversation.updatedAt)}`
  ]
    .filter(Boolean)
    .join(" | ");

  const last = document.createElement("p");
  last.className = "conversation-question";
  last.textContent = conversation.lastQuestion
    ? `Latest question: ${truncateText(conversation.lastQuestion, 220)}`
    : "No student question recorded yet.";

  const details = document.createElement("details");
  details.className = "conversation-details";

  const summary = document.createElement("summary");
  summary.textContent = "View transcript";

  const transcript = document.createElement("div");
  transcript.className = "conversation-transcript";
  const messages = conversation.messages || [];
  if (!messages.length) {
    transcript.innerHTML = "<p class=\"empty-state\">No messages found for this conversation.</p>";
  } else {
    transcript.replaceChildren(...messages.map((message) => renderConversationMessage(message)));
  }

  details.append(summary, transcript);
  item.append(top, meta, last, details);
  return item;
}

function renderConversationMessage(message) {
  const row = document.createElement("section");
  row.className = `conversation-message is-${message.role}`;

  const label = document.createElement("p");
  label.className = "conversation-message-label";
  label.textContent = [
    message.role === "assistant" ? "Iris" : message.role === "user" ? "Student" : "System",
    formatDate(message.createdAt)
  ].join(" | ");

  const content = document.createElement("p");
  content.className = "conversation-message-content";
  content.textContent = message.content;

  row.append(label, content);
  return row;
}

async function deleteResource(id, title) {
  const ok = confirm(`Delete "${title}" from Iris resources?`);
  if (!ok) return;

  await api(`${API_BASE}/resources?id=${encodeURIComponent(id)}`, {
    method: "DELETE"
  });
  setNotice(`Deleted "${title}".`, "good");
  await loadResources();
}

function setMoodleStatus(message) {
  moodleStatus.textContent = message;
}

async function scanMoodleCourse() {
  moodleScanButton.disabled = true;
  moodleImportButton.disabled = true;
  moodleItemList.replaceChildren();
  state.moodleItems = [];
  state.moodleFilter = "content";
  state.moodleScanContext = null;
  updateMoodleFilterBar();
  setMoodleStatus("Scanning Moodle subject...");

  try {
    const data = await api(`${API_BASE}/moodle`);
    state.moodleItems = data.items || [];
    state.moodleScanContext = {
      courseId: data.courseId,
      courseLabel: data.courseName || data.launchedCourseTitle || `course ${data.courseId}`,
      sourceLabel: data.courseSource === "moodle-lti" ? "Moodle launch" : "configured fallback"
    };
    updateMoodleFilterBar();
    renderMoodleItems();
    updateMoodleScanStatus();
  } catch (error) {
    state.moodleItems = [];
    state.moodleScanContext = null;
    updateMoodleFilterBar();
    renderMoodleItems();
    setMoodleStatus(error.message);
  } finally {
    moodleScanButton.disabled = false;
    updateMoodleImportButton();
  }
}

function renderMoodleItems() {
  if (!state.moodleItems.length) {
    moodleItemList.innerHTML =
      "<p class=\"empty-state\">No Moodle items found yet.</p>";
    updateMoodleImportButton();
    return;
  }

  const visibleItems = filteredMoodleItems();
  if (!visibleItems.length) {
    moodleItemList.innerHTML =
      "<p class=\"empty-state\">No items match this filter.</p>";
    updateMoodleImportButton();
    return;
  }

  moodleItemList.replaceChildren(
    ...visibleItems.map((item) => {
      const row = document.createElement("article");
      row.className = "moodle-item";

      const check = document.createElement("input");
      check.type = "checkbox";
      check.value = item.id;
      check.disabled = Boolean(item.imported);
      check.addEventListener("change", updateMoodleImportButton);

      const title = document.createElement("p");
      title.className = "resource-title";
      title.textContent = item.title;

      const meta = document.createElement("p");
      meta.className = "resource-meta";
      meta.textContent = [
        moodleKindLabel(item.kind),
        item.sectionName,
        item.moduleType,
        item.byteSize ? formatBytes(item.byteSize) : "",
        item.imported ? "Imported" : "Ready"
      ]
        .filter(Boolean)
        .join(" | ");

      const label = document.createElement("label");
      label.className = "moodle-check";
      label.append(check, title);

      row.append(label, meta);
      return row;
    })
  );

  updateMoodleImportButton();
}

function filteredMoodleItems() {
  return state.moodleItems.filter((item) => moodleItemMatchesFilter(item, state.moodleFilter));
}

function moodleItemMatchesFilter(item, filter) {
  if (filter === "all") return true;
  if (filter === "content") return item.kind !== "section";
  return item.kind === filter;
}

function updateMoodleFilterBar() {
  if (!moodleFilterBar) return;

  moodleFilterBar.hidden = state.moodleItems.length === 0;
  moodleFilterBar.querySelectorAll(".filter-button").forEach((button) => {
    const filter = button.dataset.moodleFilter;
    const count = state.moodleItems.filter((item) => moodleItemMatchesFilter(item, filter)).length;
    button.textContent = `${MOODLE_FILTER_LABELS[filter] || filter} (${count})`;
    button.classList.toggle("is-active", filter === state.moodleFilter);
    button.disabled = count === 0;
  });
}

function updateMoodleScanStatus() {
  const context = state.moodleScanContext;
  if (!context) return;

  const visibleItems = filteredMoodleItems();
  const readyCount = visibleItems.filter((item) => !item.imported).length;
  const sectionCount = state.moodleItems.filter((item) => item.kind === "section").length;
  const hiddenSectionNote =
    state.moodleFilter === "content" && sectionCount > 0
      ? ` ${sectionCount} section item${sectionCount === 1 ? "" : "s"} hidden by default.`
      : "";

  setMoodleStatus(
    `Showing ${visibleItems.length} of ${state.moodleItems.length} items in ${context.courseLabel} (${context.courseId}, ${context.sourceLabel}). ${readyCount} ready to import.${hiddenSectionNote}`
  );
}

function selectedMoodleItemIds() {
  return Array.from(moodleItemList.querySelectorAll("input[type='checkbox']:checked"))
    .map((input) => input.value)
    .filter(Boolean);
}

function updateMoodleImportButton() {
  moodleImportButton.disabled = selectedMoodleItemIds().length === 0;
}

async function importSelectedMoodleItems() {
  const itemIds = selectedMoodleItemIds();
  if (!itemIds.length) return;

  moodleScanButton.disabled = true;
  moodleImportButton.disabled = true;
  moodleImportButton.textContent = "Importing...";
  setMoodleStatus(`Importing ${itemIds.length} Moodle item${itemIds.length === 1 ? "" : "s"}...`);

  try {
    const data = await api(`${API_BASE}/moodle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        itemIds,
        agentKey: moodleAgentKey.value
      })
    });

    setNotice(`Imported ${data.imported.length} Moodle item${data.imported.length === 1 ? "" : "s"}.`, "good");
    setMoodleStatus(
      `Imported ${data.imported.length}; skipped ${data.skipped.length}.`
    );
    await loadResources();
    await scanMoodleCourse();
  } catch (error) {
    setMoodleStatus(error.message);
    setNotice(error.message, "error");
  } finally {
    moodleScanButton.disabled = false;
    moodleImportButton.textContent = "Import selected";
    updateMoodleImportButton();
  }
}

uploadForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  uploadButton.disabled = true;
  uploadButton.textContent = "Uploading...";

  try {
    const form = new FormData(uploadForm);
    const response = await fetch(`${API_BASE}/resources`, {
      method: "POST",
      headers: authHeaders(),
      body: form
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || "Upload failed.");
    }

    uploadForm.reset();
    setNotice(`Uploaded "${data.resource.title}" with ${data.resource.chunks} searchable chunks.`, "good");
    await loadResources();
  } catch (error) {
    setNotice(error.message, "error");
  } finally {
    uploadButton.disabled = false;
    uploadButton.textContent = "Upload resource";
  }
});

moodleScanButton.addEventListener("click", scanMoodleCourse);
moodleImportButton.addEventListener("click", importSelectedMoodleItems);
moodleFilterBar?.addEventListener("click", (event) => {
  const button = event.target.closest(".filter-button");
  if (!button || button.disabled) return;
  state.moodleFilter = button.dataset.moodleFilter || "content";
  updateMoodleFilterBar();
  renderMoodleItems();
  updateMoodleScanStatus();
});
conversationRefreshButton.addEventListener("click", loadConversations);

function formatDate(value) {
  if (!value) return "unknown date";
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function formatBytes(value) {
  const bytes = Number(value || 0);
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatSignedInNotice(data) {
  const person = data.name || data.email || "Moodle teacher";
  const mode = data.mode === "moodle-lti" ? "Moodle LTI" : data.mode;
  const course = data.courseTitle ? ` for ${data.courseTitle}` : "";
  return `Signed in as ${person} via ${mode}${course}.`;
}

function moodleKindLabel(kind) {
  const labels = {
    activity: "Activity",
    file: "File",
    link: "Link",
    section: "Section"
  };
  return labels[kind] || "Moodle";
}

function truncateText(value, maxLength) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1)}...`;
}

normalizeAgentSelects();
checkSession();
