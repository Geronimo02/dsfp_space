import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export default function SignupFlowTester() {
  const [provider, setProvider] = useState<"stripe" | "mercadopago">("mercadopago");
  const [email, setEmail] = useState("test@empresa.com");
  const [fullName, setFullName] = useState("Test Owner");
  const [companyName, setCompanyName] = useState("Empresa Test");
  const [planId, setPlanId] = useState("");
  const [modules, setModules] = useState("inventory,reports");
  const [password, setPassword] = useState("PasswordSegura123");

  const [intentId, setIntentId] = useState<string>("");
  const [checkoutUrl, setCheckoutUrl] = useState<string>("");
  const [log, setLog] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const modulesArr = modules
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);

  async function createIntent() {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-intent", {
        body: {
          email,
          full_name: fullName,
          company_name: companyName,
          plan_id: planId,
          modules: modulesArr,
          provider,
        },
      });
      if (error) throw error;
      setIntentId(data.intent_id);
      setLog({ step: "create-intent", data });
    } catch (e: any) {
      setLog({ step: "create-intent", error: String(e?.message ?? e) });
    } finally {
      setLoading(false);
    }
  }

  async function startCheckout() {
    if (!intentId) {
      setLog({ step: "start-checkout", error: "Falta intentId" });
      return;
    }
    setLoading(true);
    try {
      const success_url = `${window.location.origin}/signup/success?intent_id=${intentId}`;
      const cancel_url = `${window.location.origin}/signup/cancel?intent_id=${intentId}`;

      const { data, error } = await supabase.functions.invoke("start-checkout", {
        body: { intent_id: intentId, success_url, cancel_url },
      });
      if (error) throw error;

      setCheckoutUrl(data.checkout_url);
      setLog({ step: "start-checkout", data });

      // Redirigir directamente
      window.location.href = data.checkout_url;
    } catch (e: any) {
      setLog({ step: "start-checkout", error: String(e?.message ?? e) });
    } finally {
      setLoading(false);
    }
  }

  async function finalizeSignup() {
    if (!intentId) {
      setLog({ step: "finalize-signup", error: "Falta intentId" });
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("finalize-signup", {
        body: { intent_id: intentId, password },
      });
      if (error) throw error;
      setLog({ step: "finalize-signup", data });
    } catch (e: any) {
      setLog({ step: "finalize-signup", error: String(e?.message ?? e) });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 720, margin: "24px auto", padding: 16, border: "1px solid #ddd", borderRadius: 12 }}>
      <h2>Signup Flow Tester (DEV)</h2>

      <div style={{ display: "grid", gap: 10 }}>
        <label>
          Provider:
          <select value={provider} onChange={(e) => setProvider(e.target.value as any)}>
            <option value="mercadopago">mercadopago</option>
            <option value="stripe">stripe</option>
          </select>
        </label>

        <label>Email: <input value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <label>Full name: <input value={fullName} onChange={(e) => setFullName(e.target.value)} /></label>
        <label>Company name: <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} /></label>
        <label>Plan ID: <input value={planId} onChange={(e) => setPlanId(e.target.value)} placeholder="UUID de subscription_plans" /></label>
        <label>Modules (csv): <input value={modules} onChange={(e) => setModules(e.target.value)} /></label>
        <label>Password: <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button disabled={loading} onClick={createIntent}>1) Create Intent</button>
          <button disabled={loading || !intentId} onClick={startCheckout}>2) Start Checkout</button>
          <button disabled={loading || !intentId} onClick={finalizeSignup}>3) Finalize Signup</button>
        </div>

        <div>
          <div><b>intent_id:</b> {intentId || "-"}</div>
          <div><b>checkout_url:</b> {checkoutUrl ? <a href={checkoutUrl} target="_blank">abrir</a> : "-"}</div>
        </div>

        <pre style={{ background: "#f7f7f7", padding: 12, borderRadius: 8, overflowX: "auto" }}>
          {JSON.stringify(log, null, 2)}
        </pre>
      </div>
    </div>
  );
}
