// supabase/functions/create-intent/index.ts
import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

async function fetchWithTimeout(url: string, ms: number): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

async function getUsdToArsRate(): Promise<number> {
  const res = await fetchWithTimeout(
    "https://api.exchangerate.host/latest?base=USD&symbols=ARS",
    8000
  );
  if (!res.ok) throw new Error(`FX HTTP ${res.status}`);
  const data = await res.json();
  const rate = data?.rates?.ARS;
  if (typeof rate !== "number" || !isFinite(rate) || rate <= 0) {
    throw new Error("FX inválido (USD→ARS)");
  }
  return rate;
}

export default async (req: Request) => {
    if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  try {
    const body = await req.json();
    const { email, full_name, company_name, plan_id, modules, provider } = body;

    if (!email || !plan_id || !provider) {
      return Response.json(
        { error: "email, plan_id y provider son requeridos" },
        { status: 400 }
      );
    }

    const providerNorm = String(provider);
    if (!["stripe", "mercadopago"].includes(providerNorm)) {
      return Response.json(
        { error: "provider inválido (stripe | mercadopago)" },
        { status: 400 }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1) validar plan activo + obtener precio base (USD)
    const { data: plan, error: planErr } = await supabaseAdmin
      .from("subscription_plans")
      .select("id, price, active")
      .eq("id", plan_id)
      .single();

    if (planErr || !plan || !plan.active) {
      return Response.json({ error: "Plan inválido o inactivo" }, { status: 400 });
    }

    // 2) calcular total USD (server-side)
    const modulesArr: string[] = Array.isArray(modules) ? modules : [];
    const modulesPrice = modulesArr.length * 10; // TODO: pricing real
    const amount_usd = round2(Number(plan.price) + modulesPrice);

    if (!isFinite(amount_usd) || amount_usd <= 0) {
      return Response.json({ error: "amount_usd inválido" }, { status: 400 });
    }

    // 3) FX solo para Mercado Pago
    let fx_rate_usd_ars: number | null = null;
    let fx_rate_at: string | null = null;
    let amount_ars: number | null = null;

    if (providerNorm === "mercadopago") {
      const fx = await getUsdToArsRate();
      fx_rate_usd_ars = fx;
      fx_rate_at = new Date().toISOString();
      amount_ars = round2(amount_usd * fx);

      if (!isFinite(amount_ars) || amount_ars <= 0) {
        return Response.json({ error: "amount_ars inválido" }, { status: 400 });
      }
    }

    // 4) insertar intent
    const { data: intent, error: insErr } = await supabaseAdmin
      .from("signup_intents")
      .insert({
        email: String(email).trim().toLowerCase(),
        full_name: full_name ?? null,
        company_name: company_name ?? null,
        plan_id,
        modules: modulesArr,
        provider: providerNorm,
        status: "draft",
        amount_usd,
        amount_ars,
        fx_rate_usd_ars,
        fx_rate_at,
      })
      .select("id")
      .single();

    if (insErr) throw insErr;

    return Response.json({ intent_id: intent.id });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
};
