# API Testing Guide - DSFP Space v2.0

**Date:** January 30, 2026  
**API Version:** 2.0 Enterprise  
**Tools:** Postman / Thunder Client / cURL

---

## Test Setup

### Prerequisites
1. Supabase project deployed
2. API function deployed
3. Test user created in Supabase Auth
4. Bearer token obtained

### Get Bearer Token

```bash
# Using Supabase CLI
supabase auth verify --email user@example.com --password password

# Or manually
curl -X POST https://your-supabase.co/auth/v1/token \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password",
    "grant_type": "password"
  }' | jq .access_token
```

### Environment Setup

Create Postman environment variables:
```json
{
  "API_BASE": "https://your-supabase.functions.supabase.co/api-v1",
  "TOKEN": "your-bearer-token",
  "COMPANY_ID": "your-company-uuid",
  "USER_ID": "your-user-uuid"
}
```

---

## Test Cases

### 1. Health & Authentication

#### Test 1.1: Health Check (Public)
```http
GET {{API_BASE}}/health
```

**Expected:** 200 OK
```json
{
  "status": "ok",
  "timestamp": "2026-01-30T15:45:00Z"
}
```

---

#### Test 1.2: Get Current User
```http
GET {{API_BASE}}/me
Authorization: Bearer {{TOKEN}}
```

**Expected:** 200 OK
```json
{
  "id": "user-uuid",
  "email": "user@example.com",
  "role": "manager",
  "company_id": "company-uuid",
  "modules": ["products", "sales", "customers", "suppliers", "purchases"]
}
```

---

### 2. Companies

#### Test 2.1: List Companies
```http
GET {{API_BASE}}/companies
Authorization: Bearer {{TOKEN}}
```

**Expected:** 200 OK with list of companies

---

#### Test 2.2: Get Company Details
```http
GET {{API_BASE}}/companies/{{COMPANY_ID}}
Authorization: Bearer {{TOKEN}}
```

**Expected:** 200 OK with company data

---

### 3. Suppliers

#### Test 3.1: List Suppliers
```http
GET {{API_BASE}}/suppliers?page=1&limit=50
Authorization: Bearer {{TOKEN}}
Content-Type: application/json
```

**Expected:** 200 OK
```json
{
  "suppliers": [],
  "meta": {
    "page": 1,
    "limit": 50,
    "total": 0,
    "pages": 0
  }
}
```

---

#### Test 3.2: Search Suppliers
```http
GET {{API_BASE}}/suppliers?search=acme&sort=name&order=asc
Authorization: Bearer {{TOKEN}}
```

**Expected:** 200 OK with filtered results

---

#### Test 3.3: Create Supplier
```http
POST {{API_BASE}}/suppliers
Authorization: Bearer {{TOKEN}}
Content-Type: application/json

{
  "name": "ACME Corporation",
  "email": "contact@acme.com",
  "phone": "+54 11 2345-6789",
  "tax_id": "30-12345678-9",
  "condicion_iva": "IVA Responsable Inscripto",
  "address": "Av. Corrientes 1000",
  "city": "Buenos Aires",
  "payment_terms": "30 days net"
}
```

**Expected:** 201 Created
```json
{
  "id": "supplier-uuid",
  "name": "ACME Corporation",
  "email": "contact@acme.com",
  "created_at": "2026-01-30T15:45:00Z"
}
```

---

#### Test 3.4: Update Supplier
```http
PUT {{API_BASE}}/suppliers/{{SUPPLIER_ID}}
Authorization: Bearer {{TOKEN}}
Content-Type: application/json

{
  "payment_terms": "60 days net"
}
```

**Expected:** 200 OK

---

#### Test 3.5: Delete Supplier
```http
DELETE {{API_BASE}}/suppliers/{{SUPPLIER_ID}}
Authorization: Bearer {{TOKEN}}
```

**Expected:** 200 OK
```json
{
  "deleted": true
}
```

---

### 4. Purchases

#### Test 4.1: List Purchases
```http
GET {{API_BASE}}/purchases?page=1&limit=50&sort=created_at&order=desc
Authorization: Bearer {{TOKEN}}
```

**Expected:** 200 OK with purchases

---

#### Test 4.2: Create Purchase
```http
POST {{API_BASE}}/purchases
Authorization: Bearer {{TOKEN}}
Content-Type: application/json

{
  "supplier_id": "{{SUPPLIER_ID}}",
  "invoice_number": "INV-2026-001",
  "receipt_date": "2026-01-30T09:00:00Z",
  "payment_method": "bank_transfer",
  "subtotal": 5000.00,
  "tax": 1050.00,
  "discount": 0.00,
  "total": 6050.00,
  "items": [
    {
      "product_id": "{{PRODUCT_ID}}",
      "quantity": 100,
      "price": 50.00,
      "tax": 0.00,
      "total": 5000.00
    }
  ]
}
```

**Expected:** 201 Created
- Purchase record created
- Product stock increased
- Audit log created
- Webhook triggered (if configured)

---

### 5. Warehouses & Inventory

#### Test 5.1: List Warehouses
```http
GET {{API_BASE}}/warehouses
Authorization: Bearer {{TOKEN}}
```

**Expected:** 200 OK

---

#### Test 5.2: Create Warehouse
```http
POST {{API_BASE}}/warehouses
Authorization: Bearer {{TOKEN}}
Content-Type: application/json

{
  "name": "Main Warehouse",
  "code": "WH-001",
  "description": "Primary storage facility",
  "address": "Calle Principal 123",
  "city": "Buenos Aires"
}
```

**Expected:** 201 Created

---

#### Test 5.3: Transfer Stock Between Warehouses
```http
POST {{API_BASE}}/warehouses/{{FROM_WAREHOUSE_ID}}/transfer/{{TO_WAREHOUSE_ID}}
Authorization: Bearer {{TOKEN}}
Content-Type: application/json

{
  "transfer_date": "2026-01-30T10:00:00Z",
  "notes": "Stock consolidation",
  "items": [
    {
      "product_id": "{{PRODUCT_ID}}",
      "quantity": 50
    }
  ]
}
```

**Expected:** 201 Created
- Transfer record created
- Stock moved from source to destination
- Audit log created

---

#### Test 5.4: Check Inventory Alerts
```http
GET {{API_BASE}}/reports/inventory-status
Authorization: Bearer {{TOKEN}}
```

**Expected:** 200 OK with low-stock alerts

---

### 6. Employees

#### Test 6.1: List Employees
```http
GET {{API_BASE}}/employees?page=1&limit=50&search=john
Authorization: Bearer {{TOKEN}}
```

**Expected:** 200 OK

---

#### Test 6.2: Create Employee
```http
POST {{API_BASE}}/employees
Authorization: Bearer {{TOKEN}}
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@company.com",
  "phone": "+54 11 1234-5678",
  "document": "30-12345678-9",
  "hire_date": "2026-01-30T00:00:00Z",
  "role": "sales_manager",
  "salary": 50000.00,
  "status": "active"
}
```

**Expected:** 201 Created

---

#### Test 6.3: Update Employee
```http
PUT {{API_BASE}}/employees/{{EMPLOYEE_ID}}
Authorization: Bearer {{TOKEN}}
Content-Type: application/json

{
  "salary": 55000.00
}
```

**Expected:** 200 OK

---

### 7. Expenses

#### Test 7.1: List Expenses
```http
GET {{API_BASE}}/expenses?page=1&limit=50&sort=expense_date&order=desc
Authorization: Bearer {{TOKEN}}
```

**Expected:** 200 OK

---

#### Test 7.2: Create Expense
```http
POST {{API_BASE}}/expenses
Authorization: Bearer {{TOKEN}}
Content-Type: application/json

{
  "description": "Office supplies",
  "amount": 250.00,
  "expense_date": "2026-01-30",
  "category": "supplies",
  "payment_method": "credit_card",
  "tax": 52.50,
  "notes": "Monthly office supplies"
}
```

**Expected:** 201 Created

---

### 8. Accounting - Bank Accounts

#### Test 8.1: List Bank Accounts
```http
GET {{API_BASE}}/bank-accounts
Authorization: Bearer {{TOKEN}}
```

**Expected:** 200 OK

---

#### Test 8.2: Create Bank Account
```http
POST {{API_BASE}}/bank-accounts
Authorization: Bearer {{TOKEN}}
Content-Type: application/json

{
  "bank_name": "Banco Nación",
  "account_number": "1234567890",
  "account_type": "checking",
  "currency": "ARS",
  "balance": 50000.00,
  "active": true
}
```

**Expected:** 201 Created

---

#### Test 8.3: Record Bank Movement (Deposit)
```http
POST {{API_BASE}}/bank-accounts/{{ACCOUNT_ID}}/movements
Authorization: Bearer {{TOKEN}}
Content-Type: application/json

{
  "type": "deposit",
  "amount": 10000.00,
  "date": "2026-01-30T14:30:00Z",
  "description": "Customer payment received"
}
```

**Expected:** 201 Created
- Movement recorded
- Account balance increased by 10,000

---

#### Test 8.4: Record Bank Movement (Withdrawal)
```http
POST {{API_BASE}}/bank-accounts/{{ACCOUNT_ID}}/movements
Authorization: Bearer {{TOKEN}}
Content-Type: application/json

{
  "type": "withdrawal",
  "amount": 5000.00,
  "date": "2026-01-30T15:00:00Z",
  "description": "Supplier payment"
}
```

**Expected:** 201 Created
- Movement recorded
- Account balance decreased by 5,000

---

### 9. Checks

#### Test 9.1: List Checks
```http
GET {{API_BASE}}/checks?page=1&limit=50&sort=due_date
Authorization: Bearer {{TOKEN}}
```

**Expected:** 200 OK

---

#### Test 9.2: Create Check
```http
POST {{API_BASE}}/checks
Authorization: Bearer {{TOKEN}}
Content-Type: application/json

{
  "check_number": "001234",
  "issuer": "ACME Corp",
  "amount": 5000.00,
  "issue_date": "2026-01-30",
  "due_date": "2026-02-15",
  "bank_account_id": "{{ACCOUNT_ID}}",
  "notes": "Payment for invoice INV-2026-001"
}
```

**Expected:** 201 Created

---

### 10. AFIP Integration

#### Test 10.1: List AFIP Invoices
```http
GET {{API_BASE}}/afip/invoices?page=1&limit=50
Authorization: Bearer {{TOKEN}}
```

**Expected:** 200 OK

---

#### Test 10.2: Issue AFIP Invoice
```http
POST {{API_BASE}}/afip/invoices
Authorization: Bearer {{TOKEN}}
Content-Type: application/json

{
  "customer_id": "{{CUSTOMER_ID}}",
  "sale_id": "{{SALE_ID}}",
  "invoice_type": "A",
  "subtotal": 5000.00,
  "tax": 1050.00,
  "total": 6050.00,
  "notes": "Invoice for sale completed"
}
```

**Expected:** 201 Created
- AFIP invoice created
- Webhook triggered: invoice.issued

---

### 11. Webhooks

#### Test 11.1: List Webhooks
```http
GET {{API_BASE}}/webhooks
Authorization: Bearer {{TOKEN}}
```

**Expected:** 200 OK

---

#### Test 11.2: Create Webhook
```http
POST {{API_BASE}}/webhooks
Authorization: Bearer {{TOKEN}}
Content-Type: application/json

{
  "url": "https://webhook.cool/unique-id",
  "events": [
    "sale.created",
    "purchase.created",
    "invoice.issued",
    "payment.received"
  ],
  "active": true
}
```

**Expected:** 201 Created

---

#### Test 11.3: Update Webhook
```http
PUT {{API_BASE}}/webhooks/{{WEBHOOK_ID}}
Authorization: Bearer {{TOKEN}}
Content-Type: application/json

{
  "active": false
}
```

**Expected:** 200 OK

---

#### Test 11.4: Delete Webhook
```http
DELETE {{API_BASE}}/webhooks/{{WEBHOOK_ID}}
Authorization: Bearer {{TOKEN}}
```

**Expected:** 200 OK

---

### 12. Bulk Operations

#### Test 12.1: Bulk Import Products
```http
POST {{API_BASE}}/bulk/import/products
Authorization: Bearer {{TOKEN}}
Content-Type: application/json

{
  "items": [
    {
      "name": "Product 1",
      "price": 100.00,
      "stock": 50,
      "sku": "PRD-001"
    },
    {
      "name": "Product 2",
      "price": 200.00,
      "stock": 25,
      "sku": "PRD-002"
    }
  ]
}
```

**Expected:** 201 Created
```json
{
  "operation_id": "bulk-op-uuid",
  "status": "completed",
  "processed": 2,
  "errors": []
}
```

---

#### Test 12.2: Check Bulk Operation Status
```http
GET {{API_BASE}}/bulk/status/{{OPERATION_ID}}
Authorization: Bearer {{TOKEN}}
```

**Expected:** 200 OK
```json
{
  "id": "bulk-op-uuid",
  "status": "completed",
  "progress": 100,
  "processed": 2,
  "total": 2,
  "errors": []
}
```

---

### 13. Reports

#### Test 13.1: Sales Summary
```http
GET {{API_BASE}}/reports/sales-summary
Authorization: Bearer {{TOKEN}}
```

**Expected:** 200 OK
```json
{
  "total_sales": 125000.00,
  "count": 234,
  "average": 534.19,
  "by_payment_method": {
    "cash": {"total": 50000.00, "count": 100},
    "card": {"total": 75000.00, "count": 134}
  }
}
```

---

### 14. Error Cases

#### Test 14.1: Invalid Token
```http
GET {{API_BASE}}/suppliers
Authorization: Bearer invalid-token
```

**Expected:** 401 Unauthorized

---

#### Test 14.2: Insufficient Permissions
```http
POST {{API_BASE}}/suppliers
Authorization: Bearer {{TOKEN}}
Content-Type: application/json

{
  "name": "Test"
}
```

(If user doesn't have suppliers:create permission)

**Expected:** 403 Forbidden

---

#### Test 14.3: Validation Error (Missing Required Field)
```http
POST {{API_BASE}}/suppliers
Authorization: Bearer {{TOKEN}}
Content-Type: application/json

{
  "email": "test@test.com"
}
```

**Expected:** 422 Unprocessable Entity
```json
{
  "error": "Validation failed: name: Required",
  "code": 422
}
```

---

#### Test 14.4: Rate Limit Exceeded
```bash
# Send 150 requests in quick succession
for i in {1..150}; do
  curl -H "Authorization: Bearer {{TOKEN}}" \
    https://{{API_BASE}}/suppliers
done
```

**Expected:** 429 Too Many Requests (after 100 requests/minute)

---

#### Test 14.5: Not Found
```http
GET {{API_BASE}}/suppliers/non-existent-id
Authorization: Bearer {{TOKEN}}
```

**Expected:** 404 Not Found

---

## Performance Tests

### Test P1: Response Time
```bash
# Measure response time
time curl -H "Authorization: Bearer {{TOKEN}}" \
  https://{{API_BASE}}/suppliers?page=1&limit=50
```

**Expected:** < 200ms

---

### Test P2: Large Dataset Pagination
```http
GET {{API_BASE}}/suppliers?page=100&limit=50
Authorization: Bearer {{TOKEN}}
```

**Expected:** 200 OK (pagination handles 5,000+ items efficiently)

---

### Test P3: Search Performance
```http
GET {{API_BASE}}/suppliers?search=acme&limit=50
Authorization: Bearer {{TOKEN}}
```

**Expected:** < 100ms (with indexes)

---

## Automation Script (Bash)

Save as `test-api.sh`:

```bash
#!/bin/bash

API_BASE="https://your-supabase.functions.supabase.co/api-v1"
TOKEN="your-bearer-token"

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

test_endpoint() {
  local method=$1
  local path=$2
  local data=$3
  
  echo "Testing: $method $path"
  
  if [ -z "$data" ]; then
    response=$(curl -s -w "\n%{http_code}" -X $method \
      -H "Authorization: Bearer $TOKEN" \
      "$API_BASE$path")
  else
    response=$(curl -s -w "\n%{http_code}" -X $method \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d "$data" \
      "$API_BASE$path")
  fi
  
  status=$(echo "$response" | tail -n1)
  body=$(echo "$response" | sed '$d')
  
  if [[ $status =~ ^[23] ]]; then
    echo -e "${GREEN}✓ $status${NC}"
  else
    echo -e "${RED}✗ $status${NC}"
    echo "$body"
  fi
  echo ""
}

# Run tests
test_endpoint "GET" "/health"
test_endpoint "GET" "/me"
test_endpoint "GET" "/suppliers"
test_endpoint "GET" "/warehouses"
test_endpoint "GET" "/employees"
test_endpoint "GET" "/expenses"
test_endpoint "GET" "/bank-accounts"
test_endpoint "GET" "/checks"
test_endpoint "GET" "/afip/invoices"
test_endpoint "GET" "/webhooks"

echo "Testing complete!"
```

Run:
```bash
chmod +x test-api.sh
./test-api.sh
```

---

## Postman Collection

Import this JSON into Postman as a collection:

**File:** `DSFP_Space_API_v2.postman_collection.json`

[Save the collection JSON file and import into Postman]

---

## Test Data Seeds

To populate test data, run these SQL commands in Supabase:

```sql
-- Create test company
INSERT INTO companies (name, tax_id, plan) 
VALUES ('Test Company', '30-12345678-9', 'professional');

-- Create test products
INSERT INTO products (company_id, name, sku, price, stock, min_stock)
SELECT id, 'Widget A', 'PRD-001', 100.00, 50, 10 FROM companies WHERE name = 'Test Company'
UNION ALL
SELECT id, 'Widget B', 'PRD-002', 200.00, 25, 5 FROM companies WHERE name = 'Test Company';

-- Create test suppliers
INSERT INTO suppliers (company_id, name, tax_id)
SELECT id, 'Test Supplier', '30-87654321-0' FROM companies WHERE name = 'Test Company';
```

---

## Continuous Integration

### GitHub Actions Example

`.github/workflows/api-tests.yml`:

```yaml
name: API Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Run API Tests
        run: |
          chmod +x test-api.sh
          ./test-api.sh
        env:
          API_BASE: ${{ secrets.API_BASE }}
          TOKEN: ${{ secrets.TEST_TOKEN }}
```

---

## Test Results Template

Document results in this format:

| Test | Status | Duration | Notes |
|------|--------|----------|-------|
| Health Check | ✅ Pass | 45ms | |
| Auth | ✅ Pass | 120ms | |
| List Suppliers | ✅ Pass | 85ms | With 1000 items |
| Create Supplier | ✅ Pass | 95ms | |
| Update Supplier | ✅ Pass | 78ms | |
| Delete Supplier | ✅ Pass | 65ms | |
| Bulk Import | ✅ Pass | 250ms | 100 items |
| Rate Limit | ✅ Pass | 429 after 100 | Working correctly |

---

**Testing Status:** ✅ Ready for Manual & Automated Testing
