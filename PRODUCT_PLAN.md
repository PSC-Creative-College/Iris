# Product Plan

## Product Summary

Iris is a PSC-branded AI studio for students and teachers. It gives students structured AI support inside their creative courses and gives teachers control over how AI is used, what materials it can reference, and how student interactions are reviewed.

The product should begin as a focused learning support system, then grow into a broader creative practice platform.

## Audience

### Students

Students need a tool that can:

- Help them understand assessment expectations.
- Support technical and creative problem solving.
- Offer formative feedback before submission.
- Practise professional conversations.
- Encourage reflection and process documentation.
- Make AI use feel safe, ethical, and course-relevant.

### Teachers

Teachers need a tool that can:

- Reduce repetitive clarification questions.
- Extend formative support between classes.
- Keep AI aligned with course outcomes and assessment rules.
- Review how students are using AI.
- Identify confusing assessment areas.
- Build AI activities without needing to code.

### Administrators

Administrators need:

- Clear privacy, compliance, and retention settings.
- Usage and cost reporting.
- Safe rollout controls.
- Role-based access.
- A reliable integration path with Moodle.

## Product Principles

1. **Creative judgment stays human.** Iris supports critique and reflection; it does not replace teaching, assessment, or authorship.
2. **Course context matters.** Agents should be grounded in PSC materials, not generic internet-style answers.
3. **Teachers control the brief.** Staff should define the purpose, boundaries, tone, and source material for each agent.
4. **Students should learn process, not shortcuts.** Iris should ask good questions, explain trade-offs, and invite revision.
5. **Safety and transparency are core features.** Logging, flagging, privacy, and disclosure should be part of the product from the start.
6. **Moodle is the doorway, Iris is the workspace.** Moodle handles enrolment and course context; Iris handles the richer AI experience.

## MVP Scope

The first useful version should include:

- Moodle launch path for students and teachers.
- Student chat interface.
- Course-specific AI agents.
- Teacher-facing agent builder.
- Resource upload and retrieval.
- Conversation history.
- Student feedback and flagging.
- Staff review dashboard.
- Basic analytics.
- Admin settings for models, usage limits, and retention.

## MVP Agent Types

- Brief Decoder
- Technical Tutor
- Portfolio Critique Coach
- Design Review Partner
- Client Simulator
- Student Support Concierge

Detailed examples are in [Agent Examples](./docs/agent-examples.md).

## Post-MVP Features

- Image upload critique.
- Portfolio sequence review.
- Voice conversation practice.
- Rubric-aligned critique workflows.
- Student AI sandboxes controlled by teachers.
- Mini interactive tools for creative briefs, shot lists, production plans, and reflective journals.
- Gradebook passback for participation or completion, if educationally appropriate.
- Integration with Microsoft 365, Google Drive, or cloud file storage.

## Non-Goals For The First Version

- Automatic grading.
- Full replacement for Moodle.
- Fully autonomous student intervention.
- Public chatbot access from the PSC website.
- Training a custom foundation model.
- Building every creative workflow before testing student demand.

## Success Metrics

### Student Value

- Students use Iris repeatedly during assessment periods.
- Students report better understanding of briefs and rubrics.
- Students produce more reflective drafts and process notes.
- Students can identify when AI advice is unsuitable or incomplete.

### Teacher Value

- Teachers see fewer repeated clarification questions.
- Teachers can identify confusing assessment language.
- Teachers can create or edit agents without technical help.
- Staff trust the boundaries and review tools.

### Institutional Value

- Usage costs are visible and manageable.
- Privacy and safety settings are documented.
- Pilot courses can expand without rebuilding the platform.
- Moodle integration works reliably enough for normal teaching use.

## User Stories

### Student

- As a student, I can open an AI tool from my Moodle course without a separate login.
- As a student, I can ask for clarification on a brief and receive guidance based on the actual assessment document.
- As a student, I can upload or describe work-in-progress and receive formative critique.
- As a student, I can see reminders about ethical AI use and disclosure.

### Teacher

- As a teacher, I can create an agent for one course or assessment.
- As a teacher, I can upload approved resources for an agent to use.
- As a teacher, I can set boundaries around what the agent should and should not do.
- As a teacher, I can review flagged conversations and common student questions.

### Admin

- As an admin, I can control which courses and users can access Iris.
- As an admin, I can see usage and cost by course.
- As an admin, I can configure retention, deletion, and export rules.
- As an admin, I can disable an agent or course integration quickly.

## Product Risks

- Students may try to use Iris to outsource assessment work.
- Teachers may need support writing effective agent instructions.
- Moodle embedding may feel cramped for rich creative tools.
- AI model costs may rise during assessment periods.
- Source material quality will strongly affect answer quality.
- Privacy expectations must be clear before launch.

## Recommended First Pilot

Start with a small number of motivated teachers and courses. The best pilot shape is:

- 2-3 courses.
- 3-5 agents.
- 6-8 weeks.
- Limited student cohort.
- Weekly review of conversations, flags, and staff feedback.
- End-of-pilot recommendation on whether to expand, adjust, or pause.

