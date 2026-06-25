import { getLtiSessionContext } from "./lti.js";

const DEFAULT_LTI_TEACHER_KEYWORDS = [
  "administrator",
  "contentdeveloper",
  "instructor",
  "manager",
  "mentor",
  "staff",
  "teacher",
  "teachingassistant"
];

const DEFAULT_TRANSCRIPT_ADMIN_KEYWORDS = [
  "administrator",
  "convenor",
  "convener",
  "provider administrator"
];

export async function getTeacher(request, env) {
  const accessEmail =
    request.headers.get("cf-access-authenticated-user-email") ||
    request.headers.get("cf-access-authenticated-user-email".toLowerCase());

  if (accessEmail && emailIsAllowed(accessEmail, env)) {
    return {
      ok: true,
      email: accessEmail.toLowerCase(),
      mode: "cloudflare-access",
      canViewAllTranscripts: true,
      roles: ["cloudflare-access"]
    };
  }

  const ltiContext = await getLtiSessionContext(request, env);
  if (ltiContext && ltiRoleIsAllowed(ltiContext.roles, env)) {
    const archiveAccess = ltiContextCanViewAllTranscripts(ltiContext, env);
    return {
      ok: true,
      email: ltiContext.userEmail || `moodle-user:${ltiContext.userId}`,
      name: ltiContext.userName || "Moodle teacher",
      mode: "moodle-lti",
      moodleUserId: ltiContext.userId,
      moodleCourseId: ltiContext.courseId,
      courseTitle: ltiContext.courseTitle,
      roles: ltiContext.roles,
      canViewAllTranscripts: archiveAccess.allowed,
      archiveAccessReason: archiveAccess.reason
    };
  }

  return {
    ok: false,
    status: 401,
    message:
      "Teacher access is not configured for this request. Launch Teacher Studio from Moodle as a teacher."
  };
}

export async function requireTeacher(request, env) {
  const teacher = await getTeacher(request, env);
  if (!teacher.ok) {
    return {
      teacher,
      response: json(
        {
          authenticated: false,
          error: teacher.message
        },
        teacher.status
      )
    };
  }

  return { teacher, response: null };
}

export function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}

function emailIsAllowed(email, env) {
  const clean = String(email || "").toLowerCase();
  const allowlist = String(env.TEACHER_EMAIL_ALLOWLIST || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  if (allowlist.length > 0) {
    return allowlist.includes(clean);
  }

  const domain = String(env.TEACHER_EMAIL_DOMAIN || "").trim().toLowerCase();
  if (domain) {
    return clean.endsWith(`@${domain}`);
  }

  return true;
}

function ltiRoleIsAllowed(roles = [], env) {
  const keywords = String(env.TEACHER_LTI_ROLE_KEYWORDS || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  const allowed = keywords.length ? keywords : DEFAULT_LTI_TEACHER_KEYWORDS;

  return roles.some((role) => {
    const clean = String(role || "").toLowerCase();
    return allowed.some((keyword) => clean.includes(keyword));
  });
}

function ltiRoleCanViewAllTranscripts(roles = [], env) {
  const configured = String(env.TRANSCRIPT_ADMIN_ROLE_KEYWORDS || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  const allowed = [...new Set([...DEFAULT_TRANSCRIPT_ADMIN_KEYWORDS, ...configured])];

  return roles.some((role) => {
    const clean = normalizeRole(role);
    return allowed.some((keyword) => clean.includes(normalizeRole(keyword)));
  });
}

function ltiContextCanViewAllTranscripts(ltiContext, env) {
  if (ltiRoleCanViewAllTranscripts(ltiContext.roles, env)) {
    return { allowed: true, reason: "role" };
  }

  if (transcriptAdminEmailIsAllowed(ltiContext.userEmail, env)) {
    return { allowed: true, reason: "email" };
  }

  if (transcriptAdminMoodleUserIsAllowed(ltiContext.userId, env)) {
    return { allowed: true, reason: "moodle-user-id" };
  }

  return { allowed: false, reason: "subject-role" };
}

function transcriptAdminEmailIsAllowed(email, env) {
  const clean = String(email || "").trim().toLowerCase();
  if (!clean) return false;

  const allowed = String(env.TRANSCRIPT_ADMIN_EMAILS || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  return allowed.includes(clean);
}

function transcriptAdminMoodleUserIsAllowed(userId, env) {
  const clean = String(userId || "").trim();
  if (!clean) return false;

  const allowed = String(env.TRANSCRIPT_ADMIN_MOODLE_USER_IDS || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  return allowed.includes(clean);
}

function normalizeRole(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
