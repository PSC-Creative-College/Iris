import {
  consumeLtiState,
  createLtiSession,
  extractLaunchContext,
  html,
  makeSessionCookie,
  readParams,
  validateLtiIdToken
} from "../../_shared/lti.js";

export async function onRequestPost({ request, env }) {
  try {
    const params = await readParams(request);
    const idToken = String(params.id_token || "").trim();
    const state = String(params.state || "").trim();

    if (!idToken) throw new Error("Moodle did not include an id_token.");
    if (!state) throw new Error("Moodle did not include a launch state.");

    const stateRow = await consumeLtiState(env, state);
    const claims = await validateLtiIdToken(idToken, env, stateRow);
    const launch = extractLaunchContext(claims);
    const session = await createLtiSession(env, launch);
    const target = safeLocalTarget(launch.targetLinkUri || stateRow.target_link_uri || "/", request);

    return html(
      `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta http-equiv="refresh" content="0; url=${escapeHtml(target)}">
    <title>Opening Iris</title>
  </head>
  <body>
    <p>Opening Iris...</p>
    <script>window.location.replace(${JSON.stringify(target)});</script>
  </body>
</html>`,
      200,
      { "Set-Cookie": makeSessionCookie(session) }
    );
  } catch (error) {
    return html(
      `<h1>Iris LTI launch failed</h1><p>${escapeHtml(error.message || "Unknown LTI launch error.")}</p>`,
      400
    );
  }
}

export async function onRequestGet() {
  return html("<h1>Iris LTI launch</h1><p>Open Iris from Moodle to start an LTI launch.</p>");
}

function safeLocalTarget(value, request) {
  const requestUrl = new URL(request.url);
  const target = new URL(value, requestUrl.origin);
  if (target.origin !== requestUrl.origin) return "/";
  return `${target.pathname}${target.search}${target.hash}` || "/";
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
