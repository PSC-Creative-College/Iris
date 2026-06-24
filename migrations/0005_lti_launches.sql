create table if not exists lti_states (
  state text primary key,
  nonce text not null,
  issuer text,
  client_id text,
  target_link_uri text,
  created_at text not null,
  expires_at text not null
);

create index if not exists idx_lti_states_expires_at on lti_states(expires_at);

create table if not exists lti_sessions (
  id text primary key,
  moodle_issuer text,
  moodle_user_id text not null,
  user_name text,
  user_email text,
  moodle_course_id text,
  course_title text,
  course_label text,
  roles text,
  deployment_id text,
  resource_link_id text,
  resource_link_title text,
  created_at text not null,
  expires_at text not null,
  last_seen_at text not null
);

create index if not exists idx_lti_sessions_user on lti_sessions(moodle_user_id);
create index if not exists idx_lti_sessions_course on lti_sessions(moodle_course_id);
create index if not exists idx_lti_sessions_expires_at on lti_sessions(expires_at);
