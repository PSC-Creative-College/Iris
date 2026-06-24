const LTI_MESSAGE_TYPE_CLAIM = "https://purl.imsglobal.org/spec/lti/claim/message_type";
const LTI_VERSION_CLAIM = "https://purl.imsglobal.org/spec/lti/claim/version";
const LTI_DEPLOYMENT_ID_CLAIM = "https://purl.imsglobal.org/spec/lti/claim/deployment_id";
const LTI_ROLES_CLAIM = "https://purl.imsglobal.org/spec/lti/claim/roles";
const LTI_CONTEXT_CLAIM = "https://purl.imsglobal.org/spec/lti/claim/context";
const LTI_RESOURCE_LINK_CLAIM = "https://purl.imsglobal.org/spec/lti/claim/resource_link";
const LTI_TARGET_LINK_URI_CLAIM = "https://purl.imsglobal.org/spec/lti/claim/target_link_uri";

const SESSION_COOKIE = "iris_lti_session";
const SESSION_TTL_SECONDS = 60 * 60 * 8;
const STATE_TTL_SECONDS = 60 * 10;
const CLOCK_SKEW_SECONDS = 60;

const FALLBACK_PUBLIC_JWK = {
  kty: "RSA",
  n: "ma7an-KDOO3MN18-RUhUDPGdBvovhsFfegybFASqJnV4wsjh8A4C0KOpwITGpORjeUx7oy88mCAZ_VAcDtLX_x8FgYHNrxdTNgC5ykMXaxKwVpt_S6b74MmTY5Mpl4gtcDbcUZ63kTfyyudIS4Pim-miFk96Vpv3L6rw-gILkMul8BLHx-DxvH2rNVSqb3auVeJ7y8SviQkXDztnfuXh4tdJ4uwxJAOqmP7yAEq1z2hAwvi1o_B2XtuPMGUTwFPFBpL_NnZvL7lrhSjjqsS8_di2nFHomBedt32pgb6z7v8FeuWIr43Fp69tvWRCJLOq836WY80KMIIpGyOqDLzNfQ",
  e: "AQAB",
  kid: "iris-lti-public-2026-06",
  use: "sig",
  alg: "RS256"
};

export async function ensureLtiTables(env) {
  if (!env.DB) throw new Error("D1 binding DB is missing.");

  await env.DB.batch([
    env.DB.prepare(
      `create table if not exists lti_states (
        state text primary key,
        nonce text not null,
        issuer text,
        client_id text,
        target_link_uri text,
        created_at text not null,
        expires_at text not null
      )`
    ),
    env.DB.prepare("create index if not exists idx_lti_states_expires_at on lti_states(expires_at)"),
    env.DB.prepare(
      `create table if not exists lti_sessions (
        id text primary key,
        moodle_issuer text,
        moodle_user_id text not null,
        user_name text,
        user_email text,
        moodle_course_id text,
        course_title text,
        course_label text,
        roles text,
        deployment_id text,
        resource_link_id text,
        resource_link_title text,
        created_at text not null,
        expires_at text not null,
        last_seen_at text not null
      )`
    ),
    env.DB.prepare("create index if not exists idx_lti_sessions_user on lti_sessions(moodle_user_id)"),
    env.DB.prepare("create index if not exists idx_lti_sessions_course on lti_sessions(moodle_course_id)"),
    env.DB.prepare("create index if not exists idx_lti_sessions_expires_at on lti_sessions(expires_at)")
  ]);
}

export async function createLtiState(env, params) {
  await ensureLtiTables(env);

  const now = new Date();
  const state = crypto.randomUUID();
  const nonce = crypto.randomUUID();
  const expires = new Date(now.getTime() + STATE_TTL_SECONDS * 1000);

  await env.DB.prepare(
    `insert into lti_states (
      state,
      nonce,
      issuer,
      client_id,
      target_link_uri,
      created_at,
      expires_at
    ) values (?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      state,
      nonce,
      params.issuer || null,
      params.clientId || null,
      params.targetLinkUri || null,
      now.toISOString(),
      expires.toISOString()
    )
    .run();

  return { state, nonce };
}

export async function consumeLtiState(env, state) {
  await ensureLtiTables(env);

  const row = await env.DB.prepare(
    "select * from lti_states where state = ? and expires_at > ?"
  )
    .bind(state, new Date().toISOString())
    .first();

  if (!row) {
    throw new Error("The Moodle launch expired or did not include a valid state value.");
  }

  await env.DB.prepare("delete from lti_states where state = ?").bind(state).run();
  return row;
}

export async function createLtiSession(env, launch) {
  await ensureLtiTables(env);

  const now = new Date();
  const expires = new Date(now.getTime() + SESSION_TTL_SECONDS * 1000);
  const id = crypto.randomUUID();

  await env.DB.prepare(
    `insert into lti_sessions (
      id,
      moodle_issuer,
      moodle_user_id,
      user_name,
      user_email,
      moodle_course_id,
      course_title,
      course_label,
      roles,
      deployment_id,
      resource_link_id,
      resource_link_title,
      created_at,
      expires_at,
      last_seen_at
    ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      id,
      launch.issuer || null,
      launch.userId,
      launch.userName || null,
      launch.userEmail || null,
      launch.courseId || null,
      launch.courseTitle || null,
      launch.courseLabel || null,
      JSON.stringify(launch.roles || []),
      launch.deploymentId || null,
      launch.resourceLinkId || null,
      launch.resourceLinkTitle || null,
      now.toISOString(),
      expires.toISOString(),
      now.toISOString()
    )
    .run();

  return { id, expires };
}

export async function getLtiSessionContext(request, env) {
  if (!env.DB) return null;

  const sessionId = getCookie(request, SESSION_COOKIE);
  if (!sessionId) return null;

  try {
    await ensureLtiTables(env);
    const row = await env.DB.prepare(
      `select
        id,
        moodle_issuer as issuer,
        moodle_user_id as userId,
        user_name as userName,
        user_email as userEmail,
        moodle_course_id as courseId,
        course_title as courseTitle,
        course_label as courseLabel,
        roles,
        deployment_id as deploymentId,
        resource_link_id as resourceLinkId,
        resource_link_title as resourceLinkTitle,
        expires_at as expiresAt
      from lti_sessions
      where id = ? and expires_at > ?`
    )
      .bind(sessionId, new Date().toISOString())
      .first();

    if (!row) return null;

    await env.DB.prepare("update lti_sessions set last_seen_at = ? where id = ?")
      .bind(new Date().toISOString(), sessionId)
      .run();

    return {
      ...row,
      roles: safeParseJson(row.roles, [])
    };
  } catch (error) {
    console.warn("Iris LTI session lookup failed", error);
    return null;
  }
}

export async function validateLtiIdToken(idToken, env, stateRow) {
  const { header, payload, signingInput, signature } = decodeJwt(idToken);

  if (header.alg !== "RS256") {
    throw new Error(`Unsupported Moodle LTI signing algorithm: ${header.alg || "unknown"}.`);
  }

  const jwk = await resolvePlatformJwk(header, env);
  const key = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"]
  );

  const verified = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    signature,
    signingInput
  );

  if (!verified) {
    throw new Error("Moodle LTI launch signature could not be verified.");
  }

  validateLtiClaims(payload, env, stateRow);
  return payload;
}

export function extractLaunchContext(claims) {
  const context = claims[LTI_CONTEXT_CLAIM] || {};
  const resourceLink = claims[LTI_RESOURCE_LINK_CLAIM] || {};
  const roles = Array.isArray(claims[LTI_ROLES_CLAIM]) ? claims[LTI_ROLES_CLAIM] : [];

  return {
    issuer: claims.iss,
    userId: String(claims.sub || ""),
    userName: firstNonEmpty(claims.name, fullName(claims.given_name, claims.family_name)),
    userEmail: firstNonEmpty(claims.email, claims["https://purl.imsglobal.org/spec/lti/claim/lis"]?.person_sourcedid),
    courseId: firstNonEmpty(context.id, context.context_id),
    courseTitle: firstNonEmpty(context.title, context.label),
    courseLabel: firstNonEmpty(context.label, context.title),
    roles,
    deploymentId: claims[LTI_DEPLOYMENT_ID_CLAIM],
    resourceLinkId: resourceLink.id,
    resourceLinkTitle: resourceLink.title,
    targetLinkUri: claims[LTI_TARGET_LINK_URI_CLAIM]
  };
}

export function makeSessionCookie(session) {
  return [
    `${SESSION_COOKIE}=${session.id}`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=None",
    `Max-Age=${SESSION_TTL_SECONDS}`,
    `Expires=${session.expires.toUTCString()}`
  ].join("; ");
}

export function ltiPublicJwks(env) {
  const configured = safeParseJson(env.LTI_PUBLIC_JWK, null);
  return {
    keys: [configured || FALLBACK_PUBLIC_JWK]
  };
}

export function ltiConfig(request, env) {
  return {
    toolName: "Iris AI Studio",
    toolUrl: absoluteUrl(request, "/"),
    initiateLoginUrl: absoluteUrl(request, "/api/lti/login"),
    redirectUri: absoluteUrl(request, "/api/lti/launch"),
    publicKeysetUrl: absoluteUrl(request, "/api/lti/jwks"),
    targetLinkUri: absoluteUrl(request, "/"),
    moodleIssuer: resolveMoodleIssuer(env),
    moodleAuthorizationUrl: resolveMoodleAuthUrl(env),
    moodleKeysetUrl: resolveMoodleJwksUrl(env)
  };
}

export function resolveMoodleIssuer(env) {
  return normalizeBaseUrl(env.MOODLE_LTI_ISSUER || env.MOODLE_BASE_URL);
}

export function resolveMoodleAuthUrl(env) {
  if (env.MOODLE_LTI_AUTH_URL) return env.MOODLE_LTI_AUTH_URL;
  const base = normalizeBaseUrl(env.MOODLE_BASE_URL);
  return base ? `${base}/mod/lti/auth.php` : "";
}

export function resolveMoodleJwksUrl(env) {
  if (env.MOODLE_LTI_JWKS_URL) return env.MOODLE_LTI_JWKS_URL;
  const base = normalizeBaseUrl(env.MOODLE_BASE_URL);
  return base ? `${base}/mod/lti/certs.php` : "";
}

export function json(payload, status = 200, headers = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...headers
    }
  });
}

export function html(body, status = 200, headers = {}) {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      ...headers
    }
  });
}

export function absoluteUrl(request, path) {
  const url = new URL(request.url);
  return new URL(path, `${url.protocol}//${url.host}`).toString();
}

export async function readParams(request) {
  if (request.method === "POST") {
    const form = await request.formData();
    return Object.fromEntries([...form.entries()].map(([key, value]) => [key, String(value)]));
  }

  return Object.fromEntries(new URL(request.url).searchParams.entries());
}

function validateLtiClaims(claims, env, stateRow) {
  const now = Math.floor(Date.now() / 1000);
  const expectedIssuer = resolveMoodleIssuer(env);
  const expectedClientId = env.MOODLE_LTI_CLIENT_ID || stateRow.client_id;
  const expectedDeploymentId = env.MOODLE_LTI_DEPLOYMENT_ID;

  if (expectedIssuer && claims.iss !== expectedIssuer) {
    throw new Error("Moodle LTI issuer does not match the configured Iris issuer.");
  }

  if (expectedClientId && !audienceIncludes(claims.aud, expectedClientId)) {
    throw new Error("Moodle LTI launch was not issued for this Iris client ID.");
  }

  if (expectedDeploymentId && claims[LTI_DEPLOYMENT_ID_CLAIM] !== expectedDeploymentId) {
    throw new Error("Moodle LTI deployment ID does not match the configured Iris deployment.");
  }

  if (claims.nonce !== stateRow.nonce) {
    throw new Error("Moodle LTI launch nonce did not match the login request.");
  }

  if (claims.exp && Number(claims.exp) < now - CLOCK_SKEW_SECONDS) {
    throw new Error("Moodle LTI launch token has expired.");
  }

  if (claims.nbf && Number(claims.nbf) > now + CLOCK_SKEW_SECONDS) {
    throw new Error("Moodle LTI launch token is not valid yet.");
  }

  if (claims.iat && Number(claims.iat) > now + CLOCK_SKEW_SECONDS) {
    throw new Error("Moodle LTI launch token was issued in the future.");
  }

  if (claims[LTI_MESSAGE_TYPE_CLAIM] !== "LtiResourceLinkRequest") {
    throw new Error("Iris currently supports Moodle LTI resource link launches only.");
  }

  if (claims[LTI_VERSION_CLAIM] && claims[LTI_VERSION_CLAIM] !== "1.3.0") {
    throw new Error("Iris expected an LTI 1.3 launch.");
  }

  if (!claims.sub) {
    throw new Error("Moodle LTI launch did not include a student or teacher user id.");
  }
}

async function resolvePlatformJwk(header, env) {
  const jwksUrl = resolveMoodleJwksUrl(env);
  if (!jwksUrl) {
    throw new Error("MOODLE_LTI_JWKS_URL or MOODLE_BASE_URL is required for LTI launch validation.");
  }

  const response = await fetch(jwksUrl, {
    headers: { Accept: "application/json" }
  });

  if (!response.ok) {
    throw new Error(`Could not load Moodle LTI keyset from ${jwksUrl}.`);
  }

  const data = await response.json();
  const keys = Array.isArray(data.keys) ? data.keys : [];
  const jwk = keys.find((key) => key.kid === header.kid) || keys[0];

  if (!jwk) {
    throw new Error("Moodle LTI keyset did not contain a usable signing key.");
  }

  const { key_ops, ...cleanJwk } = jwk;
  return {
    ...cleanJwk,
    ext: true
  };
}

function decodeJwt(idToken) {
  const parts = String(idToken || "").split(".");
  if (parts.length !== 3) {
    throw new Error("Moodle LTI launch did not include a valid id_token.");
  }

  const [headerPart, payloadPart, signaturePart] = parts;
  return {
    header: JSON.parse(decodeBase64UrlToString(headerPart)),
    payload: JSON.parse(decodeBase64UrlToString(payloadPart)),
    signingInput: new TextEncoder().encode(`${headerPart}.${payloadPart}`),
    signature: decodeBase64UrlToBytes(signaturePart)
  };
}

function decodeBase64UrlToString(value) {
  return new TextDecoder().decode(decodeBase64UrlToBytes(value));
}

function decodeBase64UrlToBytes(value) {
  const base64 = String(value || "")
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(String(value || "").length / 4) * 4, "=");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function getCookie(request, name) {
  const cookie = request.headers.get("cookie") || "";
  return cookie
    .split(";")
    .map((part) => part.trim())
    .map((part) => part.split("="))
    .find(([key]) => key === name)?.[1] || "";
}

function audienceIncludes(aud, expected) {
  return Array.isArray(aud) ? aud.includes(expected) : aud === expected;
}

function normalizeBaseUrl(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

function firstNonEmpty(...values) {
  return values.find((value) => String(value || "").trim()) || "";
}

function fullName(givenName, familyName) {
  return [givenName, familyName].map((item) => String(item || "").trim()).filter(Boolean).join(" ");
}

function safeParseJson(value, fallback) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}
