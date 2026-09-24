-- Poleas RP - Encuestas de satisfacción.
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
  category text not null check (category in ('venta', 'distribuidores', 'oil-gas', 'agroindustria', 'servicios-industriales')),
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
