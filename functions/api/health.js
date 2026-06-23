export async function onRequestGet(context) {
  const env = context.env;
  const provider =
    String(env.AI_PROVIDER || "").toLowerCase().trim() === "openrouter" ||
    (!env.AI_PROVIDER && env.OPENROUTER_API_KEY)
      ? "openrouter"
      : "openai";

  return new Response(
    JSON.stringify({
      ok: true,
      service: "iris",
      provider,
      model:
        provider === "openrouter"
          ? env.OPENROUTER_MODEL || "openai/gpt-5.4-mini"
          : env.OPENAI_MODEL || "gpt-5.5",
      hasDatabase: Boolean(env.DB),
      hasOpenAIKey: Boolean(env.OPENAI_API_KEY),
      hasOpenRouterKey: Boolean(env.OPENROUTER_API_KEY),
      hasMoodleBaseUrl: Boolean(env.MOODLE_BASE_URL),
      hasMoodleCourseId: Boolean(env.MOODLE_COURSE_ID),
      hasMoodleApiToken: Boolean(env.MOODLE_API_TOKEN)
    }),
    {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store"
      }
    }
  );
}
