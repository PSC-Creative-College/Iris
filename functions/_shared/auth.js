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

export async function getTeacher(request, env) {
  const accessEmail =
    request.headers.get("cf-access-authenticated-user-email") ||
    request.headers.get("cf-access-authenticated-user-email".toLowerCase());

  if (accessEmail && emailIsAllowed(accessEmail, env)) {
    return {
      ok: true,
      email: accessEmail.toLowerCase(),
      mode: "cloudflare-access"
    };
  }

  const auth = request.headers.get("authorization") || "";
  const code = auth.replace(/^Bearer\s+/i, "").trim();
  if (env.TEACHER_ACCESS_CODE && code && code === env.TEACHER_ACCESS_CODE) {
    return {
      ok: true,
      email: "teacher-code@iris.local",
      mode: "access-code"
    };
  }

  const ltiContext = await getLtiSessionContext(request, env);
  if (ltiContext && ltiRoleIsAllowed(ltiContext.roles, env)) {
    return {
      ok: true,
      email: ltiContext.userEmail || `moodle-user:${ltiContext.userId}`,
      name: ltiContext.userName || "Moodle teacher",
      mode: "moodle-lti",
      moodleUserId: ltiContext.userId,
      moodleCourseId: ltiContext.courseId,
      courseTitle: ltiContext.courseTitle,
      roles: ltiContext.roles
    };
  }

  return {
    ok: false,
    status: 401,
    message:
      "Teacher access is not configured for this request. Launch Teacher Studio from Moodle as a teacher, or use the temporary access code."
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
