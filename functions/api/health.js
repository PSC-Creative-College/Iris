export async function onRequestGet(context) {
  return new Response(
    JSON.stringify({
      ok: true,
      service: "iris",
      hasDatabase: Boolean(context.env.DB),
      hasOpenAIKey: Boolean(context.env.OPENAI_API_KEY)
    }),
    {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store"
      }
    }
  );
}

