import {
  createLtiState,
  html,
  readParams,
  resolveMoodleAuthUrl
} from "../../_shared/lti.js";

export async function onRequestGet(context) {
  return handleLogin(context);
}

export async function onRequestPost(context) {
  return handleLogin(context);
}

async function handleLogin({ request, env }) {
  try {
    const params = await readParams(request);
    const authUrl = resolveMoodleAuthUrl(env);
    if (!authUrl) {
      throw new Error("MOODLE_BASE_URL or MOODLE_LTI_AUTH_URL is required before Moodle can launch Iris.");
    }

    const loginHint = String(params.login_hint || "").trim();
    const targetLinkUri = String(params.target_link_uri || new URL("/", request.url)).trim();
    const clientId = String(params.client_id || env.MOODLE_LTI_CLIENT_ID || "").trim();
    const issuer = String(params.iss || env.MOODLE_LTI_ISSUER || env.MOODLE_BASE_URL || "").trim();
    const ltiMessageHint = String(params.lti_message_hint || "").trim();

    if (!loginHint) throw new Error("Moodle did not include login_hint.");
    if (!clientId) throw new Error("Moodle did not include client_id and MOODLE_LTI_CLIENT_ID is not configured.");

    const { state, nonce } = await createLtiState(env, {
      issuer,
      clientId,
      targetLinkUri
    });

    const redirectUri = new URL("/api/lti/launch", request.url).toString();
    const redirect = new URL(authUrl);
    redirect.searchParams.set("response_type", "id_token");
    redirect.searchParams.set("response_mode", "form_post");
    redirect.searchParams.set("scope", "openid");
    redirect.searchParams.set("prompt", "none");
    redirect.searchParams.set("client_id", clientId);
    redirect.searchParams.set("redirect_uri", redirectUri);
    redirect.searchParams.set("login_hint", loginHint);
    redirect.searchParams.set("state", state);
    redirect.searchParams.set("nonce", nonce);

    if (ltiMessageHint) {
      redirect.searchParams.set("lti_message_hint", ltiMessageHint);
    }

    return Response.redirect(redirect.toString(), 302);
  } catch (error) {
    return html(
      `<h1>Iris LTI login could not start</h1><p>${escapeHtml(error.message || "Unknown LTI login error.")}</p>`,
      400
    );
  }
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
