-- RP Poleas - Encuestas de satisfacción.
-- Safe for a new database. Existing FL tables are not altered or deleted.

create table if not exists survey_responses (
  id integer generated always as identity primary key,
  created_at timestamptz not null default now(),
  customer jsonb not null,
  satisfaction jsonb not null,
  consent boolean not null default false,
  source text not null default 'poleas-rp'
);

create index if not exists survey_responses_created_at_idx on survey_responses (created_at desc);
create index if not exists survey_responses_customer_gin_idx on survey_responses using gin (customer);
create index if not exists survey_responses_source_idx on survey_responses (source);

create table if not exists action_plans (
  id uuid primary key,
  category text not null check (category in ('contactos', 'encuestas', 'instructivos', 'informe')),
  title text not null check (length(btrim(title)) > 0),
  description text,
  original_filename text not null,
  stored_filename text not null unique,
  mime_type text not null,
  file_size bigint not null check (file_size > 0),
  uploaded_by text not null,
  created_at timestamptz not null default now()
);
create index if not exists action_plans_category_created_at_idx on action_plans (category, created_at desc);

-- Seguimiento y control de encuestas (Staff RP). Ver db/migrations/2026-10-seguimiento.sql.
create table if not exists follow_up_companies (
  id uuid primary key,
  name text not null check (length(btrim(name)) > 0),
  name_key text not null,
  segment text not null check (segment in ('venta', 'distribuidores', 'agroindustria', 'oil-gas', 'servicios-industriales')),
  contact_name text,
  email text,
  response_status text not null default 'undefined' check (response_status in ('responded', 'not_responded', 'undefined')),
  wa_maria_jose boolean not null default false,
  wa_sergio boolean not null default false,
  wa_jose boolean not null default false,
  notes text,
  source_row text,
  linked_response_id integer,
  created_at timestamptz not null default now(),
  created_by text not null,
  updated_at timestamptz not null default now(),
  updated_by text not null,
  unique (segment, name_key)
);

create table if not exists follow_up_audit (
  id bigint generated always as identity primary key,
  company_id uuid not null,
  action text not null check (action in ('create', 'update', 'import', 'delete')),
  changes jsonb not null,
  actor text not null,
  at timestamptz not null default now()
);
create index if not exists follow_up_audit_company_idx on follow_up_audit (company_id, at desc);
