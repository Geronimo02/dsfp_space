// supabase/functions/mp-create-token/index.ts
import { corsHeaders } from "../_shared/cors.ts";

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return json({ error: "Only POST allowed" }, 405);
    }

    const body = await req.json();

    const {
      cardNumber,
      cardholderName,
      cardExpirationMonth,
      cardExpirationYear,
      securityCode,
    } = body;

    if (!cardNumber || !cardholderName || !cardExpirationMonth || !cardExpirationYear || !securityCode) {
      return json(
        { error: "cardNumber, cardholderName, cardExpirationMonth, cardExpirationYear, securityCode son requeridos" },
        400
      );
    }

    const mpPublicKey = Deno.env.get("MERCADOPAGO_PUBLIC_KEY");
    if (!mpPublicKey) {
      return json({ error: "MERCADOPAGO_PUBLIC_KEY no configurada" }, 500);
    }

    // Call Mercado Pago API to create card token
    const response = await fetch("https://api.mercadopago.com/v1/card_tokens", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${mpPublicKey}`,
      },
      body: JSON.stringify({
        cardNumber: cardNumber,
        cardholderName: cardholderName,
        cardExpirationMonth: cardExpirationMonth,
        cardExpirationYear: cardExpirationYear,
        securityCode: securityCode,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("[MP] Token creation failed:", errorData);
      return json(
        { error: errorData.message || "Error al crear token de tarjeta" },
        response.status
      );
    }

    const data = await response.json();
    console.log("[MP] Token created successfully:", data.id);

    return json({ id: data.id }, 200);
  } catch (error) {
    console.error("[MP] Error:", error);
    return json({ error: error.message || "Error interno" }, 500);
  }
});
