import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Router } from "./_shared/router.ts";
import { CORS_HEADERS, errorResponse, jsonResponse, parseJson } from "./_shared/http.ts";
import { requireAuth, requireCompanyAccess } from "./_shared/auth.ts";
import { checkRateLimit, getRateLimitHeaders } from "./_shared/rateLimit.ts";
import { log } from "./_shared/logger.ts";
import { hasPermission, requirePermission } from "./_shared/permissions.ts";
import { auditLog } from "./_shared/audit.ts";
import { getPaginationMeta, type QueryParams, parseQueryParams } from "./_shared/pagination.ts";
import {
  validate,
  CreateSupplierSchema,
  UpdateSupplierSchema,
  CreatePurchaseSchema,
  CreatePurchaseOrderSchema,
  CreateWarehouseSchema,
  UpdateWarehouseSchema,
  CreateTransferSchema,
  CreateEmployeeSchema,
  UpdateEmployeeSchema,
  CreateExpenseSchema,
  UpdateExpenseSchema,
  CreateBankAccountSchema,
  UpdateBankAccountSchema,
  CreateCheckSchema,
  UpdateCheckSchema,
  CreateAFIPInvoiceSchema,
  CreateWebhookSchema,
  UpdateWebhookSchema,
} from "./_shared/validation-extended.ts";
import { triggerWebhook } from "./_shared/webhooks.ts";

const router = new Router();
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// ============================================================================
// HEALTH & AUTH
// ============================================================================

router.get("/health", async () => {
  return jsonResponse({ status: "ok", timestamp: new Date().toISOString() });
});

router.get("/me", async (req, auth) => {
  return jsonResponse({
    id: auth.userId,
    email: auth.email,
    role: auth.role,
    company_id: auth.companyId,
    modules: auth.modules,
  });
});

// ============================================================================
// COMPANIES
// ============================================================================

router.get("/companies", async (req, auth) => {
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase
    .from("company_users")
    .select("companies(id, name, plan, active)")
    .eq("user_id", auth.userId);

  if (error)
    return errorResponse("Failed to fetch companies", 500, { error: error.message });

  return jsonResponse(
    { companies: data?.map((cu) => cu.companies).filter(Boolean) ?? [] },
    200,
    { "X-RateLimit-Remaining": "100" }
  );
});

router.get("/companies/:id", async (req, auth, params) => {
  await requireCompanyAccess(auth, params.id as string);

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase
    .from("companies")
    .select("*")
    .eq("id", params.id)
    .single();

  if (error || !data) return errorResponse("Company not found", 404);

  return jsonResponse(data);
});

// ============================================================================
// SUPPLIERS
// ============================================================================

router.get("/suppliers", async (req, auth) => {
  await requirePermission(auth, "suppliers", "view");

  const queryParams = parseQueryParams(new URL(req.url).search);
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let query = supabase
    .from("suppliers")
    .select("*", { count: "exact" })
    .eq("company_id", auth.companyId!);

  if (queryParams.search) {
    query = query.or(`name.ilike.%${queryParams.search}%,tax_id.ilike.%${queryParams.search}%`);
  }

  const { data, count, error } = await query
    .order(queryParams.sort || "created_at", { ascending: queryParams.order === "asc" })
    .range(
      (queryParams.page - 1) * queryParams.limit,
      queryParams.page * queryParams.limit - 1
    );

  if (error) return errorResponse("Failed to fetch suppliers", 500);

  return jsonResponse(
    {
      suppliers: data ?? [],
      meta: getPaginationMeta(queryParams, count ?? 0),
    },
    200,
    { "X-RateLimit-Remaining": "95" }
  );
});

router.post("/suppliers", async (req, auth) => {
  await requirePermission(auth, "suppliers", "create");

  const body = await parseJson(req);
  const supplier = validate(CreateSupplierSchema, body);

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase
    .from("suppliers")
    .insert({
      ...supplier,
      company_id: auth.companyId,
    })
    .select()
    .single();

  if (error) return errorResponse("Failed to create supplier", 500);

  await auditLog(auth, "create", "suppliers", data.id, { supplier });
  await triggerWebhook(auth, "product.created", { supplier_id: data.id }); // Adjust event name as needed

  return jsonResponse(data, 201);
});

router.put("/suppliers/:id", async (req, auth, params) => {
  await requirePermission(auth, "suppliers", "edit");

  const body = await parseJson(req);
  const updates = validate(UpdateSupplierSchema, body);

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase
    .from("suppliers")
    .update(updates)
    .eq("id", params.id)
    .eq("company_id", auth.companyId!)
    .select()
    .single();

  if (error || !data) return errorResponse("Supplier not found", 404);

  await auditLog(auth, "update", "suppliers", params.id as string, { updates });

  return jsonResponse(data);
});

router.delete("/suppliers/:id", async (req, auth, params) => {
  await requirePermission(auth, "suppliers", "delete");

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { error } = await supabase
    .from("suppliers")
    .delete()
    .eq("id", params.id)
    .eq("company_id", auth.companyId!);

  if (error) return errorResponse("Failed to delete supplier", 500);

  await auditLog(auth, "delete", "suppliers", params.id as string);

  return jsonResponse({ deleted: true });
});

// ============================================================================
// PURCHASES
// ============================================================================

router.get("/purchases", async (req, auth) => {
  await requirePermission(auth, "purchases", "view");

  const queryParams = parseQueryParams(new URL(req.url).search);
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let query = supabase
    .from("purchases")
    .select("*, suppliers(name), items:purchase_items(*, products(name))", { count: "exact" })
    .eq("company_id", auth.companyId!);

  if (queryParams.search) {
    query = query.ilike("invoice_number", `%${queryParams.search}%`);
  }

  const { data, count, error } = await query
    .order(queryParams.sort || "created_at", { ascending: queryParams.order === "asc" })
    .range(
      (queryParams.page - 1) * queryParams.limit,
      queryParams.page * queryParams.limit - 1
    );

  if (error) return errorResponse("Failed to fetch purchases", 500);

  return jsonResponse(
    {
      purchases: data ?? [],
      meta: getPaginationMeta(queryParams, count ?? 0),
    },
    200,
    { "X-RateLimit-Remaining": "90" }
  );
});

router.post("/purchases", async (req, auth) => {
  await requirePermission(auth, "purchases", "create");

  const body = await parseJson(req);
  const purchase = validate(CreatePurchaseSchema, body);

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Create purchase
  const { data: purchaseData, error: purchaseError } = await supabase
    .from("purchases")
    .insert({
      ...purchase,
      company_id: auth.companyId,
      status: "pending",
    })
    .select()
    .single();

  if (purchaseError) return errorResponse("Failed to create purchase", 500);

  // Create purchase items
  const items = purchase.items.map((item) => ({
    ...item,
    purchase_id: purchaseData.id,
  }));

  await supabase.from("purchase_items").insert(items);

  // Update product stock
  for (const item of purchase.items) {
    const { data: product } = await supabase
      .from("products")
      .select("stock")
      .eq("id", item.product_id)
      .single();

    if (product) {
      await supabase
        .from("products")
        .update({ stock: (product.stock ?? 0) + item.quantity })
        .eq("id", item.product_id);
    }
  }

  await auditLog(auth, "create", "purchases", purchaseData.id, { items: purchase.items });
  await triggerWebhook(auth, "purchase.created", { purchase_id: purchaseData.id });

  return jsonResponse(purchaseData, 201);
});

// ============================================================================
// WAREHOUSES
// ============================================================================

router.get("/warehouses", async (req, auth) => {
  await requirePermission(auth, "inventory", "view");

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase
    .from("warehouses")
    .select("*")
    .eq("company_id", auth.companyId!);

  if (error) return errorResponse("Failed to fetch warehouses", 500);

  return jsonResponse({ warehouses: data ?? [] });
});

router.post("/warehouses", async (req, auth) => {
  await requirePermission(auth, "inventory", "create");

  const body = await parseJson(req);
  const warehouse = validate(CreateWarehouseSchema, body);

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase
    .from("warehouses")
    .insert({
      ...warehouse,
      company_id: auth.companyId,
    })
    .select()
    .single();

  if (error) return errorResponse("Failed to create warehouse", 500);

  await auditLog(auth, "create", "warehouses", data.id);

  return jsonResponse(data, 201);
});

router.post("/warehouses/:from_id/transfer/:to_id", async (req, auth, params) => {
  await requirePermission(auth, "inventory", "edit");

  const body = await parseJson(req);
  const transfer = validate(CreateTransferSchema, body);

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase
    .from("warehouse_transfers")
    .insert({
      ...transfer,
      company_id: auth.companyId,
      from_warehouse_id: params.from_id,
      to_warehouse_id: params.to_id,
      status: "completed",
    })
    .select()
    .single();

  if (error) return errorResponse("Failed to create transfer", 500);

  // Update warehouse stock for each item
  for (const item of transfer.items) {
    await supabase
      .from("warehouse_stock")
      .update({ quantity: -item.quantity })
      .eq("warehouse_id", params.from_id)
      .eq("product_id", item.product_id);

    await supabase
      .from("warehouse_stock")
      .update({ quantity: item.quantity })
      .eq("warehouse_id", params.to_id)
      .eq("product_id", item.product_id);
  }

  await auditLog(auth, "create", "warehouse_transfers", data.id);

  return jsonResponse(data, 201);
});

// ============================================================================
// EMPLOYEES
// ============================================================================

router.get("/employees", async (req, auth) => {
  await requirePermission(auth, "employees", "view");

  const queryParams = parseQueryParams(new URL(req.url).search);
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let query = supabase
    .from("employees")
    .select("*", { count: "exact" })
    .eq("company_id", auth.companyId!);

  if (queryParams.search) {
    query = query.ilike("name", `%${queryParams.search}%`);
  }

  const { data, count, error } = await query
    .order(queryParams.sort || "name", { ascending: queryParams.order === "asc" })
    .range(
      (queryParams.page - 1) * queryParams.limit,
      queryParams.page * queryParams.limit - 1
    );

  if (error) return errorResponse("Failed to fetch employees", 500);

  return jsonResponse(
    {
      employees: data ?? [],
      meta: getPaginationMeta(queryParams, count ?? 0),
    },
    200,
    { "X-RateLimit-Remaining": "95" }
  );
});

router.post("/employees", async (req, auth) => {
  await requirePermission(auth, "employees", "create");

  const body = await parseJson(req);
  const employee = validate(CreateEmployeeSchema, body);

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase
    .from("employees")
    .insert({
      ...employee,
      company_id: auth.companyId,
    })
    .select()
    .single();

  if (error) return errorResponse("Failed to create employee", 500);

  await auditLog(auth, "create", "employees", data.id, { employee });

  return jsonResponse(data, 201);
});

// ============================================================================
// EXPENSES
// ============================================================================

router.get("/expenses", async (req, auth) => {
  await requirePermission(auth, "expenses", "view");

  const queryParams = parseQueryParams(new URL(req.url).search);
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let query = supabase
    .from("expenses")
    .select("*", { count: "exact" })
    .eq("company_id", auth.companyId!);

  if (queryParams.search) {
    query = query.ilike("category", `%${queryParams.search}%`);
  }

  const { data, count, error } = await query
    .order(queryParams.sort || "expense_date", { ascending: queryParams.order === "asc" })
    .range(
      (queryParams.page - 1) * queryParams.limit,
      queryParams.page * queryParams.limit - 1
    );

  if (error) return errorResponse("Failed to fetch expenses", 500);

  return jsonResponse(
    {
      expenses: data ?? [],
      meta: getPaginationMeta(queryParams, count ?? 0),
    },
    200,
    { "X-RateLimit-Remaining": "95" }
  );
});

router.post("/expenses", async (req, auth) => {
  await requirePermission(auth, "expenses", "create");

  const body = await parseJson(req);
  const expense = validate(CreateExpenseSchema, body);

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase
    .from("expenses")
    .insert({
      ...expense,
      company_id: auth.companyId,
    })
    .select()
    .single();

  if (error) return errorResponse("Failed to create expense", 500);

  await auditLog(auth, "create", "expenses", data.id, { expense });

  return jsonResponse(data, 201);
});

// ============================================================================
// BANK ACCOUNTS
// ============================================================================

router.get("/bank-accounts", async (req, auth) => {
  await requirePermission(auth, "accounting", "view");

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase
    .from("bank_accounts")
    .select("*")
    .eq("company_id", auth.companyId!);

  if (error) return errorResponse("Failed to fetch bank accounts", 500);

  return jsonResponse({ bank_accounts: data ?? [] });
});

router.post("/bank-accounts", async (req, auth) => {
  await requirePermission(auth, "accounting", "create");

  const body = await parseJson(req);
  const account = validate(CreateBankAccountSchema, body);

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase
    .from("bank_accounts")
    .insert({
      ...account,
      company_id: auth.companyId,
    })
    .select()
    .single();

  if (error) return errorResponse("Failed to create bank account", 500);

  await auditLog(auth, "create", "bank_accounts", data.id);

  return jsonResponse(data, 201);
});

router.post("/bank-accounts/:id/movements", async (req, auth, params) => {
  await requirePermission(auth, "accounting", "create");

  const body = await parseJson(req);
  const movement = {
    bank_account_id: params.id,
    type: body.type as "deposit" | "withdrawal",
    amount: body.amount as number,
    date: body.date ?? new Date().toISOString(),
    description: body.description as string,
  };

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: movData, error: movError } = await supabase
    .from("bank_movements")
    .insert({ ...movement, company_id: auth.companyId })
    .select()
    .single();

  if (movError) return errorResponse("Failed to create movement", 500);

  // Update account balance
  const delta = movement.type === "deposit" ? movement.amount : -movement.amount;
  const { data: account } = await supabase
    .from("bank_accounts")
    .select("balance")
    .eq("id", params.id)
    .single();

  if (account) {
    await supabase
      .from("bank_accounts")
      .update({ balance: (account.balance ?? 0) + delta })
      .eq("id", params.id);
  }

  await auditLog(auth, "create", "bank_movements", movData.id);

  return jsonResponse(movData, 201);
});

// ============================================================================
// CHECKS
// ============================================================================

router.get("/checks", async (req, auth) => {
  await requirePermission(auth, "accounting", "view");

  const queryParams = parseQueryParams(new URL(req.url).search);
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let query = supabase
    .from("checks")
    .select("*", { count: "exact" })
    .eq("company_id", auth.companyId!);

  if (queryParams.search) {
    query = query.ilike("check_number", `%${queryParams.search}%`);
  }

  const { data, count, error } = await query
    .order(queryParams.sort || "due_date", { ascending: queryParams.order === "asc" })
    .range(
      (queryParams.page - 1) * queryParams.limit,
      queryParams.page * queryParams.limit - 1
    );

  if (error) return errorResponse("Failed to fetch checks", 500);

  return jsonResponse(
    {
      checks: data ?? [],
      meta: getPaginationMeta(queryParams, count ?? 0),
    },
    200,
    { "X-RateLimit-Remaining": "90" }
  );
});

router.post("/checks", async (req, auth) => {
  await requirePermission(auth, "accounting", "create");

  const body = await parseJson(req);
  const check = validate(CreateCheckSchema, body);

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase
    .from("checks")
    .insert({
      ...check,
      company_id: auth.companyId,
      status: "issued",
    })
    .select()
    .single();

  if (error) return errorResponse("Failed to create check", 500);

  await auditLog(auth, "create", "checks", data.id);

  return jsonResponse(data, 201);
});

// ============================================================================
// AFIP
// ============================================================================

router.get("/afip/invoices", async (req, auth) => {
  await requirePermission(auth, "accounting", "view");

  const queryParams = parseQueryParams(new URL(req.url).search);
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let query = supabase
    .from("afip_invoices")
    .select("*, customers(name), sales(id)", { count: "exact" })
    .eq("company_id", auth.companyId!);

  const { data, count, error } = await query
    .order(queryParams.sort || "created_at", { ascending: queryParams.order === "asc" })
    .range(
      (queryParams.page - 1) * queryParams.limit,
      queryParams.page * queryParams.limit - 1
    );

  if (error) return errorResponse("Failed to fetch AFIP invoices", 500);

  return jsonResponse(
    {
      invoices: data ?? [],
      meta: getPaginationMeta(queryParams, count ?? 0),
    },
    200,
    { "X-RateLimit-Remaining": "85" }
  );
});

router.post("/afip/invoices", async (req, auth) => {
  await requirePermission(auth, "accounting", "create");

  const body = await parseJson(req);
  const invoice = validate(CreateAFIPInvoiceSchema, body);

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase
    .from("afip_invoices")
    .insert({
      ...invoice,
      company_id: auth.companyId,
      status: "pending",
    })
    .select()
    .single();

  if (error) return errorResponse("Failed to create AFIP invoice", 500);

  await auditLog(auth, "create", "afip_invoices", data.id);
  await triggerWebhook(auth, "invoice.issued", { invoice_id: data.id });

  return jsonResponse(data, 201);
});

// ============================================================================
// WEBHOOKS
// ============================================================================

router.get("/webhooks", async (req, auth) => {
  await requirePermission(auth, "settings", "view");

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase
    .from("webhooks")
    .select("id, url, events, active, created_at")
    .eq("company_id", auth.companyId!);

  if (error) return errorResponse("Failed to fetch webhooks", 500);

  return jsonResponse({ webhooks: data ?? [] });
});

router.post("/webhooks", async (req, auth) => {
  await requirePermission(auth, "settings", "create");

  const body = await parseJson(req);
  const webhook = validate(CreateWebhookSchema, body);

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase
    .from("webhooks")
    .insert({
      ...webhook,
      company_id: auth.companyId,
    })
    .select()
    .single();

  if (error) return errorResponse("Failed to create webhook", 500);

  await auditLog(auth, "create", "webhooks", data.id);

  return jsonResponse(data, 201);
});

router.put("/webhooks/:id", async (req, auth, params) => {
  await requirePermission(auth, "settings", "edit");

  const body = await parseJson(req);
  const updates = validate(UpdateWebhookSchema, body);

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase
    .from("webhooks")
    .update(updates)
    .eq("id", params.id)
    .eq("company_id", auth.companyId!)
    .select()
    .single();

  if (error || !data) return errorResponse("Webhook not found", 404);

  await auditLog(auth, "update", "webhooks", params.id as string);

  return jsonResponse(data);
});

router.delete("/webhooks/:id", async (req, auth, params) => {
  await requirePermission(auth, "settings", "delete");

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { error } = await supabase
    .from("webhooks")
    .delete()
    .eq("id", params.id)
    .eq("company_id", auth.companyId!);

  if (error) return errorResponse("Failed to delete webhook", 500);

  await auditLog(auth, "delete", "webhooks", params.id as string);

  return jsonResponse({ deleted: true });
});

// ============================================================================
// BULK OPERATIONS
// ============================================================================

router.post("/bulk/import/:resource", async (req, auth, params) => {
  await requirePermission(auth, params.resource as string, "create");

  const body = await parseJson(req);
  const items = body.items as unknown[];

  if (!Array.isArray(items) || items.length === 0) {
    return errorResponse("Invalid bulk operation: items array required", 400);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Create operation record
  const { data: operation, error: opError } = await supabase
    .from("bulk_operations")
    .insert({
      company_id: auth.companyId,
      type: "import",
      resource: params.resource,
      status: "processing",
      total_items: items.length,
      processed_items: 0,
      errors: [],
    })
    .select()
    .single();

  if (opError) return errorResponse("Failed to create bulk operation", 500);

  // Process asynchronously
  let processed = 0;
  const errors: string[] = [];

  for (const item of items) {
    try {
      // Validate based on resource type
      let validated = item;
      if (params.resource === "products") {
        // Would validate with schema
      } else if (params.resource === "customers") {
        // Would validate with schema
      }

      // Insert into database
      const { error } = await supabase.from(params.resource as string).insert({
        ...validated,
        company_id: auth.companyId,
      });

      if (error) {
        errors.push(`Item ${processed + 1}: ${error.message}`);
      }
    } catch (e) {
      errors.push(`Item ${processed + 1}: ${String(e)}`);
    }
    processed++;
  }

  // Update operation record
  await supabase
    .from("bulk_operations")
    .update({
      status: errors.length === 0 ? "completed" : "completed_with_errors",
      processed_items: processed,
      errors: errors.length > 0 ? errors : null,
    })
    .eq("id", operation.id);

  await auditLog(auth, "create", "bulk_operations", operation.id, {
    resource: params.resource,
    count: processed,
  });

  return jsonResponse(
    {
      operation_id: operation.id,
      status: errors.length === 0 ? "completed" : "completed_with_errors",
      processed: processed,
      errors: errors.length > 0 ? errors : [],
    },
    201
  );
});

router.get("/bulk/status/:id", async (req, auth, params) => {
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase
    .from("bulk_operations")
    .select("*")
    .eq("id", params.id)
    .eq("company_id", auth.companyId!)
    .single();

  if (error || !data) return errorResponse("Operation not found", 404);

  return jsonResponse({
    id: data.id,
    status: data.status,
    progress: data.total_items > 0 ? (data.processed_items / data.total_items) * 100 : 0,
    processed: data.processed_items,
    total: data.total_items,
    errors: data.errors ?? [],
  });
});

// ============================================================================
// REPORTS & ANALYTICS
// ============================================================================

router.get("/reports/sales-summary", async (req, auth) => {
  await requirePermission(auth, "reports", "view");

  const queryParams = parseQueryParams(new URL(req.url).search);
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase
    .from("sales")
    .select("total, payment_method, created_at")
    .eq("company_id", auth.companyId!)
    .order("created_at", { ascending: false });

  if (error) return errorResponse("Failed to generate sales summary", 500);

  const summary = {
    total_sales: (data ?? []).reduce((sum, s) => sum + (s.total ?? 0), 0),
    count: data?.length ?? 0,
    average: (data ?? []).length > 0
      ? (data ?? []).reduce((sum, s) => sum + (s.total ?? 0), 0) / (data ?? []).length
      : 0,
    by_payment_method: Object.groupBy(data ?? [], (s) => s.payment_method),
  };

  return jsonResponse(summary);
});

router.get("/reports/inventory-status", async (req, auth) => {
  await requirePermission(auth, "reports", "view");

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase
    .from("products")
    .select("id, name, stock, min_stock, price")
    .eq("company_id", auth.companyId!)
    .lt("stock", "min_stock");

  if (error) return errorResponse("Failed to fetch inventory alerts", 500);

  return jsonResponse({
    alerts: data ?? [],
    count: data?.length ?? 0,
  });
});

// ============================================================================
// MAIN HANDLER
// ============================================================================

serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname;
    const method = req.method;

    // Public endpoints
    if (path === "/health" && method === "GET") {
      const response = await router.route(method, path, req, null);
      if (response) return response;
    }

    // Protected endpoints
    let auth = null;
    if (path !== "/health") {
      auth = await requireAuth(req);

      const rateLimitOk = await checkRateLimit(auth.userId, path);
      if (!rateLimitOk) {
        log("warn", "Rate limit exceeded", { user_id: auth.userId, path });
        return errorResponse("Rate limit exceeded", 429, getRateLimitHeaders(auth.userId, path));
      }
    }

    const response = await router.route(method, path, req, auth);

    if (response) {
      response.headers.set("X-Request-Id", crypto.randomUUID());
      if (auth) {
        const limitHeaders = getRateLimitHeaders(auth.userId, path);
        Object.entries(limitHeaders).forEach(([key, value]) => {
          response.headers.set(key, value);
        });
      }
      return response;
    }

    return errorResponse("Not found", 404);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    log("error", "Request failed", { error: message });
    return errorResponse(message, 500);
  }
});
