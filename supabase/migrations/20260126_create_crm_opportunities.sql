-- CRM Opportunities table
create table if not exists crm_opportunities (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  customer_id uuid not null references customers(id) on delete cascade,
  name text not null,
  description text,
  value numeric,
  stage text not null default 'nuevo', -- nuevo, en_proceso, ganado, perdido
  probability int default 0, -- porcentaje de cierre estimado
  estimated_close_date date,
  owner_id uuid references employees(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_crm_opportunities_company on crm_opportunities(company_id);
create index if not exists idx_crm_opportunities_customer on crm_opportunities(customer_id);
