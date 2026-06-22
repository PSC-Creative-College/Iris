export function getTeacher(request, env) {
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

  return {
    ok: false,
    status: 401,
    message:
      "Teacher access is not configured for this request. Use Cloudflare Access or set TEACHER_ACCESS_CODE for temporary testing."
  };
}

export function requireTeacher(request, env) {
  const teacher = getTeacher(request, env);
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

