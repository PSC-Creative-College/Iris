# Implementation Roadmap

## Build Strategy

Build Iris in small vertical slices. Each slice should connect the user interface, data, model call, logging, and staff controls enough to learn from real use.

Avoid spending the first phase on a large generic platform. The fastest path to clarity is a working course-specific AI tool launched from Moodle.

## Phase 0: Repository And Decisions

### Outcomes

- Documentation baseline.
- Initial technical decisions.
- Pilot courses identified.
- Privacy and governance questions listed.

### Tasks

- Confirm MVP scope.
- Confirm likely hosting path.
- Confirm whether OpenAI, Claude, or both will be used.
- Confirm Moodle admin access and LTI support.
- Confirm pilot staff.
- Identify initial course resources.

## Phase 1: Prototype

### Outcomes

- Working web app.
- One student chat interface.
- One hard-coded course agent.
- Server-side AI model call.
- Basic conversation storage.

### Features

- Home screen.
- Student chat screen.
- One agent configuration in code or database.
- OpenAI API integration.
- Basic safety system instructions.
- Conversation persistence.
- Simple admin-only conversation viewer.

### Notes

At this stage, Moodle integration can be simulated if needed. The goal is to validate the core student experience quickly.

## Phase 2: Course-Grounded Agent

### Outcomes

- Iris can answer using approved PSC course documents.
- Teachers can upload or attach resources.

### Features

- Resource upload.
- Document processing.
- Text extraction.
- Chunking and embeddings.
- Vector search.
- Retrieved source snippets included in model prompts.
- Basic source trace shown to students or staff.

### Risks

- Poor source documents will produce poor answers.
- Rubric language may need rewriting for AI-friendly interpretation.
- Long PDFs and image-heavy documents may need special processing.

## Phase 3: Moodle LTI Proof Of Concept

### Outcomes

- Moodle can securely launch Iris.
- Iris can identify user, role, course, and context.

### Features

- LTI 1.3 registration.
- Launch validation.
- User and course mapping.
- Role-based access.
- Course-specific agent display.
- Development and production environment separation.

### Acceptance Criteria

- A student launching from Moodle sees only student tools.
- A teacher launching from Moodle sees teacher controls for that course.
- A user not enrolled in a course cannot access that course's agents.
- API keys remain server-side.

## Phase 4: Teacher Agent Builder

### Outcomes

- Teachers can create and edit agents without developer help.

### Features

- Agent list by course.
- Create/edit agent screen.
- Agent type templates.
- Instructions editor.
- Student introduction editor.
- Resource selection.
- Publish/draft status.
- Test chat as teacher.

### Templates

- Brief Decoder.
- Technical Tutor.
- Portfolio Critique Coach.
- Client Simulator.
- Student Support Concierge.

## Phase 5: Pilot Release

### Outcomes

- Iris is ready for limited real student use.

### Features

- Stable Moodle launch.
- Student-facing agent list.
- Conversation history.
- Feedback and flagging.
- Staff review dashboard.
- Usage analytics.
- Cost tracking.
- Basic admin settings.
- Privacy notice.
- Emergency disable switch for agents.

### Pilot Gate

Do not launch until:

- Staff can review flags.
- Agents have been tested with likely and adversarial prompts.
- Privacy notice is ready.
- Students understand AI use boundaries.
- Moodle launch has been tested with student and teacher roles.

## Phase 6: Post-Pilot Improvements

### Possible Features

- Image upload critique.
- Portfolio sequence tools.
- Voice role-play.
- Better analytics.
- Agent versioning.
- Prompt library.
- Student AI sandboxes.
- Gradebook completion passback.
- Microsoft 365 or Google Drive integration.
- Department-level dashboards.

## Suggested MVP Stack

This is a starting recommendation, not a final decision.

### Web App

- Next.js or similar modern framework.
- Responsive layout optimized for desktop and laptop use first.
- Mobile-friendly chat for quick student questions.

### Backend

- Server-side API routes or a separate Node/Python backend.
- LTI validation handled server-side.
- Model provider calls handled server-side.

### Database

- Postgres if possible.
- pgvector if using Postgres for embeddings.
- Managed database preferred for backups and reliability.

### Storage

- S3-compatible object storage.
- Separate buckets or prefixes for course resources and exports.

### AI Providers

- OpenAI first.
- Claude as second provider after MVP or for selected agents.
- Keep a model router from the beginning.

## Environments

Use separate environments:

- Local development.
- Staging/test Moodle.
- Production.

Each environment should have separate:

- Database.
- Storage.
- API keys.
- LTI registration.
- Logging.

## Monitoring

Minimum monitoring:

- App errors.
- Failed Moodle launches.
- Model API errors.
- Slow responses.
- Token usage.
- Cost by course.
- Flagged conversations.

## Launch Readiness Checklist

- LTI launch works for student and teacher roles.
- Agents have been reviewed by course staff.
- Resources are current.
- Privacy notice is visible.
- Conversation retention is configured.
- Admin can disable an agent.
- Teacher can review flagged conversations.
- Cost limits or alerts are configured.
- Basic support instructions exist.

