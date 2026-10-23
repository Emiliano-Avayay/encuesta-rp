-- Módulo Seguimiento. No destructiva: solo crea tablas nuevas si no existen.
-- No toca survey_responses ni action_plans.
begin;
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
  action text not null check (action in ('create', 'update', 'import')),
  changes jsonb not null,
  actor text not null,
  at timestamptz not null default now()
);
create index if not exists follow_up_audit_company_idx on follow_up_audit (company_id, at desc);
commit;
