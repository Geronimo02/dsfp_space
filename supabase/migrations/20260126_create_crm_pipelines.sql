-- CRM Pipelines table
create table if not exists crm_pipelines (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  name text not null,
  stages text[] not null default array['nuevo','en_proceso','ganado','perdido'],
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_crm_pipelines_company on crm_pipelines(company_id);

-- Agregar pipeline_id a oportunidades
alter table crm_opportunities add column if not exists pipeline_id uuid references crm_pipelines(id);
create index if not exists idx_crm_opportunities_pipeline on crm_opportunities(pipeline_id);