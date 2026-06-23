const state = {
  token: sessionStorage.getItem("irisTeacherAccessCode") || "",
  authenticated: false
};

const authNotice = document.querySelector("#authNotice");
const accessPanel = document.querySelector("#accessPanel");
const accessForm = document.querySelector("#accessForm");
const studioGrid = document.querySelector("#studioGrid");
const uploadForm = document.querySelector("#uploadForm");
const uploadButton = document.querySelector("#uploadButton");
const resourceList = document.querySelector("#resourceList");

const AGENT_LABELS = {
  assignment: "Assignment Guide",
  brief: "Assignment Guide",
  technical: "Technical Tutor",
  critique: "Portfolio Coach",
  client: "Client Simulator"
};

function authHeaders() {
  return state.token ? { Authorization: `Bearer ${state.token}` } : {};
}

function setNotice(message, type = "warning") {
  authNotice.textContent = message;
  authNotice.className = `notice is-${type}`;
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
    const data = await api("/api/teacher/session");
    if (data.authenticated) {
      state.authenticated = true;
      accessPanel.hidden = true;
      studioGrid.hidden = false;
      setNotice(`Signed in as ${data.email} via ${data.mode}.`, "good");
      await loadResources();
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
  const data = await api("/api/teacher/resources");
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

async function deleteResource(id, title) {
  const ok = confirm(`Delete "${title}" from Iris resources?`);
  if (!ok) return;

  await api(`/api/teacher/resources?id=${encodeURIComponent(id)}`, {
    method: "DELETE"
  });
  setNotice(`Deleted "${title}".`, "good");
  await loadResources();
}

accessForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const code = new FormData(accessForm).get("accessCode");
  state.token = String(code || "").trim();
  if (!state.token) return;
  sessionStorage.setItem("irisTeacherAccessCode", state.token);
  await checkSession();
});

uploadForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  uploadButton.disabled = true;
  uploadButton.textContent = "Uploading...";

  try {
    const form = new FormData(uploadForm);
    const response = await fetch("/api/teacher/resources", {
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

checkSession();
