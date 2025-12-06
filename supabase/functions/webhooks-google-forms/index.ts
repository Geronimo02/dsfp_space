/// <reference types="jsr:@supabase/functions-js/edge-runtime.d.ts" />
// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4?dts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function pickFirst(nv: any, key: string) {
  const v = nv?.[key];
  if (!v) return null;
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}

/** Busca en namedValues una key que empiece con "[tag]" (ej: "[customer_name] Nombre completo") */
function pickByTag(namedValues: Record<string, any>, tag: string) {
  const prefix = `[${tag}]`;
  const key = Object.keys(namedValues ?? {}).find((k) => k.trim().startsWith(prefix));
  if (!key) return null;
  return pickFirst(namedValues, key);
}

/** fallback por contains (por si no hay tags) */
function pickByContains(namedValues: Record<string, any>, contains: string[]) {
  const keys = Object.keys(namedValues ?? {});
  const key = keys.find((k) => contains.some((c) => k.toLowerCase().includes(c.toLowerCase())));
  if (!key) return null;
  return pickFirst(namedValues, key);
}

/** Normaliza strings numéricas: "12.500,50" -> 12500.50 ; "12,5" -> 12.5 ; "$ 1,200" -> 1200 */
function parseMoneyLike(input: any): number | null {
  if (input === null || input === undefined) return null;
  if (typeof input === "number") return Number.isFinite(input) ? input : null;

  const raw = String(input).trim();
  if (!raw) return null;

  // sacamos símbolos y espacios, dejamos dígitos, comas, puntos y signo
  let s = raw.replace(/[^\d.,-]/g, "");

  if (!s) return null;

  // Caso con ambas: "." y ","
  // Si la última ocurrencia es "," => decimal ",", miles "."
  // Si la última ocurrencia es "." => decimal ".", miles ","
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");

  if (lastComma !== -1 && lastDot !== -1) {
    if (lastComma > lastDot) {
      // decimal ","
      s = s.replace(/\./g, "");
      s = s.replace(",", ".");
    } else {
      // decimal "."
      s = s.replace(/,/g, "");
    }
  } else if (lastComma !== -1) {
    // solo coma: asumimos decimal coma si hay 1 coma y <=2 decimales
    // si hay muchas comas, las tomamos como miles
    const parts = s.split(",");
    if (parts.length === 2 && parts[1].length <= 2) {
      s = parts[0].replace(/\./g, "") + "." + parts[1];
    } else {
      s = s.replace(/,/g, "");
    }
  } else {
    // solo puntos: puede ser miles o decimal
    const parts = s.split(".");
    if (parts.length === 2 && parts[1].length <= 2) {
      // decimal
      s = parts[0].replace(/,/g, "") + "." + parts[1];
    } else {
      // miles
      s = s.replace(/\./g, "");
      s = s.replace(/,/g, "");
    }
  }

  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function parseIntLike(input: any): number | null {
  const n = parseMoneyLike(input);
  if (n === null) return null;
  const i = Math.floor(n);
  return Number.isFinite(i) ? i : null;
}

function safeIsoDate(input: any): string {
  try {
    if (!input) return new Date().toISOString();
    const d = new Date(input);
    if (Number.isNaN(d.getTime())) return new Date().toISOString();
    return d.toISOString();
  } catch {
    return new Date().toISOString();
  }
}

type Item = {
  product: string;
  qty: number;
  unit_price: number | null;
  line_total: number | null;
  notes?: string | null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let body: any = {};
  try {
    body = await req.json();
  } catch (e) {
    return json({ error: "Invalid JSON body", detail: String(e) }, 400);
  }

  if (body?._ping === true) return json({ ok: true, message: "Webhook OK!" }, 200);

  const supabaseUrl = Deno.env.get("SB_URL") ?? Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SB_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return json({ error: "Missing env vars" }, 500);
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceKey);

  const integrationId = body?.integrationId ?? new URL(req.url).searchParams.get("integrationId");
  const secret = body?.secret;

  const namedValues = body?.namedValues ?? {};
  const values = body?.values ?? [];
  const submittedAtRaw = body?.submittedAt ?? new Date().toISOString();
  const submittedAt = safeIsoDate(submittedAtRaw);

  const meta = body?.meta ?? {};

  if (!integrationId) return json({ error: "Missing integrationId" }, 400);
  if (!secret) return json({ error: "Missing secret" }, 400);

  // Credenciales
  const { data: cred, error: credErr } = await supabaseAdmin
    .from("integration_credentials")
    .select("company_id, credentials")
    .eq("integration_id", integrationId)
    .maybeSingle();

  if (credErr) return json({ error: credErr.message }, 500);
  if (!cred) return json({ error: "Credentials not found. Primero hacé 'Guardar integración'." }, 404);

  const expected = (cred as any).credentials?.webhookSecret;
  if (!expected || expected !== secret) return json({ error: "Unauthorized (bad secret)" }, 401);

  if (body?._test === true) {
    return json({ ok: true, message: "Test received (secret ok)" }, 200);
  }

  // ------------------------
  // Parse customer + header
  // ------------------------
  const customerName =
    pickByTag(namedValues, "customer_name") ??
    pickByContains(namedValues, ["nombre completo", "nombre y apellido", "cliente", "nombre"]) ??
    "Sin nombre";

  const customerPhone =
    pickByTag(namedValues, "customer_phone") ??
    pickByContains(namedValues, ["whatsapp", "tel", "telefono", "phone"]) ??
    null;

  const customerEmail =
    pickByTag(namedValues, "customer_email") ??
    pickByContains(namedValues, ["email", "correo"]) ??
    null;

  const currency =
    (pickByTag(namedValues, "currency") ??
      pickByContains(namedValues, ["moneda", "currency"]) ??
      null) as string | null;

  const extraCost = parseMoneyLike(
    pickByTag(namedValues, "extra_cost") ??
      pickByContains(namedValues, ["envío", "envio", "costo extra", "extra"]) ??
      null
  );

  const notes =
    pickByTag(namedValues, "notes") ??
    pickByContains(namedValues, ["notas generales", "nota", "observaciones"]) ??
    null;

  const paymentTerms =
    pickByTag(namedValues, "payment_terms") ??
    pickByContains(namedValues, ["condiciones de pago", "pago"]) ??
    null;

  const dueDate =
    pickByTag(namedValues, "due_date") ??
    pickByContains(namedValues, ["fecha límite", "vencimiento"]) ??
    null;

  // ------------------------
  // Parse items (item1..item5)
  // ------------------------
  const MAX_ITEMS = 5;

  const items: Item[] = [];
  for (let i = 1; i <= MAX_ITEMS; i++) {
    const product =
      pickByTag(namedValues, `item${i}_product`) ??
      pickByContains(namedValues, [`producto ${i}`, `producto${i}`]) ??
      null;

    // si no hay product, asumimos que ese item no existe
    if (!product) continue;

    const qtyRaw =
      pickByTag(namedValues, `item${i}_qty`) ??
      pickByContains(namedValues, [`cantidad ${i}`, `qty ${i}`, `cantidad${i}`]) ??
      "1";

    const qty = Math.max(1, parseIntLike(qtyRaw) ?? 1);

    const unitPriceRaw =
      pickByTag(namedValues, `item${i}_price`) ??
      pickByContains(namedValues, [`precio unitario ${i}`, `precio ${i}`, `price ${i}`]) ??
      null;

    const unit_price = parseMoneyLike(unitPriceRaw);

    const line_total = unit_price !== null ? unit_price * qty : null;

    const itemNotes =
      pickByTag(namedValues, `item${i}_notes`) ??
      pickByContains(namedValues, [`nota ${i}`, `notas ${i}`]) ??
      null;

    items.push({
      product: String(product),
      qty,
      unit_price,
      line_total,
      notes: itemNotes,
    });
  }

  // Si por error no había tags, intentá un fallback mínimo con "Producto" y "Precio unitario"
  if (items.length === 0) {
    const productFallback = pickByContains(namedValues, ["producto"]);
    const priceFallback = parseMoneyLike(pickByContains(namedValues, ["precio unitario", "precio"]));
    if (productFallback) {
      items.push({
        product: String(productFallback),
        qty: 1,
        unit_price: priceFallback,
        line_total: priceFallback !== null ? priceFallback : null,
      });
    }
  }

  const items_count = items.reduce((acc, it) => acc + (it.qty ?? 0), 0) || null;

  const sumItems = items.reduce((acc, it) => acc + (it.line_total ?? 0), 0);
  const total_amount = (sumItems + (extraCost ?? 0)) || null;

  // ------------------------
  // external_order_id (idempotencia)
  // ------------------------
  // Si tu Apps Script manda un ID de respuesta, usalo. Si no, generamos determinístico por timestamp+rand
  const responseId = meta?.responseId ?? null;
  const external_order_id = responseId
    ? `gforms_${responseId}`
    : `gforms_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;

  // ------------------------
  // Insert
  // ------------------------
  const nowIso = new Date().toISOString();

  const order_data = {
    source: "google_forms",
    submittedAt,
    customer: { name: customerName, email: customerEmail, phone: customerPhone },
    currency: currency ?? null,
    extra_cost: extraCost ?? null,
    notes: notes ?? null,
    payment_terms: paymentTerms ?? null,
    due_date: dueDate ?? null,
    items,
    totals: {
      items_total: sumItems || null,
      total_amount,
      items_count,
    },
    raw: {
      namedValues,
      values,
      meta,
    },
    computedAt: nowIso,
  };

  const { error: insErr } = await supabaseAdmin.from("integration_orders").insert({
    integration_id: integrationId,
    company_id: (cred as any).company_id,
    external_order_id,
    customer_name: String(customerName ?? "Sin nombre"),
    customer_email: customerEmail ? String(customerEmail) : null,
    customer_phone: customerPhone ? String(customerPhone) : null,
    order_data,
    status: "pending",
    processed_at: null,
    error_message: null,

    // nuevos campos
    currency: currency ? String(currency).toUpperCase() : null,
    total_amount,
    items_count,
    external_created_at: submittedAt,
    attempts: 0,
    last_attempt_at: null,
    retry_after: null,
  });

  if (insErr) {
    // Si pega unique(integration_id, external_order_id) por idempotencia: devolver ok y listo
    // Postgres error code 23505 = unique_violation
    const code = (insErr as any)?.code;
    if (code === "23505") {
      return json({ ok: true, external_order_id, message: "Duplicate ignored (idempotent)" }, 200);
    }
    return json({ error: insErr.message, detail: insErr }, 400);
  }

  return json(
    {
      ok: true,
      external_order_id,
      parsed: {
        customerName,
        items_count,
        total_amount,
        currency: currency ? String(currency).toUpperCase() : null,
        items,
      },
    },
    200
  );
});
