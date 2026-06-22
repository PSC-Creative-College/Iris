# Architecture

## Overview

Iris should be built as a separate web application that integrates with Moodle. Moodle remains the trusted learning environment. Iris provides the AI-specific interface, workflows, database, analytics, and integrations.

```text
Student or teacher
  -> Moodle course
  -> LTI launch
  -> Iris web app
  -> Iris API
  -> database, file storage, vector search, model provider
```

## Core Components

### Moodle

Moodle provides:

- User authentication.
- Course enrolment context.
- Student, teacher, and admin roles.
- Course activity placement.
- Launch links to Iris.
- Optional gradebook integration later.

### Iris Web App

The web app provides:

- Student chat interface.
- Teacher dashboard.
- Agent builder.
- Resource management.
- Conversation history.
- Feedback and flagging.
- Analytics.
- Admin settings.

### Iris API

The API provides:

- LTI launch validation.
- Session management.
- Authorization checks.
- Agent orchestration.
- Retrieval over approved course resources.
- AI model calls.
- Usage logging.
- Safety workflows.
- Admin operations.

### Database

The database stores:

- Users known through Moodle launches.
- Courses and Moodle context mappings.
- Roles and permissions.
- Agents and agent versions.
- Uploaded resource metadata.
- Conversations and messages.
- Feedback and flags.
- Usage and cost events.
- Audit events.

### File Storage

File storage holds:

- Uploaded course documents.
- Assessment briefs.
- Rubrics.
- Examples and reference material.
- Student-uploaded files, if enabled.
- Generated exports or reports.

### Vector Search

Vector search supports retrieval-augmented generation. When a student asks a question, Iris finds relevant passages from approved documents and passes them to the model as context.

Examples:

- Assessment brief sections.
- Rubric criteria.
- Weekly lecture notes.
- Equipment guides.
- Studio safety policies.
- Referencing and disclosure rules.

### Model Providers

Iris should use a provider abstraction instead of hard-coding one AI company.

Recommended first setup:

- OpenAI as the primary provider for MVP.
- Optional Anthropic Claude provider for creative critique and long-form reflective support.
- Embeddings provider selected separately from chat provider.

```text
Iris Agent Runtime
  -> Model Router
      -> OpenAI
      -> Anthropic Claude
      -> Future provider
```

## Data Model Sketch

### User

- id
- moodle_user_id
- name
- email
- role
- created_at
- last_seen_at

### Course

- id
- moodle_course_id
- name
- code
- status
- created_at

### Agent

- id
- course_id
- name
- description
- type
- system_instructions
- student_intro
- model_policy
- retrieval_policy
- status
- created_by
- updated_at

### Resource

- id
- course_id
- agent_id
- title
- source_type
- file_url
- processing_status
- visibility
- created_by
- created_at

### Conversation

- id
- course_id
- agent_id
- user_id
- moodle_context_id
- status
- created_at
- updated_at

### Message

- id
- conversation_id
- role
- content
- retrieved_context_ids
- model
- token_count
- cost_estimate
- created_at

### Flag

- id
- conversation_id
- message_id
- flag_type
- severity
- submitted_by
- notes
- status
- reviewed_by
- reviewed_at

## Request Flow

```text
1. Student opens Moodle course.
2. Student clicks Iris activity.
3. Moodle sends an LTI launch to Iris.
4. Iris validates the launch signature.
5. Iris maps the Moodle user and course to local records.
6. Iris creates a secure session.
7. Student selects or opens the assigned agent.
8. Student sends a message.
9. Iris retrieves relevant approved resources.
10. Iris builds the model request with agent instructions and retrieved context.
11. Model returns a response.
12. Iris applies safety checks and logs usage.
13. Student receives the answer.
```

## Authorization Model

### Student

- Use agents available to their enrolled courses.
- View their own conversations.
- Flag responses.
- Submit feedback.

### Teacher

- Manage agents in their courses.
- Upload and manage course resources.
- Review conversations for their courses.
- View course analytics.
- Export course-level reports, subject to policy.

### Admin

- Manage platform settings.
- Manage integrations.
- Configure model providers.
- Set usage limits.
- Manage retention and deletion.
- View institution-level analytics.

## Deployment Options

### Option A: Cloudflare-Centric

Useful for a lightweight, globally fast MVP.

- Cloudflare Workers or Pages for app/API.
- Cloudflare D1 or external Postgres for database.
- Cloudflare R2 for storage.
- Cloudflare Vectorize for retrieval.
- OpenAI/Claude API through server-side calls.

Pros:

- Fast to deploy.
- Lower operational overhead.
- Good for simple API and edge delivery.

Cons:

- Some teams may prefer conventional Postgres tooling.
- Data residency and compliance need careful review.
- LTI libraries and background processing may be easier elsewhere.

### Option B: Supabase + Web App

Useful for rapid product development.

- Next.js or similar frontend.
- Supabase Postgres and Auth helpers.
- Supabase Storage.
- pgvector.
- Server-side API routes or separate backend.

Pros:

- Strong developer experience.
- Postgres is flexible.
- pgvector keeps retrieval close to the main data.

Cons:

- Need to confirm institutional privacy and region requirements.
- Moodle LTI integration still requires custom server logic.

### Option C: Azure-Centric

Useful if PSC needs institutional compliance and Australian region hosting.

- Azure App Service or Container Apps.
- Azure Database for PostgreSQL.
- Azure Blob Storage.
- Azure AI Search.
- Azure OpenAI, if available to the institution.

Pros:

- Strong enterprise controls.
- Good fit for Microsoft-oriented institutions.
- Better story for data residency and governance.

Cons:

- More setup and administration.
- Higher complexity for a small pilot.

## Recommended Path

Start with the simplest deployment that can support:

- Secure Moodle launch.
- A real database.
- File upload and retrieval.
- Server-side model API calls.
- Audit logging.
- Admin controls.

Avoid over-building infrastructure until the pilot proves which workflows matter most.

## Operational Needs

- Backups.
- Error monitoring.
- Usage and cost alerts.
- Rate limits.
- Model fallback strategy.
- Admin emergency shutdown for agents.
- Regular review of flagged responses.
- Documentation for teachers creating agents.

