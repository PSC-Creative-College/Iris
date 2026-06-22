# Cloudflare Setup

This guide sets up the first Iris prototype on Cloudflare Pages with an optional D1 database and OpenAI API key.

## What Gets Deployed

```text
public/
  Static Iris chat interface

functions/api/
  Cloudflare Pages Functions for chat and health checks

migrations/
  D1 database schema
```

The app works in demo mode before the OpenAI key and database are configured. Demo mode is useful for checking the interface and deployment path.

## 1. Connect GitHub To Cloudflare Pages

In Cloudflare:

1. Open **Workers & Pages**.
2. Choose **Create**.
3. Choose **Pages**.
4. Choose **Connect to Git**.
5. Select the GitHub repository:

```text
PSC-Creative-College/Iris
```

6. Use these build settings:

```text
Framework preset: None
Build command: leave blank
Build output directory: public
Root directory: /
```

7. Deploy.

Cloudflare will publish a temporary URL like:

```text
https://iris.pages.dev
```

The exact URL depends on the project name selected in Cloudflare.

## 2. Create The D1 Database

In Cloudflare:

1. Open **Workers & Pages**.
2. Open **D1 SQL Database**.
3. Create a database named:

```text
iris-prod
```

For development or staging, also create:

```text
iris-dev
```

## 3. Bind D1 To The Pages Project

In the Iris Pages project:

1. Open **Settings**.
2. Open **Functions** or **Bindings**.
3. Add a D1 database binding.
4. Use this binding name:

```text
DB
```

5. Select:

```text
iris-prod
```

The function code expects the binding to be named `DB`.

## 4. Apply The Database Migration

Apply the SQL files in:

```text
migrations/0001_initial.sql
migrations/0002_seed_agents.sql
```

You can apply them from the Cloudflare dashboard SQL console, or with Wrangler once it is installed:

```bash
wrangler d1 execute iris-prod --file=migrations/0001_initial.sql --remote
wrangler d1 execute iris-prod --file=migrations/0002_seed_agents.sql --remote
```

The first migration creates the Iris tables. The second migration adds the starter agents used by the first prototype.

## 5. Add OpenAI Environment Variables

In the Iris Pages project:

1. Open **Settings**.
2. Open **Environment variables**.
3. Add:

```text
OPENAI_API_KEY
OPENAI_MODEL
```

Recommended starting value:

```text
OPENAI_MODEL=gpt-5.5
```

The API key must only be stored in Cloudflare, not in the browser code and not in GitHub.

You can confirm whether the key is active by visiting:

```text
https://your-iris-pages-url.pages.dev/api/health
```

If `hasOpenAIKey` is `false`, check that `OPENAI_API_KEY` was added to the **production** Pages environment or add it with Wrangler:

```bash
wrangler pages secret put OPENAI_API_KEY --project-name iris
```

After changing Pages environment variables or secrets, redeploy the Pages project so the live function receives the new values.

## 6. Check The Health Endpoint

After deployment, open:

```text
https://your-iris-pages-url.pages.dev/api/health
```

Expected shape:

```json
{
  "ok": true,
  "service": "iris",
  "hasDatabase": true,
  "hasOpenAIKey": true
}
```

If `hasDatabase` or `hasOpenAIKey` is false, the app can still load, but chat logging or live AI responses are not fully configured.

## 7. Moodle Later

This first prototype is not yet an LTI tool. The next integration step is to add:

- LTI 1.3 launch validation.
- Moodle user and course mapping.
- Role-based access for students and teachers.
- Agent availability by course.

The current app is intentionally small so the Pages deployment, D1 database, and AI call path can be verified first.
