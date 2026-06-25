import { getTeacher, json } from "../../_shared/auth.js";

export async function onRequestGet({ request, env }) {
  const teacher = await getTeacher(request, env);

  if (!teacher.ok) {
    return json({
      authenticated: false,
      authOptions: {
        moodleLti: true,
        cloudflareAccess: true
      },
      message: teacher.message
    });
  }

  return json({
    authenticated: true,
    email: teacher.email,
    name: teacher.name || teacher.email,
    mode: teacher.mode,
    moodleCourseId: teacher.moodleCourseId,
    courseTitle: teacher.courseTitle
  });
}
