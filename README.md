# Iris

Iris is PSC Creative College's proposed AI studio for creative learning: a Moodle-connected platform where students can use guided AI tools for critique, practice, technical support, reflection, and course navigation.

Iris is not intended to be a general-purpose chatbot dropped into the college. It should be a controlled learning platform where teachers define the agents, approve the course materials, review usage, and shape AI around creative practice.

## Vision

Iris helps students see their work more clearly.

The name fits PSC because it carries several useful meanings: the eye, the lens, light, colour, perception, and creative judgment. Iris should feel like a studio companion for learning and making, not an automated answer machine.

## First Release Goals

- Launch AI tools from Moodle courses using LTI 1.3 or a staged integration path.
- Provide student-facing chat and creative support agents.
- Let teachers create and manage course-specific agents.
- Ground AI responses in approved PSC resources, assignments, rubrics, policies, and examples.
- Store conversation history, usage, safety flags, and feedback in a separate Iris database.
- Give staff enough analytics to understand common questions, confusing assessment areas, and student support needs.

## What Iris Should Do

- Explain assignments and rubrics without completing the student's work.
- Help students practise creative decision-making.
- Give formative critique against teacher-approved criteria.
- Support technical learning in photography, lighting, digital imaging, screen media, design, and production workflows.
- Simulate industry conversations such as client meetings, pitch feedback, revision requests, and reflective interviews.
- Encourage ethical AI use, citation, disclosure, and process documentation.

## What Iris Should Not Do

- Replace teachers, critiques, or human support.
- Grade final work automatically.
- Make final creative decisions for students.
- Allow unrestricted public chatbot use under the PSC brand.
- Expose OpenAI, Claude, or other model API keys to students or Moodle pages.
- Use student work or conversations for AI model training without explicit institutional approval.

## Repository Structure

```text
.
|-- README.md
|-- PRODUCT_PLAN.md
|-- ARCHITECTURE.md
|-- PRIVACY_AND_SAFETY.md
|-- CONTRIBUTING.md
|-- .env.example
|-- package.json
|-- functions/
|   `-- api/
|       |-- chat.js
|       `-- health.js
|-- migrations/
|   `-- 0001_initial.sql
|-- public/
|   |-- app.js
|   |-- index.html
|   |-- styles.css
|   |-- _headers
|   `-- assets/
|       `-- iris-workspace.png
`-- docs/
    |-- agent-examples.md
    |-- cloudflare-setup.md
    |-- implementation-roadmap.md
    |-- moodle-integration.md
    `-- pilot-plan.md
```

## Prototype

The repository now includes a first Cloudflare Pages prototype:

- Static student chat UI in `public/`.
- Teacher upload UI in `public/teacher/`.
- Pages Functions API in `functions/api/`.
- D1 starter schema in `migrations/0001_initial.sql`.
- OpenRouter or direct OpenAI model calls from the server.
- Teacher resource uploads for text, Markdown, CSV, JSON, Word `.docx`, and text-based PDF files.
- Moodle course sync for approved course materials.
- Demo mode when no model API key is configured.

Cloudflare Pages settings for the prototype:

```text
Framework preset: None
Build command: leave blank
Build output directory: public
```

The live AI call runs server-side through `/api/chat`, so model API keys are not exposed to the browser.

## Recommended Build Shape

Moodle should remain the learning hub. Iris should be a separate web application that Moodle launches securely.

```text
Moodle
  -> course enrolments, roles, activity links

Iris web app
  -> chat, agent builder, resources, analytics, safety review

AI and data layer
  -> model APIs, database, file storage, vector search, logs
```

This keeps the student experience connected to Moodle while avoiding Moodle's limits for modern AI interfaces, document retrieval, analytics, and staff dashboards.

## Likely Technology Choices

The first implementation should stay flexible. A practical stack could be:

- Frontend: Next.js, React, or another modern web framework.
- Backend: Node.js or Python API.
- Authentication: Moodle LTI 1.3 launch first; direct login only for development/admin fallback.
- Database: Postgres, Supabase, Neon, Cloudflare D1, or another managed database.
- File storage: S3-compatible storage, Cloudflare R2, Supabase Storage, or Azure Blob Storage.
- Vector search: pgvector, Cloudflare Vectorize, Pinecone, Weaviate, or Azure AI Search.
- AI models: OpenAI as the first provider, with Anthropic Claude added through a model router.

## Key Documents

- [Product Plan](./PRODUCT_PLAN.md)
- [Architecture](./ARCHITECTURE.md)
- [Privacy and Safety](./PRIVACY_AND_SAFETY.md)
- [Moodle Integration](./docs/moodle-integration.md)
- [Cloudflare Setup](./docs/cloudflare-setup.md)
- [Pilot Plan](./docs/pilot-plan.md)
- [Agent Examples](./docs/agent-examples.md)
- [Implementation Roadmap](./docs/implementation-roadmap.md)

## Public References

- Cogniti documentation: https://cogniti.ai/docs/
- Moodle external tools/LTI documentation: https://docs.moodle.org/
- PSC Creative College: https://www.psc.edu.au/
- OpenAI API documentation: https://platform.openai.com/docs/
- Anthropic API documentation: https://docs.anthropic.com/
