import { getTeacher, json } from "../../_shared/auth.js";

export async function onRequestGet({ request, env }) {
  const teacher = getTeacher(request, env);

  if (!teacher.ok) {
    return json({
      authenticated: false,
      authOptions: {
        cloudflareAccess: true,
        accessCode: Boolean(env.TEACHER_ACCESS_CODE)
      },
      message: teacher.message
    });
  }

  return json({
    authenticated: true,
    email: teacher.email,
    mode: teacher.mode
  });
}

