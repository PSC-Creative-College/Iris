# Contributing

## Purpose

This repository is for planning and building Iris, PSC Creative College's AI studio for creative learning.

Contributions should keep the project focused on safe, useful, course-connected AI support for students and teachers.

## Working Principles

- Keep student learning at the centre.
- Prefer small, testable changes over broad rewrites.
- Document product decisions when they affect teachers, students, privacy, or Moodle.
- Do not commit API keys, credentials, private student data, or exported conversations.
- Treat course documents, rubrics, student work, and internal PSC material as sensitive unless explicitly approved for public use.

## Documentation Style

- Use plain language.
- Explain decisions, not just features.
- Keep docs practical enough for staff, developers, and project stakeholders.
- When adding technical details, include the reason they matter.

## Suggested Branch Names

```text
docs/product-plan
docs/moodle-integration
feature/lti-launch
feature/agent-builder
feature/chat-history
```

## Commit Guidance

Use short, descriptive commit messages:

```text
Add Moodle integration plan
Define MVP agent examples
Document privacy and safety controls
```

## Sensitive Data

Never commit:

- API keys.
- Database credentials.
- Moodle secrets.
- LTI private keys.
- Student records.
- Conversation exports.
- Unapproved course content.
- Student creative work.

Use environment variables or a secrets manager for credentials.

## Review Checklist

Before merging changes, check:

- Does this support the Iris product principles?
- Does this preserve teacher control?
- Does this protect student privacy?
- Does this fit the Moodle-connected architecture?
- Does this avoid accidental assessment outsourcing?
- Are any new risks documented?

