import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { jsonResponse, errorResponse, parseJson } from "../_shared/http.ts";
import {
  requireAuth,
  requireCompanyAccess,
  getSupabaseServiceKey,
  getSupabaseUrl,
  AuthContext,
} from "../_shared/auth.ts";
import { log } from "../_shared/logger.ts";
import { checkRateLimit, getRateLimitHeaders } from "../_shared/rateLimit.ts";
import { requirePermission } from "../_shared/permissions.ts";
import { auditLog } from "../_shared/audit.ts";
import { Router } from "../_shared/router.ts";
import { parseQueryParams, getPaginationMeta } from "../_shared/pagination.ts";
import {
  validate,
  CreateProductSchema,
  UpdateProductSchema,
  CreateCustomerSchema,
  UpdateCustomerSchema,
  CreateSaleSchema,
} from "../_shared/validation.ts";
import {
  CreateSupplierSchema,
  UpdateSupplierSchema,
  CreatePurchaseSchema,
  CreateWarehouseSchema,
  UpdateWarehouseSchema,
  CreateTransferSchema,
  CreateEmployeeSchema,
  UpdateEmployeeSchema,
  CreateExpenseSchema,
  UpdateExpenseSchema,
  CreateBankAccountSchema,
  CreateCheckSchema,
  UpdateCheckSchema,
  CreateAFIPInvoiceSchema,
  CreateWebhookSchema,
  UpdateWebhookSchema,
} from "../_shared/validation-extended.ts";
import { triggerWebhook } from "../_shared/webhooks.ts";

const router = new Router();

const getPath = (req: Request) => {
  const url = new URL(req.url);
  const fullPath = url.pathname;
  const marker = "/api-v1";
  const idx = fullPath.indexOf(marker);
  const path = idx >= 0 ? fullPath.slice(idx + marker.length) : fullPath;
  return path === "" ? "/" : path;
};

const parseDate = (value: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

function getSupabaseAdmin() {
  const supabaseUrl = getSupabaseUrl();
  const serviceKey = getSupabaseServiceKey();
  if (!supabaseUrl || !serviceKey) throw new Error("Supabase env not configured");
  return createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// ==================== HEALTH & AUTH ====================

router.get("/health", async () => {
  return jsonResponse({ status: "ok", time: new Date().toISOString() });
});

router.get("/me", async (req, auth) => {
  await auditLog(auth, "read", "user", auth.userId);
  return jsonResponse({ userId: auth.userId, email: auth.userEmail });
});

// ==================== COMPANIES ====================

router.get("/companies", async (req, auth) => {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("company_users")
    .select("company_id, role, companies(id, name, tax_id, razon_social)")
    .eq("user_id", auth.userId)
    .or("active.eq.true,active.is.null");

  if (error) throw error;
  await auditLog(auth, "read", "companies");
  return jsonResponse({ items: data ?? [] });
});

router.get("/companies/:id", async (req, auth, params) => {
  const authWithCompany = await requireCompanyAccess(req, params.id);
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("companies")
    .select("*")
    .eq("id", authWithCompany.companyId)
    .single();

  if (error) throw error;
  await auditLog(authWithCompany, "read", "company", params.id);
  return jsonResponse(data);
});

// ==================== PRODUCTS ====================

router.get("/products", async (req, auth) => {
  const url = new URL(req.url);
  const companyId = url.searchParams.get("company_id");
  if (!companyId) return errorResponse("company_id is required", 400);

  const authWithCompany = await requireCompanyAccess(req, companyId);
  await requirePermission(authWithCompany, "products", "view");

  const { page, limit, sort, order, search } = parseQueryParams(url);
  const supabase = getSupabaseAdmin();

  let query = supabase
    .from("products")
    .select("*", { count: "exact" })
    .eq("company_id", authWithCompany.companyId);

  if (search) {
    query = query.or(`name.ilike.%${search}%,sku.ilike.%${search}%,barcode.ilike.%${search}%`);
  }

  if (sort) {
    query = query.order(sort, { ascending: order === "asc" });
  } else {
    query = query.order("created_at", { ascending: false });
  }

  const offset = (page - 1) * limit;
  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;
  if (error) throw error;

  await auditLog(authWithCompany, "read", "products");
  return jsonResponse({
    items: data ?? [],
    pagination: getPaginationMeta(page, limit, count ?? 0),
  });
});

router.get("/products/:id", async (req, auth, params) => {
  const url = new URL(req.url);
  const companyId = url.searchParams.get("company_id");
  if (!companyId) return errorResponse("company_id is required", 400);

  const authWithCompany = await requireCompanyAccess(req, companyId);
  await requirePermission(authWithCompany, "products", "view");

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("id", params.id)
    .eq("company_id", authWithCompany.companyId)
    .single();

  if (error) throw error;
  await auditLog(authWithCompany, "read", "product", params.id);
  return jsonResponse(data);
});

router.post("/products", async (req, auth) => {
  const body = await parseJson(req);
  const companyId = String(body.company_id ?? "");
  if (!companyId) return errorResponse("company_id is required", 400);

  const authWithCompany = await requireCompanyAccess(req, companyId);
  await requirePermission(authWithCompany, "products", "create");

  const validated = validate(CreateProductSchema, body) as Record<string, any>;
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("products")
    .insert({ ...validated, company_id: authWithCompany.companyId })
    .select()
    .single();

  if (error) throw error;
  await auditLog(authWithCompany, "create", "product", data.id, validated as Record<string, unknown>);
  return jsonResponse(data, 201);
});

router.put("/products/:id", async (req, auth, params) => {
  const body = await parseJson(req);
  const companyId = String(body.company_id ?? "");
  if (!companyId) return errorResponse("company_id is required", 400);

  const authWithCompany = await requireCompanyAccess(req, companyId);
  await requirePermission(authWithCompany, "products", "edit");

  const validated = validate(UpdateProductSchema, body) as Record<string, any>;
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("products")
    .update(validated)
    .eq("id", params.id)
    .eq("company_id", authWithCompany.companyId)
    .select()
    .single();

  if (error) throw error;
  await auditLog(authWithCompany, "update", "product", params.id, validated as Record<string, unknown>);
  return jsonResponse(data);
});

router.delete("/products/:id", async (req, auth, params) => {
  const url = new URL(req.url);
  const companyId = url.searchParams.get("company_id");
  if (!companyId) return errorResponse("company_id is required", 400);

  const authWithCompany = await requireCompanyAccess(req, companyId);
  await requirePermission(authWithCompany, "products", "delete");

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("products")
    .delete()
    .eq("id", params.id)
    .eq("company_id", authWithCompany.companyId);

  if (error) throw error;
  await auditLog(authWithCompany, "delete", "product", params.id);
  return jsonResponse({ ok: true }, 200);
});

// ==================== CUSTOMERS ====================

router.get("/customers", async (req, auth) => {
  const url = new URL(req.url);
  const companyId = url.searchParams.get("company_id");
  if (!companyId) return errorResponse("company_id is required", 400);

  const authWithCompany = await requireCompanyAccess(req, companyId);
  await requirePermission(authWithCompany, "customers", "view");

  const { page, limit, sort, order, search } = parseQueryParams(url);
  const supabase = getSupabaseAdmin();

  let query = supabase
    .from("customers")
    .select("*", { count: "exact" })
    .eq("company_id", authWithCompany.companyId);

  if (search) {
    query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,document.ilike.%${search}%`);
  }

  if (sort) {
    query = query.order(sort, { ascending: order === "asc" });
  } else {
    query = query.order("created_at", { ascending: false });
  }

  const offset = (page - 1) * limit;
  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;
  if (error) throw error;

  await auditLog(authWithCompany, "read", "customers");
  return jsonResponse({
    items: data ?? [],
    pagination: getPaginationMeta(page, limit, count ?? 0),
  });
});

router.get("/customers/:id", async (req, auth, params) => {
  const url = new URL(req.url);
  const companyId = url.searchParams.get("company_id");
  if (!companyId) return errorResponse("company_id is required", 400);

  const authWithCompany = await requireCompanyAccess(req, companyId);
  await requirePermission(authWithCompany, "customers", "view");

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .eq("id", params.id)
    .eq("company_id", authWithCompany.companyId)
    .single();

  if (error) throw error;
  await auditLog(authWithCompany, "read", "customer", params.id);
  return jsonResponse(data);
});

router.post("/customers", async (req, auth) => {
  const body = await parseJson(req);
  const companyId = String(body.company_id ?? "");
  if (!companyId) return errorResponse("company_id is required", 400);

  const authWithCompany = await requireCompanyAccess(req, companyId);
  await requirePermission(authWithCompany, "customers", "create");

  const validated = validate(CreateCustomerSchema, body) as Record<string, any>;
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("customers")
    .insert({ ...validated, company_id: authWithCompany.companyId })
    .select()
    .single();

  if (error) throw error;
  await auditLog(authWithCompany, "create", "customer", data.id, validated as Record<string, unknown>);
  return jsonResponse(data, 201);
});

router.put("/customers/:id", async (req, auth, params) => {
  const body = await parseJson(req);
  const companyId = String(body.company_id ?? "");
  if (!companyId) return errorResponse("company_id is required", 400);

  const authWithCompany = await requireCompanyAccess(req, companyId);
  await requirePermission(authWithCompany, "customers", "edit");

  const validated = validate(UpdateCustomerSchema, body) as Record<string, any>;
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("customers")
    .update(validated)
    .eq("id", params.id)
    .eq("company_id", authWithCompany.companyId)
    .select()
    .single();

  if (error) throw error;
  await auditLog(authWithCompany, "update", "customer", params.id, validated as Record<string, unknown>);
  return jsonResponse(data);
});

router.delete("/customers/:id", async (req, auth, params) => {
  const url = new URL(req.url);
  const companyId = url.searchParams.get("company_id");
  if (!companyId) return errorResponse("company_id is required", 400);

  const authWithCompany = await requireCompanyAccess(req, companyId);
  await requirePermission(authWithCompany, "customers", "delete");

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("customers")
    .delete()
    .eq("id", params.id)
    .eq("company_id", authWithCompany.companyId);

  if (error) throw error;
  await auditLog(authWithCompany, "delete", "customer", params.id);
  return jsonResponse({ ok: true }, 200);
});

// ==================== SALES ====================

router.get("/sales", async (req, auth) => {
  const url = new URL(req.url);
  const companyId = url.searchParams.get("company_id");
  if (!companyId) return errorResponse("company_id is required", 400);

  const authWithCompany = await requireCompanyAccess(req, companyId);
  await requirePermission(authWithCompany, "sales", "view");

  const { page, limit, sort, order } = parseQueryParams(url);
  const supabase = getSupabaseAdmin();

  let query = supabase
    .from("sales")
    .select("*, customers(name), sale_items(*, products(name))", { count: "exact" })
    .eq("company_id", authWithCompany.companyId);

  if (sort) {
    query = query.order(sort, { ascending: order === "asc" });
  } else {
    query = query.order("created_at", { ascending: false });
  }

  const offset = (page - 1) * limit;
  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;
  if (error) throw error;

  await auditLog(authWithCompany, "read", "sales");
  return jsonResponse({
    items: data ?? [],
    pagination: getPaginationMeta(page, limit, count ?? 0),
  });
});

router.get("/sales/:id", async (req, auth, params) => {
  const url = new URL(req.url);
  const companyId = url.searchParams.get("company_id");
  if (!companyId) return errorResponse("company_id is required", 400);

  const authWithCompany = await requireCompanyAccess(req, companyId);
  await requirePermission(authWithCompany, "sales", "view");

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("sales")
    .select("*, customers(name), sale_items(*, products(name))")
    .eq("id", params.id)
    .eq("company_id", authWithCompany.companyId)
    .single();

  if (error) throw error;
  await auditLog(authWithCompany, "read", "sale", params.id);
  return jsonResponse(data);
});

router.post("/sales", async (req, auth) => {
  const body = await parseJson(req);
  const companyId = String(body.company_id ?? "");
  if (!companyId) return errorResponse("company_id is required", 400);

  const authWithCompany = await requireCompanyAccess(req, companyId);
  await requirePermission(authWithCompany, "sales", "create");

  const validated = validate(CreateSaleSchema, body) as any;
  const supabase = getSupabaseAdmin();

  // Create sale
  const { data: sale, error: saleError } = await supabase
    .from("sales")
    .insert({
      company_id: authWithCompany.companyId,
      customer_id: validated.customer_id ?? null,
      payment_method: validated.payment_method,
      subtotal: validated.subtotal,
      tax: validated.tax ?? 0,
      discount: validated.discount ?? 0,
      total: validated.total,
      notes: validated.notes ?? null,
    })
    .select()
    .single();

  if (saleError) throw saleError;

  // Create sale items
  const items = validated.items.map((item: any) => ({
    sale_id: sale.id,
    product_id: item.product_id,
    quantity: item.quantity,
    price: item.price,
    discount: item.discount ?? 0,
    total: item.total,
  }));

  const { error: itemsError } = await supabase.from("sale_items").insert(items);
  if (itemsError) throw itemsError;

  await auditLog(authWithCompany, "create", "sale", sale.id, validated as Record<string, unknown>);
  return jsonResponse(sale, 201);
});

// ==================== REPORTS ====================

router.get("/reports/sales-summary", async (req, auth) => {
  const url = new URL(req.url);
  const companyId = url.searchParams.get("company_id");
  const start = parseDate(url.searchParams.get("start"));
  const end = parseDate(url.searchParams.get("end"));

  if (!companyId || !start || !end) {
    return errorResponse("company_id, start, end are required", 400);
  }

  const authWithCompany = await requireCompanyAccess(req, companyId);
  await requirePermission(authWithCompany, "reports", "view");

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("sales")
    .select("id, total, subtotal, created_at")
    .eq("company_id", authWithCompany.companyId)
    .gte("created_at", start.toISOString())
    .lte("created_at", end.toISOString());

  if (error) throw error;

  const sales = data ?? [];
  const total = sales.reduce((sum: number, s: any) => sum + (s.total ?? 0), 0);
  const subtotal = sales.reduce((sum: number, s: any) => sum + (s.subtotal ?? 0), 0);
  const count = sales.length;
  const avg = count > 0 ? total / count : 0;

  await auditLog(authWithCompany, "read", "reports/sales-summary");
  return jsonResponse({
    companyId,
    start: start.toISOString(),
    end: end.toISOString(),
    count,
    subtotal,
    total,
    average_ticket: avg,
  });
});

router.get("/reports/top-products", async (req, auth) => {
  const url = new URL(req.url);
  const companyId = url.searchParams.get("company_id");
  const start = parseDate(url.searchParams.get("start"));
  const end = parseDate(url.searchParams.get("end"));
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "10"), 50);

  if (!companyId || !start || !end) {
    return errorResponse("company_id, start, end are required", 400);
  }

  const authWithCompany = await requireCompanyAccess(req, companyId);
  await requirePermission(authWithCompany, "reports", "view");

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("sale_items")
    .select("product_id, quantity, total, products(name), sales!inner(company_id, created_at)")
    .eq("sales.company_id", authWithCompany.companyId)
    .gte("sales.created_at", start.toISOString())
    .lte("sales.created_at", end.toISOString());

  if (error) throw error;

  const items = data ?? [];
  const aggregated = new Map<string, { product_id: string; name: string | null; qty: number; total: number }>();

  for (const row of items as any[]) {
    const productId = row.product_id as string;
    const name = row.products?.name ?? null;
    const qty = Number(row.quantity ?? 0);
    const total = Number(row.total ?? 0);

    const current = aggregated.get(productId) ?? { product_id: productId, name, qty: 0, total: 0 };
    current.qty += qty;
    current.total += total;
    aggregated.set(productId, current);
  }

  const top = Array.from(aggregated.values())
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);

  await auditLog(authWithCompany, "read", "reports/top-products");
  return jsonResponse({
    companyId,
    start: start.toISOString(),
    end: end.toISOString(),
    items: top,
  });
});

// ==================== SUPPLIERS ====================

router.get("/suppliers", async (req, auth) => {
  const url = new URL(req.url);
  const companyId = url.searchParams.get("company_id");
  if (!companyId) return errorResponse("company_id is required", 400);

  const authWithCompany = await requireCompanyAccess(req, companyId);
  await requirePermission(authWithCompany, "suppliers", "view");

  const { page, limit, sort, order, search } = parseQueryParams(url);
  const supabase = getSupabaseAdmin();

  let query = supabase
    .from("suppliers")
    .select("*", { count: "exact" })
    .eq("company_id", authWithCompany.companyId);

  if (search) {
    query = query.or(`name.ilike.%${search}%,tax_id.ilike.%${search}%`);
  }

  if (sort) {
    query = query.order(sort, { ascending: order === "asc" });
  } else {
    query = query.order("created_at", { ascending: false });
  }

  const offset = (page - 1) * limit;
  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;
  if (error) throw error;

  await auditLog(authWithCompany, "read", "suppliers");
  return jsonResponse({
    items: data ?? [],
    pagination: getPaginationMeta(page, limit, count ?? 0),
  });
});

router.get("/suppliers/:id", async (req, auth, params) => {
  const url = new URL(req.url);
  const companyId = url.searchParams.get("company_id");
  if (!companyId) return errorResponse("company_id is required", 400);

  const authWithCompany = await requireCompanyAccess(req, companyId);
  await requirePermission(authWithCompany, "suppliers", "view");

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("suppliers")
    .select("*")
    .eq("id", params.id)
    .eq("company_id", authWithCompany.companyId)
    .single();

  if (error) throw error;
  await auditLog(authWithCompany, "read", "supplier", params.id);
  return jsonResponse(data);
});

router.post("/suppliers", async (req, auth) => {
  const body = await parseJson(req);
  const companyId = String(body.company_id ?? "");
  if (!companyId) return errorResponse("company_id is required", 400);

  const authWithCompany = await requireCompanyAccess(req, companyId);
  await requirePermission(authWithCompany, "suppliers", "create");

  const validated = validate(CreateSupplierSchema, body) as Record<string, any>;
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("suppliers")
    .insert({ ...validated, company_id: authWithCompany.companyId })
    .select()
    .single();

  if (error) throw error;
  await auditLog(authWithCompany, "create", "supplier", data.id, validated as Record<string, unknown>);
  return jsonResponse(data, 201);
});

router.put("/suppliers/:id", async (req, auth, params) => {
  const body = await parseJson(req);
  const companyId = String(body.company_id ?? "");
  if (!companyId) return errorResponse("company_id is required", 400);

  const authWithCompany = await requireCompanyAccess(req, companyId);
  await requirePermission(authWithCompany, "suppliers", "edit");

  const validated = validate(UpdateSupplierSchema, body) as Record<string, any>;
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("suppliers")
    .update(validated)
    .eq("id", params.id)
    .eq("company_id", authWithCompany.companyId)
    .select()
    .single();

  if (error) throw error;
  await auditLog(authWithCompany, "update", "supplier", params.id, validated as Record<string, unknown>);
  return jsonResponse(data);
});

router.delete("/suppliers/:id", async (req, auth, params) => {
  const url = new URL(req.url);
  const companyId = url.searchParams.get("company_id");
  if (!companyId) return errorResponse("company_id is required", 400);

  const authWithCompany = await requireCompanyAccess(req, companyId);
  await requirePermission(authWithCompany, "suppliers", "delete");

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("suppliers")
    .delete()
    .eq("id", params.id)
    .eq("company_id", authWithCompany.companyId);

  if (error) throw error;
  await auditLog(authWithCompany, "delete", "supplier", params.id);
  return jsonResponse({ ok: true }, 200);
});

// ==================== PURCHASES ====================

router.get("/purchases", async (req, auth) => {
  const url = new URL(req.url);
  const companyId = url.searchParams.get("company_id");
  if (!companyId) return errorResponse("company_id is required", 400);

  const authWithCompany = await requireCompanyAccess(req, companyId);
  await requirePermission(authWithCompany, "purchases", "view");

  const { page, limit, sort, order, search } = parseQueryParams(url);
  const supabase = getSupabaseAdmin();

  let query = supabase
    .from("purchases")
    .select("*, suppliers(name), purchase_items(*, products(name))", { count: "exact" })
    .eq("company_id", authWithCompany.companyId);

  if (search) {
    query = query.ilike("invoice_number", `%${search}%`);
  }

  if (sort) {
    query = query.order(sort, { ascending: order === "asc" });
  } else {
    query = query.order("created_at", { ascending: false });
  }

  const offset = (page - 1) * limit;
  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;
  if (error) throw error;

  await auditLog(authWithCompany, "read", "purchases");
  return jsonResponse({
    items: data ?? [],
    pagination: getPaginationMeta(page, limit, count ?? 0),
  });
});

router.post("/purchases", async (req, auth) => {
  const body = await parseJson(req);
  const companyId = String(body.company_id ?? "");
  if (!companyId) return errorResponse("company_id is required", 400);

  const authWithCompany = await requireCompanyAccess(req, companyId);
  await requirePermission(authWithCompany, "purchases", "create");

  const validated = validate(CreatePurchaseSchema, body) as any;
  const supabase = getSupabaseAdmin();

  const { data: purchase, error: purchaseError } = await supabase
    .from("purchases")
    .insert({
      company_id: authWithCompany.companyId,
      supplier_id: validated.supplier_id,
      invoice_number: validated.invoice_number ?? null,
      receipt_date: validated.receipt_date ?? null,
      payment_method: validated.payment_method,
      subtotal: validated.subtotal,
      tax: validated.tax ?? 0,
      discount: validated.discount ?? 0,
      total: validated.total,
      notes: validated.notes ?? null,
      status: "pending",
    })
    .select()
    .single();

  if (purchaseError) throw purchaseError;

  const items = validated.items.map((item: any) => ({
    purchase_id: purchase.id,
    product_id: item.product_id,
    quantity: item.quantity,
    price: item.price,
    tax: item.tax ?? 0,
    total: item.total,
  }));

  const { error: itemsError } = await supabase.from("purchase_items").insert(items);
  if (itemsError) throw itemsError;

  for (const item of validated.items as any[]) {
    const { data: product, error: productError } = await supabase
      .from("products")
      .select("stock")
      .eq("id", item.product_id)
      .eq("company_id", authWithCompany.companyId)
      .single();

    if (productError) throw productError;
    const currentStock = Number(product?.stock ?? 0);
    const nextStock = currentStock + item.quantity;

    const { error: stockError } = await supabase
      .from("products")
      .update({ stock: nextStock })
      .eq("id", item.product_id)
      .eq("company_id", authWithCompany.companyId);

    if (stockError) throw stockError;
  }

  await auditLog(authWithCompany, "create", "purchase", purchase.id, validated as Record<string, unknown>);
  await triggerWebhook(authWithCompany, "purchase.created", { purchase_id: purchase.id });
  return jsonResponse(purchase, 201);
});

// ==================== WAREHOUSES ====================

router.get("/warehouses", async (req, auth) => {
  const url = new URL(req.url);
  const companyId = url.searchParams.get("company_id");
  if (!companyId) return errorResponse("company_id is required", 400);

  const authWithCompany = await requireCompanyAccess(req, companyId);
  await requirePermission(authWithCompany, "inventory", "view");

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("warehouses")
    .select("*")
    .eq("company_id", authWithCompany.companyId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  await auditLog(authWithCompany, "read", "warehouses");
  return jsonResponse({ items: data ?? [] });
});

router.post("/warehouses", async (req, auth) => {
  const body = await parseJson(req);
  const companyId = String(body.company_id ?? "");
  if (!companyId) return errorResponse("company_id is required", 400);

  const authWithCompany = await requireCompanyAccess(req, companyId);
  await requirePermission(authWithCompany, "inventory", "create");

  const validated = validate(CreateWarehouseSchema, body) as Record<string, any>;
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("warehouses")
    .insert({ ...validated, company_id: authWithCompany.companyId })
    .select()
    .single();

  if (error) throw error;
  await auditLog(authWithCompany, "create", "warehouse", data.id, validated as Record<string, unknown>);
  return jsonResponse(data, 201);
});

router.put("/warehouses/:id", async (req, auth, params) => {
  const body = await parseJson(req);
  const companyId = String(body.company_id ?? "");
  if (!companyId) return errorResponse("company_id is required", 400);

  const authWithCompany = await requireCompanyAccess(req, companyId);
  await requirePermission(authWithCompany, "inventory", "edit");

  const validated = validate(UpdateWarehouseSchema, body) as Record<string, any>;
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("warehouses")
    .update(validated)
    .eq("id", params.id)
    .eq("company_id", authWithCompany.companyId)
    .select()
    .single();

  if (error) throw error;
  await auditLog(authWithCompany, "update", "warehouse", params.id, validated as Record<string, unknown>);
  return jsonResponse(data);
});

router.post("/warehouses/:from_id/transfer/:to_id", async (req, auth, params) => {
  const body = await parseJson(req);
  const companyId = String(body.company_id ?? "");
  if (!companyId) return errorResponse("company_id is required", 400);

  const authWithCompany = await requireCompanyAccess(req, companyId);
  await requirePermission(authWithCompany, "inventory", "edit");

  const validated = validate(CreateTransferSchema, body) as any;
  const supabase = getSupabaseAdmin();

  const { data: transfer, error: transferError } = await supabase
    .from("warehouse_transfers")
    .insert({
      company_id: authWithCompany.companyId,
      from_warehouse_id: params.from_id,
      to_warehouse_id: params.to_id,
      transfer_date: validated.transfer_date ?? null,
      notes: validated.notes ?? null,
      status: "completed",
    })
    .select()
    .single();

  if (transferError) throw transferError;

  for (const item of validated.items as any[]) {
    const { data: fromStock, error: fromError } = await supabase
      .from("warehouse_stock")
      .select("id, quantity")
      .eq("warehouse_id", params.from_id)
      .eq("product_id", item.product_id)
      .maybeSingle();

    if (fromError || !fromStock) {
      throw new Error(`Insufficient stock for product ${item.product_id}`);
    }

    const currentFromQty = Number(fromStock.quantity ?? 0);
    if (currentFromQty < item.quantity) {
      throw new Error(`Insufficient stock for product ${item.product_id}`);
    }

    const { error: updateFromError } = await supabase
      .from("warehouse_stock")
      .update({ quantity: currentFromQty - item.quantity })
      .eq("id", fromStock.id);

    if (updateFromError) throw updateFromError;

    const { data: toStock, error: toError } = await supabase
      .from("warehouse_stock")
      .select("id, quantity")
      .eq("warehouse_id", params.to_id)
      .eq("product_id", item.product_id)
      .maybeSingle();

    if (toError) throw toError;

    if (!toStock) {
      const { error: insertToError } = await supabase
        .from("warehouse_stock")
        .insert({
          warehouse_id: params.to_id,
          product_id: item.product_id,
          quantity: item.quantity,
        });

      if (insertToError) throw insertToError;
    } else {
      const currentToQty = Number(toStock.quantity ?? 0);
      const { error: updateToError } = await supabase
        .from("warehouse_stock")
        .update({ quantity: currentToQty + item.quantity })
        .eq("id", toStock.id);

      if (updateToError) throw updateToError;
    }
  }

  await auditLog(authWithCompany, "create", "warehouse_transfer", transfer.id, validated as Record<string, unknown>);
  return jsonResponse(transfer, 201);
});

// ==================== EMPLOYEES ====================

router.get("/employees", async (req, auth) => {
  const url = new URL(req.url);
  const companyId = url.searchParams.get("company_id");
  if (!companyId) return errorResponse("company_id is required", 400);

  const authWithCompany = await requireCompanyAccess(req, companyId);
  await requirePermission(authWithCompany, "employees", "view");

  const { page, limit, sort, order, search } = parseQueryParams(url);
  const supabase = getSupabaseAdmin();

  let query = supabase
    .from("employees")
    .select("*", { count: "exact" })
    .eq("company_id", authWithCompany.companyId);

  if (search) {
    query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,document.ilike.%${search}%`);
  }

  if (sort) {
    query = query.order(sort, { ascending: order === "asc" });
  } else {
    query = query.order("created_at", { ascending: false });
  }

  const offset = (page - 1) * limit;
  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;
  if (error) throw error;

  await auditLog(authWithCompany, "read", "employees");
  return jsonResponse({
    items: data ?? [],
    pagination: getPaginationMeta(page, limit, count ?? 0),
  });
});

router.post("/employees", async (req, auth) => {
  const body = await parseJson(req);
  const companyId = String(body.company_id ?? "");
  if (!companyId) return errorResponse("company_id is required", 400);

  const authWithCompany = await requireCompanyAccess(req, companyId);
  await requirePermission(authWithCompany, "employees", "create");

  const validated = validate(CreateEmployeeSchema, body) as Record<string, any>;
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("employees")
    .insert({ ...validated, company_id: authWithCompany.companyId })
    .select()
    .single();

  if (error) throw error;
  await auditLog(authWithCompany, "create", "employee", data.id, validated as Record<string, unknown>);
  return jsonResponse(data, 201);
});

router.put("/employees/:id", async (req, auth, params) => {
  const body = await parseJson(req);
  const companyId = String(body.company_id ?? "");
  if (!companyId) return errorResponse("company_id is required", 400);

  const authWithCompany = await requireCompanyAccess(req, companyId);
  await requirePermission(authWithCompany, "employees", "edit");

  const validated = validate(UpdateEmployeeSchema, body) as Record<string, any>;
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("employees")
    .update(validated)
    .eq("id", params.id)
    .eq("company_id", authWithCompany.companyId)
    .select()
    .single();

  if (error) throw error;
  await auditLog(authWithCompany, "update", "employee", params.id, validated as Record<string, unknown>);
  return jsonResponse(data);
});

router.delete("/employees/:id", async (req, auth, params) => {
  const url = new URL(req.url);
  const companyId = url.searchParams.get("company_id");
  if (!companyId) return errorResponse("company_id is required", 400);

  const authWithCompany = await requireCompanyAccess(req, companyId);
  await requirePermission(authWithCompany, "employees", "delete");

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("employees")
    .delete()
    .eq("id", params.id)
    .eq("company_id", authWithCompany.companyId);

  if (error) throw error;
  await auditLog(authWithCompany, "delete", "employee", params.id);
  return jsonResponse({ ok: true }, 200);
});

// ==================== EXPENSES ====================

router.get("/expenses", async (req, auth) => {
  const url = new URL(req.url);
  const companyId = url.searchParams.get("company_id");
  if (!companyId) return errorResponse("company_id is required", 400);

  const authWithCompany = await requireCompanyAccess(req, companyId);
  await requirePermission(authWithCompany, "expenses", "view");

  const { page, limit, sort, order, search } = parseQueryParams(url);
  const supabase = getSupabaseAdmin();

  let query = supabase
    .from("expenses")
    .select("*", { count: "exact" })
    .eq("company_id", authWithCompany.companyId);

  if (search) {
    query = query.ilike("category", `%${search}%`);
  }

  if (sort) {
    query = query.order(sort, { ascending: order === "asc" });
  } else {
    query = query.order("expense_date", { ascending: false });
  }

  const offset = (page - 1) * limit;
  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;
  if (error) throw error;

  await auditLog(authWithCompany, "read", "expenses");
  return jsonResponse({
    items: data ?? [],
    pagination: getPaginationMeta(page, limit, count ?? 0),
  });
});

router.post("/expenses", async (req, auth) => {
  const body = await parseJson(req);
  const companyId = String(body.company_id ?? "");
  if (!companyId) return errorResponse("company_id is required", 400);

  const authWithCompany = await requireCompanyAccess(req, companyId);
  await requirePermission(authWithCompany, "expenses", "create");

  const validated = validate(CreateExpenseSchema, body) as Record<string, any>;
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("expenses")
    .insert({ ...validated, company_id: authWithCompany.companyId })
    .select()
    .single();

  if (error) throw error;
  await auditLog(authWithCompany, "create", "expense", data.id, validated as Record<string, unknown>);
  return jsonResponse(data, 201);
});

router.put("/expenses/:id", async (req, auth, params) => {
  const body = await parseJson(req);
  const companyId = String(body.company_id ?? "");
  if (!companyId) return errorResponse("company_id is required", 400);

  const authWithCompany = await requireCompanyAccess(req, companyId);
  await requirePermission(authWithCompany, "expenses", "edit");

  const validated = validate(UpdateExpenseSchema, body) as Record<string, any>;
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("expenses")
    .update(validated)
    .eq("id", params.id)
    .eq("company_id", authWithCompany.companyId)
    .select()
    .single();

  if (error) throw error;
  await auditLog(authWithCompany, "update", "expense", params.id, validated as Record<string, unknown>);
  return jsonResponse(data);
});

router.delete("/expenses/:id", async (req, auth, params) => {
  const url = new URL(req.url);
  const companyId = url.searchParams.get("company_id");
  if (!companyId) return errorResponse("company_id is required", 400);

  const authWithCompany = await requireCompanyAccess(req, companyId);
  await requirePermission(authWithCompany, "expenses", "delete");

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("expenses")
    .delete()
    .eq("id", params.id)
    .eq("company_id", authWithCompany.companyId);

  if (error) throw error;
  await auditLog(authWithCompany, "delete", "expense", params.id);
  return jsonResponse({ ok: true }, 200);
});

// ==================== BANK ACCOUNTS ====================

router.get("/bank-accounts", async (req, auth) => {
  const url = new URL(req.url);
  const companyId = url.searchParams.get("company_id");
  if (!companyId) return errorResponse("company_id is required", 400);

  const authWithCompany = await requireCompanyAccess(req, companyId);
  await requirePermission(authWithCompany, "accounting", "view");

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("bank_accounts")
    .select("*")
    .eq("company_id", authWithCompany.companyId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  await auditLog(authWithCompany, "read", "bank_accounts");
  return jsonResponse({ items: data ?? [] });
});

router.post("/bank-accounts", async (req, auth) => {
  const body = await parseJson(req);
  const companyId = String(body.company_id ?? "");
  if (!companyId) return errorResponse("company_id is required", 400);

  const authWithCompany = await requireCompanyAccess(req, companyId);
  await requirePermission(authWithCompany, "accounting", "create");

  const validated = validate(CreateBankAccountSchema, body) as Record<string, any>;
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("bank_accounts")
    .insert({ ...validated, company_id: authWithCompany.companyId })
    .select()
    .single();

  if (error) throw error;
  await auditLog(authWithCompany, "create", "bank_account", data.id, validated as Record<string, unknown>);
  return jsonResponse(data, 201);
});

router.post("/bank-accounts/:id/movements", async (req, auth, params) => {
  const body = await parseJson(req);
  const companyId = String(body.company_id ?? "");
  if (!companyId) return errorResponse("company_id is required", 400);

  const authWithCompany = await requireCompanyAccess(req, companyId);
  await requirePermission(authWithCompany, "accounting", "create");

  const supabase = getSupabaseAdmin();

  const { data: account, error: accountError } = await supabase
    .from("bank_accounts")
    .select("balance")
    .eq("id", params.id)
    .eq("company_id", authWithCompany.companyId)
    .single();

  if (accountError) throw accountError;

  const amount = Number(body.amount ?? 0);
  const movementType = body.type === "withdrawal" ? "withdrawal" : "deposit";
  const delta = movementType === "deposit" ? amount : -amount;
  const currentBalance = Number(account?.balance ?? 0);
  const nextBalance = currentBalance + delta;

  const { data: movement, error: movementError } = await supabase
    .from("bank_movements")
    .insert({
      company_id: authWithCompany.companyId,
      bank_account_id: params.id,
      type: movementType,
      amount,
      date: body.date ?? new Date().toISOString(),
      description: body.description ?? null,
    })
    .select()
    .single();

  if (movementError) throw movementError;

  const { error: balanceError } = await supabase
    .from("bank_accounts")
    .update({ balance: nextBalance })
    .eq("id", params.id)
    .eq("company_id", authWithCompany.companyId);

  if (balanceError) throw balanceError;

  await auditLog(authWithCompany, "create", "bank_movement", movement.id, movement);
  return jsonResponse(movement, 201);
});

// ==================== CHECKS ====================

router.get("/checks", async (req, auth) => {
  const url = new URL(req.url);
  const companyId = url.searchParams.get("company_id");
  if (!companyId) return errorResponse("company_id is required", 400);

  const authWithCompany = await requireCompanyAccess(req, companyId);
  await requirePermission(authWithCompany, "accounting", "view");

  const { page, limit, sort, order, search } = parseQueryParams(url);
  const supabase = getSupabaseAdmin();

  let query = supabase
    .from("checks")
    .select("*", { count: "exact" })
    .eq("company_id", authWithCompany.companyId);

  if (search) {
    query = query.ilike("check_number", `%${search}%`);
  }

  if (sort) {
    query = query.order(sort, { ascending: order === "asc" });
  } else {
    query = query.order("due_date", { ascending: false });
  }

  const offset = (page - 1) * limit;
  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;
  if (error) throw error;

  await auditLog(authWithCompany, "read", "checks");
  return jsonResponse({
    items: data ?? [],
    pagination: getPaginationMeta(page, limit, count ?? 0),
  });
});

router.post("/checks", async (req, auth) => {
  const body = await parseJson(req);
  const companyId = String(body.company_id ?? "");
  if (!companyId) return errorResponse("company_id is required", 400);

  const authWithCompany = await requireCompanyAccess(req, companyId);
  await requirePermission(authWithCompany, "accounting", "create");

  const validated = validate(CreateCheckSchema, body) as Record<string, any>;
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("checks")
    .insert({ ...validated, company_id: authWithCompany.companyId, status: "issued" })
    .select()
    .single();

  if (error) throw error;
  await auditLog(authWithCompany, "create", "check", data.id, validated as Record<string, unknown>);
  return jsonResponse(data, 201);
});

router.put("/checks/:id", async (req, auth, params) => {
  const body = await parseJson(req);
  const companyId = String(body.company_id ?? "");
  if (!companyId) return errorResponse("company_id is required", 400);

  const authWithCompany = await requireCompanyAccess(req, companyId);
  await requirePermission(authWithCompany, "accounting", "edit");

  const validated = validate(UpdateCheckSchema, body) as Record<string, any>;
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("checks")
    .update(validated)
    .eq("id", params.id)
    .eq("company_id", authWithCompany.companyId)
    .select()
    .single();

  if (error) throw error;
  await auditLog(authWithCompany, "update", "check", params.id, validated as Record<string, unknown>);
  return jsonResponse(data);
});

// ==================== AFIP ====================

router.get("/afip/invoices", async (req, auth) => {
  const url = new URL(req.url);
  const companyId = url.searchParams.get("company_id");
  if (!companyId) return errorResponse("company_id is required", 400);

  const authWithCompany = await requireCompanyAccess(req, companyId);
  await requirePermission(authWithCompany, "accounting", "view");

  const { page, limit, sort, order } = parseQueryParams(url);
  const supabase = getSupabaseAdmin();

  let query = supabase
    .from("afip_invoices")
    .select("*, customers(name), sales(id)", { count: "exact" })
    .eq("company_id", authWithCompany.companyId);

  if (sort) {
    query = query.order(sort, { ascending: order === "asc" });
  } else {
    query = query.order("created_at", { ascending: false });
  }

  const offset = (page - 1) * limit;
  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;
  if (error) throw error;

  await auditLog(authWithCompany, "read", "afip_invoices");
  return jsonResponse({
    items: data ?? [],
    pagination: getPaginationMeta(page, limit, count ?? 0),
  });
});

router.post("/afip/invoices", async (req, auth) => {
  const body = await parseJson(req);
  const companyId = String(body.company_id ?? "");
  if (!companyId) return errorResponse("company_id is required", 400);

  const authWithCompany = await requireCompanyAccess(req, companyId);
  await requirePermission(authWithCompany, "accounting", "create");

  const validated = validate(CreateAFIPInvoiceSchema, body) as Record<string, any>;
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("afip_invoices")
    .insert({
      ...validated,
      company_id: authWithCompany.companyId,
      status: "pending",
    })
    .select()
    .single();

  if (error) throw error;
  await auditLog(authWithCompany, "create", "afip_invoice", data.id, validated as Record<string, unknown>);
  await triggerWebhook(authWithCompany, "invoice.issued", { invoice_id: data.id });
  return jsonResponse(data, 201);
});

// ==================== WEBHOOKS ====================

router.get("/webhooks", async (req, auth) => {
  const url = new URL(req.url);
  const companyId = url.searchParams.get("company_id");
  if (!companyId) return errorResponse("company_id is required", 400);

  const authWithCompany = await requireCompanyAccess(req, companyId);
  await requirePermission(authWithCompany, "settings", "view");

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("webhooks")
    .select("id, url, events, active, created_at")
    .eq("company_id", authWithCompany.companyId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  await auditLog(authWithCompany, "read", "webhooks");
  return jsonResponse({ items: data ?? [] });
});

router.post("/webhooks", async (req, auth) => {
  const body = await parseJson(req);
  const companyId = String(body.company_id ?? "");
  if (!companyId) return errorResponse("company_id is required", 400);

  const authWithCompany = await requireCompanyAccess(req, companyId);
  await requirePermission(authWithCompany, "settings", "create");

  const validated = validate(CreateWebhookSchema, body) as Record<string, any>;
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("webhooks")
    .insert({ ...validated, company_id: authWithCompany.companyId })
    .select()
    .single();

  if (error) throw error;
  await auditLog(authWithCompany, "create", "webhook", data.id, validated as Record<string, unknown>);
  return jsonResponse(data, 201);
});

router.put("/webhooks/:id", async (req, auth, params) => {
  const body = await parseJson(req);
  const companyId = String(body.company_id ?? "");
  if (!companyId) return errorResponse("company_id is required", 400);

  const authWithCompany = await requireCompanyAccess(req, companyId);
  await requirePermission(authWithCompany, "settings", "edit");

  const validated = validate(UpdateWebhookSchema, body) as Record<string, any>;
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("webhooks")
    .update(validated)
    .eq("id", params.id)
    .eq("company_id", authWithCompany.companyId)
    .select()
    .single();

  if (error) throw error;
  await auditLog(authWithCompany, "update", "webhook", params.id, validated as Record<string, unknown>);
  return jsonResponse(data);
});

router.delete("/webhooks/:id", async (req, auth, params) => {
  const url = new URL(req.url);
  const companyId = url.searchParams.get("company_id");
  if (!companyId) return errorResponse("company_id is required", 400);

  const authWithCompany = await requireCompanyAccess(req, companyId);
  await requirePermission(authWithCompany, "settings", "delete");

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("webhooks")
    .delete()
    .eq("id", params.id)
    .eq("company_id", authWithCompany.companyId);

  if (error) throw error;
  await auditLog(authWithCompany, "delete", "webhook", params.id);
  return jsonResponse({ ok: true }, 200);
});

// ==================== BULK OPERATIONS ====================

router.post("/bulk/import/:resource", async (req, auth, params) => {
  const body = await parseJson(req);
  const companyId = String(body.company_id ?? "");
  if (!companyId) return errorResponse("company_id is required", 400);

  const resource = params.resource;
  const allowedResources = ["products", "customers", "suppliers", "employees"];
  if (!allowedResources.includes(resource)) {
    return errorResponse("Invalid bulk resource", 400);
  }

  const authWithCompany = await requireCompanyAccess(req, companyId);
  await requirePermission(authWithCompany, resource, "create");

  const items = Array.isArray(body.items) ? body.items : [];
  if (items.length === 0) return errorResponse("items array is required", 400);

  const supabase = getSupabaseAdmin();

  const { data: operation, error: opError } = await supabase
    .from("bulk_operations")
    .insert({
      company_id: authWithCompany.companyId,
      user_id: authWithCompany.userId,
      type: "import",
      resource,
      status: "processing",
      total_items: items.length,
      processed_items: 0,
      errors: [],
    })
    .select()
    .single();

  if (opError) throw opError;

  let processed = 0;
  const errors: string[] = [];

  for (const item of items) {
    try {
      const { error } = await supabase
        .from(resource)
        .insert({ ...item, company_id: authWithCompany.companyId });
      if (error) errors.push(`Item ${processed + 1}: ${error.message}`);
    } catch (e) {
      errors.push(`Item ${processed + 1}: ${String(e)}`);
    }
    processed += 1;
  }

  await supabase
    .from("bulk_operations")
    .update({
      status: errors.length === 0 ? "completed" : "completed_with_errors",
      processed_items: processed,
      errors: errors.length ? errors : null,
      completed_at: new Date().toISOString(),
    })
    .eq("id", operation.id);

  await auditLog(authWithCompany, "create", "bulk_operation", operation.id, {
    resource,
    processed,
    errors,
  });

  return jsonResponse(
    {
      operation_id: operation.id,
      status: errors.length === 0 ? "completed" : "completed_with_errors",
      processed,
      errors,
    },
    201
  );
});

router.get("/bulk/status/:id", async (req, auth, params) => {
  const url = new URL(req.url);
  const companyId = url.searchParams.get("company_id");
  if (!companyId) return errorResponse("company_id is required", 400);

  const authWithCompany = await requireCompanyAccess(req, companyId);
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("bulk_operations")
    .select("*")
    .eq("id", params.id)
    .eq("company_id", authWithCompany.companyId)
    .single();

  if (error) throw error;

  const total = Number(data.total_items ?? 0);
  const processed = Number(data.processed_items ?? 0);
  const progress = total > 0 ? (processed / total) * 100 : 0;

  return jsonResponse({
    id: data.id,
    status: data.status,
    progress,
    processed,
    total,
    errors: data.errors ?? [],
  });
});

// ==================== INVENTORY REPORTS ====================

router.get("/reports/inventory-status", async (req, auth) => {
  const url = new URL(req.url);
  const companyId = url.searchParams.get("company_id");
  if (!companyId) return errorResponse("company_id is required", 400);

  const authWithCompany = await requireCompanyAccess(req, companyId);
  await requirePermission(authWithCompany, "reports", "view");

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("products")
    .select("id, name, stock, min_stock, price")
    .eq("company_id", authWithCompany.companyId);

  if (error) throw error;

  const alerts = (data ?? []).filter((p: any) => Number(p.stock ?? 0) < Number(p.min_stock ?? 0));

  await auditLog(authWithCompany, "read", "reports/inventory-status");
  return jsonResponse({
    companyId,
    count: alerts.length,
    items: alerts,
  });
});

// ==================== MAIN HANDLER ====================

serve(async (req: Request) => {
  const requestId = crypto.randomUUID();
  const method = req.method.toUpperCase();
  const path = getPath(req);

  if (method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  log("info", "api_request", { requestId, method, path });

  try {
    // Auth required for all routes except /health
    let auth: AuthContext | null = null;
    if (path !== "/health") {
      auth = await requireAuth(req);

      // Rate limiting
      const rateLimitOk = await checkRateLimit(auth.userId, path);
      if (!rateLimitOk) {
        log("warn", "rate_limit_exceeded", { requestId, userId: auth.userId, path });
        return errorResponse("Rate limit exceeded", 429);
      }
    }

    // Route matching
    const match = router.match(method, path);
    if (!match) {
      return errorResponse("Not found", 404);
    }

    const response = await match.route.handler(req, auth!, match.params);

    // Add rate limit headers
    if (auth) {
      const rateLimitHeaders = getRateLimitHeaders(auth.userId, path);
      for (const [key, value] of Object.entries(rateLimitHeaders)) {
        response.headers.set(key, value);
      }
    }
    response.headers.set("X-Request-Id", requestId);

    return response;
  } catch (error) {
    log("error", "api_error", {
      requestId,
      method,
      path,
      error: error instanceof Error ? error.message : String(error),
    });

    const message = error instanceof Error ? error.message : "Unknown error";
    const status =
      message === "Unauthorized" ? 401 : message.startsWith("Forbidden") ? 403 : message.includes("Validation") ? 422 : 500;
    return errorResponse(message, status);
  }
});
