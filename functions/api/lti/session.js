import { getLtiSessionContext, json } from "../../_shared/lti.js";

export async function onRequestGet({ request, env }) {
  const session = await getLtiSessionContext(request, env);

  if (!session) {
    return json({ authenticated: false });
  }

  return json({
    authenticated: true,
    userName: session.userName,
    courseId: session.courseId,
    courseTitle: session.courseTitle,
    courseLabel: session.courseLabel,
    roles: session.roles,
    resourceLinkTitle: session.resourceLinkTitle
  });
}
