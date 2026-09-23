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
