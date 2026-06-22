create table if not exists conversations (
  id text primary key,
  moodle_user_id text,
  moodle_course_id text,
  agent_key text not null,
  title text,
  created_at text not null default current_timestamp,
  updated_at text not null default current_timestamp
);

create table if not exists messages (
  id text primary key,
  conversation_id text not null references conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  model text,
  mode text not null default 'live',
  created_at text not null default current_timestamp
);

create table if not exists agents (
  id text primary key,
  course_id text,
  agent_key text not null,
  name text not null,
  purpose text not null,
  instructions text,
  status text not null default 'draft',
  created_at text not null default current_timestamp,
  updated_at text not null default current_timestamp
);

create table if not exists flags (
  id text primary key,
  conversation_id text not null references conversations(id) on delete cascade,
  message_id text references messages(id) on delete set null,
  flag_type text not null,
  severity text not null default 'medium',
  notes text,
  status text not null default 'new',
  created_at text not null default current_timestamp,
  reviewed_at text
);

create table if not exists resources (
  id text primary key,
  course_id text,
  agent_key text,
  title text not null,
  source_type text not null default 'manual',
  storage_url text,
  processing_status text not null default 'pending',
  created_at text not null default current_timestamp
);

create index if not exists idx_messages_conversation_id on messages(conversation_id);
create index if not exists idx_conversations_agent_key on conversations(agent_key);
create index if not exists idx_flags_conversation_id on flags(conversation_id);

