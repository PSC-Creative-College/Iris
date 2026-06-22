# Privacy And Safety

## Purpose

Iris will handle student interactions, course content, assessment materials, and potentially creative work-in-progress. Privacy and safety should be designed into the system from the start, not added after the pilot.

This document defines the first set of principles and controls. It is not a legal policy. PSC should review it against institutional requirements before launch.

## Guiding Principles

1. **Students should know when they are using AI.**
2. **Student data should only be used for the learning purpose described.**
3. **Course resources should only be used in approved course contexts.**
4. **Staff should be able to review safety issues without casually surveilling students.**
5. **Iris should support learning, not misconduct.**
6. **The system should be easy to pause or restrict if something goes wrong.**

## Data Iris May Collect

- Moodle user identity needed for access control.
- Moodle course and activity context.
- Student messages.
- AI responses.
- Uploaded resources.
- Student feedback and flags.
- Usage metadata.
- Model and token usage.
- Safety review notes.

## Data Iris Should Avoid Collecting In The MVP

- Unnecessary demographic data.
- Sensitive personal information unrelated to learning.
- Payment information.
- Personal documents outside course work.
- Full Moodle data beyond what the launch requires.
- Browser tracking beyond basic security and session needs.

## Model Provider Data Rules

Iris should call AI providers from the server, not the student's browser.

Requirements before launch:

- Confirm whether prompts and outputs are used for model training.
- Confirm data retention terms.
- Confirm data processing location where possible.
- Confirm whether abuse monitoring is performed by the provider.
- Confirm deletion and export options.
- Document the selected provider terms for PSC.

Preferred policy:

- Student data and PSC course material should not be used to train external foundation models.
- API keys should be stored only in secure server-side configuration.
- Logs sent to model providers should be minimized where possible.

## Student Transparency

Students should see a short notice before first use:

```text
Iris is PSC's AI learning studio. Your messages may be stored so your teachers and PSC can support learning, review safety issues, and improve course resources. Do not enter sensitive personal information. AI responses can be wrong, incomplete, or biased. You remain responsible for your submitted work and must follow your course's AI use rules.
```

Each agent should also explain its boundaries in plain language.

## Academic Integrity

Iris should be designed to support allowed learning activities:

- Understanding a brief.
- Comparing ideas.
- Practising critique.
- Planning a shoot or project.
- Reflecting on process.
- Improving technical understanding.
- Preparing questions for class.

Iris should avoid:

- Writing final submissions for students.
- Producing assessable reflection journals without student authorship.
- Creating false process evidence.
- Inventing citations.
- Circumventing assessment conditions.

## Safe Agent Behaviour

Every agent should include boundaries such as:

- Do not complete the student's assessment for them.
- Ask clarifying questions when needed.
- Ground answers in approved course resources where possible.
- Identify uncertainty.
- Encourage students to check with their teacher for assessment-critical decisions.
- Give formative feedback rather than final marks.
- Encourage responsible disclosure of AI assistance.

## Flagging And Review

Students and staff should be able to flag:

- Harmful or unsafe advice.
- Incorrect course information.
- Academic integrity concerns.
- Bias or offensive content.
- Privacy concerns.
- Technical failure.

Staff review should include:

- Status: new, reviewing, resolved, dismissed.
- Severity: low, medium, high.
- Notes.
- Action taken.
- Whether the agent or resource needs updating.

## Retention

PSC should choose retention periods before launch.

Suggested defaults:

- Conversation logs: retain during the course plus a defined review period.
- Safety flags: retain longer where required for institutional records.
- Uploaded course resources: retain while the course or agent is active.
- Student-uploaded files: avoid in MVP unless needed; if enabled, set a short retention period.
- Analytics aggregates: retain without direct student identifiers where possible.

## Access Controls

### Students

- Can access their own conversations.
- Can use agents available to their Moodle courses.
- Cannot view other students' chats.
- Cannot create public agents in the MVP.

### Teachers

- Can manage agents and resources for their courses.
- Can review conversations linked to their courses if PSC policy allows it.
- Can see aggregate analytics.

### Admins

- Can manage integrations, models, retention, and platform-level safety.
- Can disable courses, agents, or provider access.

## Security Controls

Minimum requirements:

- LTI launch validation.
- Server-side API keys only.
- Encrypted transport.
- Database backups.
- Role-based access checks.
- Audit logs for admin and teacher actions.
- Rate limits.
- File type restrictions.
- Malware scanning or a safe upload workflow if student uploads are enabled.
- Separate development and production environments.

## Human Escalation

Some student requests should trigger human support pathways rather than AI answers, such as:

- Mental health crisis or self-harm.
- Serious misconduct.
- Harassment or abuse.
- Legal or medical advice.
- Urgent campus safety issues.
- Formal complaints.

Iris should provide clear escalation language and direct students to appropriate PSC support channels.

## Pre-Launch Checklist

- Privacy notice reviewed.
- AI use policy aligned with course rules.
- Model provider terms reviewed.
- Retention period selected.
- Teacher review permissions approved.
- Pilot teachers trained.
- Agents tested with adversarial prompts.
- Resource documents checked for accuracy.
- Student support escalation paths configured.
- Admin shutdown process tested.

