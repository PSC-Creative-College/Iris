alter table resources add column uploaded_by text;
alter table resources add column file_name text;
alter table resources add column mime_type text;
alter table resources add column byte_size integer;
alter table resources add column summary text;
alter table resources add column updated_at text;

create table if not exists resource_chunks (
  id text primary key,
  resource_id text not null references resources(id) on delete cascade,
  chunk_index integer not null,
  content text not null,
  word_count integer not null default 0,
  created_at text not null default current_timestamp
);

create index if not exists idx_resource_chunks_resource_id on resource_chunks(resource_id);
create index if not exists idx_resources_agent_key on resources(agent_key);
create index if not exists idx_resources_uploaded_by on resources(uploaded_by);

