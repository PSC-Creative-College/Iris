# Moodle Integration

## Recommended Approach

Iris should integrate with Moodle as an external learning tool using LTI 1.3. Moodle remains the place where students start. Iris handles the AI experience after launch.

The first production-grade integration should avoid a simple iframe-only embed. A plain iframe can display a page, but it does not provide the secure user, course, role, and activity context Iris needs.

## Integration Goals

- Students launch Iris from the correct Moodle course.
- Iris knows whether the user is a student, teacher, or admin.
- Iris knows the Moodle course and activity context.
- Teachers can attach specific Iris agents to specific courses or assessment activities.
- Students do not need a separate Iris password.
- API keys and model credentials stay outside Moodle.

## Basic Flow

```text
1. Teacher adds an Iris activity to a Moodle course.
2. Student opens the course in Moodle.
3. Student clicks the Iris activity.
4. Moodle sends a signed LTI launch request to Iris.
5. Iris validates the request.
6. Iris creates or updates the local user and course mapping.
7. Iris opens the correct agent or workspace.
8. Student interacts with Iris.
9. Iris stores usage, messages, and safety events in its own database.
```

## User Experience Options

### Option 1: Embedded In Moodle

The Iris interface appears inside the Moodle page.

Best for:

- Simple Q&A agents.
- Small activities.
- Lower-friction launch.

Limitations:

- Moodle layout can feel cramped.
- Image critique and portfolio tools may need more room.
- Browser and iframe restrictions can create extra friction.

For the PSC pilot, Cloudflare Pages must allow Moodle to frame Iris. The current allowed Moodle host is:

```text
https://psc.trainingvc.com.au
```

If the student chatbot is embedded in Moodle, protect only the teacher paths with Cloudflare Access. Do not put the whole Iris site behind staff-only login.

### Option 2: New Tab

Moodle opens Iris in a new browser tab.

Best for:

- Rich creative tools.
- Portfolio upload and review.
- Image-based critique.
- Teacher dashboards.

Limitations:

- Feels slightly less embedded.
- Requires clear PSC branding so students know they are still in the official learning environment.

### Option 3: Hybrid

Moodle contains a simple Iris launch activity, and the full Iris workspace opens in a dedicated PSC-branded page.

Recommended for PSC.

This gives students a clean starting point in Moodle and gives Iris enough room to become a proper creative AI studio.

## Moodle Admin Setup

The Moodle administrator will need to configure Iris as an external tool.

Typical setup includes:

- Tool name: Iris
- Tool URL / launch URL
- Public key or keyset URL
- Login initiation URL
- Redirect URI
- Client ID
- Deployment ID
- Tool permissions
- Launch container preference

Exact settings depend on the final LTI library and hosting environment.

## Data Sent From Moodle

Iris should request only the information needed for learning and access control.

Likely required:

- Moodle user ID
- User name
- User email
- Course ID
- Course name
- Role in course
- Activity/context ID
- LTI issuer, client ID, and deployment ID

Optional later:

- Groups.
- Assignment context.
- Gradebook line item for participation or completion.
- Names and roles service for teacher dashboards.

## Local Mapping

Iris should maintain its own records that map Moodle data to Iris data.

```text
Moodle course ID -> Iris course
Moodle user ID -> Iris user
Moodle activity/context ID -> Iris launch context
Iris course -> enabled agents
Iris agent -> resources and settings
```

This lets Iris keep stable internal records even if Moodle names, labels, or course structures change.

## Teacher Workflow

Initial workflow:

```text
1. Teacher requests Iris for a Moodle course.
2. Admin enables Iris for the course.
3. Teacher opens Iris from Moodle.
4. Iris recognizes the teacher role.
5. Teacher creates or edits agents.
6. Teacher uploads approved course documents.
7. Teacher publishes the agent for students.
8. Students access the agent from Moodle.
```

Later workflow:

```text
1. Teacher adds an Iris activity directly in Moodle.
2. Teacher selects which agent to attach.
3. Iris activity appears in the weekly course area or assessment section.
```

## Teacher Login During The Pilot

Use Cloudflare Access with PSC Microsoft sign-in for Teacher Studio:

```text
https://iris-7jo.pages.dev/teacher/*
https://iris-7jo.pages.dev/api/teacher/*
```

Teachers authenticate with their PSC account before Cloudflare lets the request reach Iris. Iris then records uploads and Moodle imports against the authenticated teacher email.

Keep the temporary `TEACHER_ACCESS_CODE` only while Access is being tested. Remove it from production when Microsoft sign-in works.

## Student Workflow

```text
1. Student logs into Moodle.
2. Student opens the relevant course.
3. Student clicks an Iris activity.
4. Iris opens the approved tool for that course.
5. Student asks questions or uses a creative support workflow.
6. Student can flag responses or provide feedback.
```

## Gradebook Integration

Gradebook integration is not recommended for the first version unless there is a clear educational reason.

Possible future uses:

- Mark participation complete after a student completes a practice chat.
- Send completion status for a required AI literacy activity.
- Record a non-graded reflection task.

Avoid:

- Sending AI-generated scores as grades.
- Automatically grading creative work.
- Using chat quantity as a proxy for learning quality.

## Moodle Limitations To Plan Around

- Moodle plugin development can be slow compared with building a separate app.
- Rich chat interfaces may be cramped inside course pages.
- File preview, portfolio review, and image critique need more interface space than Moodle usually provides.
- AI usage analytics are better handled in a dedicated database.
- Model API calls and secrets should not live in Moodle page code.

## Development Stages

### Stage 1: Development Launch

- Build Iris with local login or a temporary admin login.
- Simulate Moodle user and course context.
- Build first agents and chat experience.

### Stage 2: LTI Proof Of Concept

- Configure Moodle test course.
- Register Iris as an external tool.
- Validate launches.
- Map users, roles, courses, and activities.
- Display a simple agent to students.

### Stage 3: Pilot Integration

- Enable Iris in selected courses.
- Add teacher dashboard.
- Add course resources.
- Run student pilot.
- Monitor usage and safety.

### Stage 4: Production Integration

- Harden LTI validation.
- Add admin controls.
- Add backup and monitoring.
- Document support processes.
- Expand course-by-course.

## Open Questions

- Which Moodle version is PSC currently running?
- Who administers Moodle and external tools?
- Can PSC enable LTI 1.3 external tools without custom plugin development?
- Should Iris open embedded, in a new tab, or hybrid?
- Does PSC want Microsoft 365 or Google Drive document integration?
- What data retention rules apply to student conversations?
- Should students see their own conversation archive?
