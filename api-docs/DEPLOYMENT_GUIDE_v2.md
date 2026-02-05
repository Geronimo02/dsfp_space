# Deployment Guide - DSFP Space API v2.0 Enterprise

**Last Updated:** January 30, 2026  
**Environment:** Supabase Edge Functions (Deno)  
**Status:** Production Ready

---

## Quick Start

### Prerequisites
- Supabase project created
- Service Role Key generated
- Deno CLI installed (optional, for local testing)
- PostgreSQL database provisioned

### Deployment Steps (5 minutes)

#### Step 1: Update Environment Variables

Create `.env.local` in project root:
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

#### Step 2: Copy API Files

Copy the following files to Supabase functions:
```bash
# Navigate to functions directory
cd supabase/functions/

# Core utilities (already in place)
# - _shared/cors.ts
# - _shared/http.ts
# - _shared/auth.ts
# - _shared/logger.ts
# - _shared/permissions.ts
# - _shared/audit.ts
# - _shared/rateLimit.ts
# - _shared/pagination.ts
# - _shared/router.ts
# - _shared/validation.ts
# - _shared/validation-extended.ts
# - _shared/webhooks.ts

# API endpoints
# - api-v1/index-extended.ts (rename to index.ts to replace)
```

#### Step 3: Deploy to Supabase

```bash
# Using Supabase CLI
supabase functions deploy api-v1

# Or manually via Supabase Dashboard:
# 1. Go to Functions > Create Function
# 2. Name: api-v1
# 3. Paste content from index-extended.ts
# 4. Deploy
```

#### Step 4: Verify Deployment

```bash
# Test health endpoint
curl https://your-supabase.functions.supabase.co/api-v1/health

# Should return:
# {"status":"ok","timestamp":"2026-01-30T15:45:00Z"}
```

---

## Database Schema Setup

### Required Tables

Run these migrations in Supabase SQL Editor:

```sql
-- Companies
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  tax_id TEXT UNIQUE,
  plan TEXT DEFAULT 'professional',
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Users (use Supabase Auth)
-- This links to auth.users automatically

-- Company Users (junction table)
CREATE TABLE company_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_company_users_user_id ON company_users(user_id);
CREATE INDEX idx_company_users_company_id ON company_users(company_id);

-- Role Permissions
CREATE TABLE role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  module TEXT NOT NULL,
  can_view BOOLEAN DEFAULT FALSE,
  can_create BOOLEAN DEFAULT FALSE,
  can_edit BOOLEAN DEFAULT FALSE,
  can_delete BOOLEAN DEFAULT FALSE,
  can_export BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_role_permissions_company_role ON role_permissions(company_id, role);
CREATE INDEX idx_role_permissions_module ON role_permissions(module);

-- Audit Logs
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  resource TEXT NOT NULL,
  resource_id TEXT,
  metadata JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_company_user ON audit_logs(company_id, user_id, created_at DESC);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource, created_at DESC);

-- Products
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  cost DECIMAL(10,2),
  sku TEXT UNIQUE,
  stock INTEGER DEFAULT 0,
  min_stock INTEGER DEFAULT 10,
  max_stock INTEGER DEFAULT 1000,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_products_company_id ON products(company_id);
CREATE INDEX idx_products_sku ON products(sku);

-- Customers
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  tax_id TEXT,
  address TEXT,
  city TEXT,
  country TEXT,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_customers_company_id ON customers(company_id);
CREATE INDEX idx_customers_tax_id ON customers(tax_id);

-- Sales
CREATE TABLE sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  total DECIMAL(10,2) NOT NULL,
  tax DECIMAL(10,2),
  discount DECIMAL(10,2),
  payment_method TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sales_company_id ON sales(company_id);
CREATE INDEX idx_sales_customer_id ON sales(customer_id);

-- Sale Items
CREATE TABLE sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  tax DECIMAL(10,2)
);

CREATE INDEX idx_sale_items_sale_id ON sale_items(sale_id);

-- Suppliers
CREATE TABLE suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  tax_id TEXT,
  condicion_iva TEXT,
  address TEXT,
  payment_terms TEXT,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_suppliers_company_id ON suppliers(company_id);

-- Purchases
CREATE TABLE purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  invoice_number TEXT,
  receipt_date TIMESTAMPTZ,
  payment_method TEXT,
  status TEXT DEFAULT 'pending',
  subtotal DECIMAL(10,2),
  tax DECIMAL(10,2),
  discount DECIMAL(10,2),
  total DECIMAL(10,2),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_purchases_company_id ON purchases(company_id);
CREATE INDEX idx_purchases_supplier_id ON purchases(supplier_id);

-- Purchase Items
CREATE TABLE purchase_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id UUID NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  tax DECIMAL(10,2)
);

CREATE INDEX idx_purchase_items_purchase_id ON purchase_items(purchase_id);

-- Warehouses
CREATE TABLE warehouses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT UNIQUE,
  address TEXT,
  manager_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_warehouses_company_id ON warehouses(company_id);

-- Warehouse Stock
CREATE TABLE warehouse_stock (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(warehouse_id, product_id)
);

CREATE INDEX idx_warehouse_stock_warehouse_id ON warehouse_stock(warehouse_id);

-- Warehouse Transfers
CREATE TABLE warehouse_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  from_warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  to_warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  transfer_date TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'completed',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_warehouse_transfers_company_id ON warehouse_transfers(company_id);

-- Employees
CREATE TABLE employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  document TEXT,
  hire_date DATE,
  role TEXT,
  salary DECIMAL(10,2),
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_employees_company_id ON employees(company_id);

-- Expenses
CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  expense_date DATE,
  category TEXT,
  payment_method TEXT,
  tax DECIMAL(10,2),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_expenses_company_id ON expenses(company_id);
CREATE INDEX idx_expenses_category ON expenses(category);

-- Bank Accounts
CREATE TABLE bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  bank_name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  account_type TEXT,
  currency TEXT DEFAULT 'ARS',
  balance DECIMAL(10,2) DEFAULT 0,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_bank_accounts_company_id ON bank_accounts(company_id);

-- Bank Movements
CREATE TABLE bank_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  bank_account_id UUID NOT NULL REFERENCES bank_accounts(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  date TIMESTAMPTZ DEFAULT NOW(),
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_bank_movements_bank_account_id ON bank_movements(bank_account_id);

-- Checks
CREATE TABLE checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  check_number TEXT NOT NULL,
  issuer TEXT,
  amount DECIMAL(10,2) NOT NULL,
  issue_date DATE,
  due_date DATE,
  bank_account_id UUID REFERENCES bank_accounts(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'issued',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_checks_company_id ON checks(company_id);
CREATE INDEX idx_checks_bank_account_id ON checks(bank_account_id);

-- AFIP Invoices
CREATE TABLE afip_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  sale_id UUID REFERENCES sales(id) ON DELETE SET NULL,
  invoice_type TEXT NOT NULL,
  subtotal DECIMAL(10,2),
  tax DECIMAL(10,2),
  total DECIMAL(10,2) NOT NULL,
  status TEXT DEFAULT 'pending',
  afip_number TEXT UNIQUE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_afip_invoices_company_id ON afip_invoices(company_id);
CREATE INDEX idx_afip_invoices_status ON afip_invoices(status);

-- Webhooks
CREATE TABLE webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  events TEXT[] NOT NULL,
  active BOOLEAN DEFAULT TRUE,
  secret TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_webhooks_company_id ON webhooks(company_id);

-- Webhook Deliveries (for retry logic)
CREATE TABLE webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id UUID NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
  event TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT DEFAULT 'pending',
  attempts INTEGER DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_webhook_deliveries_webhook_id ON webhook_deliveries(webhook_id);
CREATE INDEX idx_webhook_deliveries_status ON webhook_deliveries(status);

-- Bulk Operations
CREATE TABLE bulk_operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  resource TEXT NOT NULL,
  status TEXT DEFAULT 'processing',
  total_items INTEGER,
  processed_items INTEGER DEFAULT 0,
  errors JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_bulk_operations_company_id ON bulk_operations(company_id);
CREATE INDEX idx_bulk_operations_status ON bulk_operations(status);

-- Enable Row Level Security
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE afip_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
```

### Step 5: Configure RLS Policies (Optional)

For row-level security, add policies that restrict data by company_id:

```sql
CREATE POLICY "companies_users_see_own" ON companies
  FOR SELECT USING (
    id IN (SELECT company_id FROM company_users WHERE user_id = auth.uid())
  );

CREATE POLICY "products_see_own_company" ON products
  FOR SELECT USING (
    company_id IN (SELECT company_id FROM company_users WHERE user_id = auth.uid())
  );

-- Add similar policies for other tables
```

---

## Configuration

### Supabase Settings

1. **Go to Settings > API**
   - Note your `Project URL` and `Service Role Key`
   - Ensure `JWT Expiry Limit` is set appropriately (default: 3600 seconds)

2. **Go to Settings > Auth**
   - Configure OAuth providers if needed
   - Set JWT Secret (already configured)

3. **Go to Database > Roles**
   - Use `service_role` for API operations
   - Use `authenticated` for user-facing operations

### CORS Configuration

The API supports CORS for browser requests. To allow specific origins:

Update `_shared/cors.ts`:
```typescript
const ALLOWED_ORIGINS = [
  'https://yourdomain.com',
  'https://app.yourdomain.com',
  'http://localhost:3000', // Development
];
```

### Rate Limiting Configuration

Customize in `_shared/rateLimit.ts`:
```typescript
const DEFAULT_RATE_LIMIT = 100; // req/min
const REPORT_RATE_LIMIT = 30;
const EXPORT_RATE_LIMIT = 10;
```

---

## Testing Deployment

### Health Check

```bash
curl https://your-supabase.functions.supabase.co/api-v1/health
```

**Expected Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-01-30T15:45:00Z"
}
```

### Authentication Test

```bash
# Get JWT token from Supabase Auth
TOKEN=$(curl -X POST https://your-supabase.co/auth/v1/token \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password",
    "grant_type": "password"
  }' | jq -r .access_token)

# Test /me endpoint
curl -H "Authorization: Bearer $TOKEN" \
  https://your-supabase.functions.supabase.co/api-v1/me
```

### Create Supplier Test

```bash
curl -X POST https://your-supabase.functions.supabase.co/api-v1/suppliers \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Supplier",
    "email": "test@supplier.com",
    "tax_id": "30-12345678-9"
  }'
```

---

## Monitoring & Logging

### View Function Logs

In Supabase Dashboard:
1. Go to **Functions** > **api-v1** > **Logs**
2. Filter by date/time or status
3. View real-time logs as requests come in

### Enable Debug Logging

In `_shared/logger.ts`:
```typescript
const LOG_LEVEL = 'debug'; // Change to 'debug' for verbose output
```

### Monitor Rate Limits

Check the `X-RateLimit-*` headers in responses:
```bash
curl -v https://your-supabase.functions.supabase.co/api-v1/suppliers \
  -H "Authorization: Bearer $TOKEN" 2>&1 | grep -i rate-limit
```

---

## Troubleshooting

### Issue: "SUPABASE_URL not defined"

**Solution:** Ensure environment variables are set in Supabase Function settings.

Go to **Functions** > **api-v1** > **Settings** > **Environment Variables**

Add:
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-key-here
```

### Issue: "Unauthorized" on all endpoints

**Solution:** Check JWT token is valid.

```bash
curl -H "Authorization: Bearer $TOKEN" \
  https://your-supabase.functions.supabase.co/api-v1/me
```

If returns 401, token is expired. Re-authenticate.

### Issue: "Rate limit exceeded" immediately

**Solution:** Check if rate limit is too low or Redis connection failed.

Increase limit in `rateLimit.ts` temporarily while investigating.

### Issue: Webhooks not delivering

**Solution:** 
1. Check webhook URL is publicly accessible
2. Verify webhook is active: `GET /webhooks`
3. Check webhook delivery logs in database
4. Ensure target server responds with 2xx status

---

## Performance Tuning

### Database Indexing

Key indexes are created in migration. To verify:

```sql
SELECT * FROM pg_indexes WHERE tablename IN (
  'products', 'customers', 'sales', 'suppliers', 
  'purchases', 'warehouses', 'employees', 'expenses',
  'bank_accounts', 'checks', 'afip_invoices'
);
```

### Query Optimization

1. Always paginate results (max 100 per page)
2. Use search filters instead of fetching all
3. Leverage caching on permission checks (5-min TTL)
4. Use bulk operations for 100+ item inserts

### Connection Pooling

Supabase handles connection pooling automatically. No configuration needed.

---

## Backup & Recovery

### Database Backup

Supabase automatically backs up daily. To restore:

1. Go to **Settings** > **Backups**
2. Select backup date
3. Click **Restore**

### Function Rollback

If deployment fails:

1. Go to **Functions** > **api-v1** > **Deployments**
2. Select previous working version
3. Click **Activate**

---

## Scaling

### Vertical Scaling (Increase Tier)

1. Go to **Settings** > **Billing**
2. Upgrade to higher tier (Pro, Business)
3. Automatic scaling of CPU/RAM

### Horizontal Scaling

Supabase Edge Functions scale automatically. No action needed.

### Database Scaling

For very large deployments (100GB+):

1. Upgrade to **Business** plan
2. Request dedicated instance
3. Contact Supabase support

---

## Security Checklist

- ✅ HTTPS only (automatic with Supabase)
- ✅ JWT validation on all protected endpoints
- ✅ RBAC enforced per endpoint
- ✅ Multi-company isolation via company_id
- ✅ Audit logging of all operations
- ✅ Rate limiting enabled
- ✅ Input validation with Zod
- ✅ Error messages don't leak sensitive info
- ✅ SQL injection prevention (using prepared statements)
- ✅ CORS properly configured

---

## Support

**Need Help?**
- Supabase Docs: https://supabase.com/docs
- API Docs: See [API_DOCUMENTATION_EXTENDED.md](API_DOCUMENTATION_EXTENDED.md)
- Issues: Check logs in Supabase Dashboard
- Email: support@dsfpspace.com

---

**Deployment Status:** ✅ Ready to Deploy
