# Cloudflare Setup

This guide sets up the first Iris prototype on Cloudflare Pages with an optional D1 database and AI provider key.

## What Gets Deployed

```text
public/
  Static Iris chat interface

functions/api/
  Cloudflare Pages Functions for chat and health checks

migrations/
  D1 database schema
```

The app works in demo mode before the model API key and database are configured. Demo mode is useful for checking the interface and deployment path.

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
migrations/0003_teacher_resources.sql
```

You can apply them from the Cloudflare dashboard SQL console, or with Wrangler once it is installed:

```bash
wrangler d1 execute iris-prod --file=migrations/0001_initial.sql --remote
wrangler d1 execute iris-prod --file=migrations/0002_seed_agents.sql --remote
wrangler d1 execute iris-prod --file=migrations/0003_teacher_resources.sql --remote
```

The first migration creates the Iris tables. The second migration adds the starter agents used by the first prototype. The third migration adds searchable teacher-uploaded resource chunks.

## 5. Add AI Provider Environment Variables

Iris can call OpenRouter or OpenAI directly. For PSC's pilot, OpenRouter is the recommended path because it lets Iris switch models without changing code.

### Recommended OpenRouter Setup

In the Iris Pages project:

1. Open **Settings**.
2. Open **Environment variables**.
3. Add these production variables:

```text
AI_PROVIDER=openrouter
OPENROUTER_MODEL=openai/gpt-5.4-mini
OPENROUTER_SITE_URL=https://iris-7jo.pages.dev
OPENROUTER_APP_TITLE=Iris PSC AI Studio
```

4. Add this as an encrypted secret:

```text
OPENROUTER_API_KEY
```

Optional per-agent model overrides:

```text
OPENROUTER_MODEL_ASSIGNMENT=openai/gpt-5.4-mini
OPENROUTER_MODEL_TECHNICAL=openai/gpt-5.4-mini
OPENROUTER_MODEL_CRITIQUE=openrouter/auto
OPENROUTER_MODEL_CLIENT=openai/gpt-5.4-mini
```

Older deployments may still have `OPENROUTER_MODEL_BRIEF`; Iris keeps reading it as a fallback for the renamed Assignment Guide agent.

Optional fallback models, tried if the primary model fails:

```text
OPENROUTER_FALLBACK_MODELS=openai/gpt-5.4,anthropic/claude-sonnet-4.5
```

For the pilot, keep `OPENROUTER_MODEL` fixed rather than using `openrouter/auto` everywhere. Fixed models make quality, cost, and debugging easier to understand.

You can add the OpenRouter key with Wrangler:

```bash
wrangler pages secret put OPENROUTER_API_KEY --project-name iris
```

### Direct OpenAI Setup

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

For OpenRouter, check that `hasOpenRouterKey` is `true`.

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
  "provider": "openrouter",
  "model": "openai/gpt-5.4-mini",
  "hasDatabase": true,
  "hasOpenAIKey": false,
  "hasOpenRouterKey": true
}
```

If `hasDatabase`, `hasOpenAIKey`, or `hasOpenRouterKey` is false, the app can still load, but chat logging or live AI responses may not be fully configured. For OpenRouter, `hasOpenRouterKey` is the important one.

## 7. Moodle Later

This first prototype is not yet an LTI tool. The next integration step is to add:

- LTI 1.3 launch validation.
- Moodle user and course mapping.
- Role-based access for students and teachers.
- Agent availability by course.

The current app is intentionally small so the Pages deployment, D1 database, and AI call path can be verified first.

## 8. Teacher Upload Login

The first teacher upload area is available at:

```text
https://your-iris-pages-url.pages.dev/teacher/
```

For production, protect both paths with Cloudflare Access:

```text
/teacher/*
/api/teacher/*
```

Cloudflare Access should send the authenticated teacher email to Iris. You can optionally restrict allowed teachers with:

```text
TEACHER_EMAIL_DOMAIN=psc.edu.au
```

or a comma-separated allowlist:

```text
TEACHER_EMAIL_ALLOWLIST=teacher1@psc.edu.au,teacher2@psc.edu.au
```

For temporary testing before Cloudflare Access is configured, set:

```bash
wrangler pages secret put TEACHER_ACCESS_CODE --project-name iris
```

Then redeploy the Pages project. The `/teacher/` page will accept that code and store it only in the current browser session.

The upload area accepts `.txt`, `.md`, `.csv`, `.json`, `.docx`, and text-based `.pdf` files under 8 MB. Legacy `.doc` files should be saved as `.docx` first. Scanned or image-only PDFs need OCR before Iris can read them.

## 9. Moodle Course Sync

For the first Moodle sync trial, Iris needs a Moodle Web Services token for a limited Moodle user enrolled only in the test course.

Cloudflare production variables:

```text
MOODLE_BASE_URL=https://psc.trainingvc.com.au
MOODLE_COURSE_ID=3308
```

Cloudflare production secret:

```text
MOODLE_API_TOKEN
```

The Moodle service should include at least:

```text
core_webservice_get_site_info
core_course_get_contents
```

In the external service settings, also allow the service to download files. Without file downloads enabled, Moodle can list PDFs in `core_course_get_contents` but will return an `Access control exception` when Iris tries to import the actual PDF bytes.

Teacher Studio can then scan the configured Moodle course, show importable activities/files, and import selected materials into the same searchable Iris resource store used by manual uploads.

If Moodle returns `Course or activity not accessible`, the token works but the Moodle user cannot see the configured course. Enrol the service user in the course and give it a role that can view course content, then scan again.
