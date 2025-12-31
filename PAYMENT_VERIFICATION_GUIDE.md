# Payment Verification - Production Guide

## Overview
Sistema de verificación de pagos en signup para prevenir cuentas fraudulentas o con métodos de pago inválidos.

## Current Implementation

### Stripe Flow
1. **Step 4**: `StripeCardFields` crea PaymentMethod con `stripe.createPaymentMethod()`
2. **verify-signup-payment**: Solo verifica que el PM existe (`stripe.paymentMethods.retrieve()`)
3. **Problem**: ❌ NO valida fondos reales, solo que la tarjeta existe

### MercadoPago Flow
1. **Step 4**: MP Bricks devuelve token → `mp-test-card-token` crea preapproval de prueba
2. **verify-signup-payment**: Verifica que el preapproval existe en DB
3. **Result**: ✅ Valida fondos/tarjeta rechazada (FUND, CALL, etc.)

---

## Required Changes for Production

### 1. Stripe Payment Verification (CRITICAL)

#### Current State
```typescript
// ❌ NO VALIDA FONDOS
const pm = await stripe.paymentMethods.retrieve(payment_method_id);
// Solo verifica existencia
```

#### Production Fix - Option A: SetupIntent (Recommended)
Crear un SetupIntent con confirmación para validar la tarjeta sin cobrar:

**Frontend (StripeCardFields.tsx)**
```typescript
// Crear SetupIntent en Step 4
const { data: setupIntentData } = await supabase.functions.invoke("create-stripe-setup-intent");
const clientSecret = setupIntentData.client_secret;

// Confirmar con la tarjeta
const { setupIntent, error } = await stripe.confirmCardSetup(clientSecret, {
  payment_method: {
    card: cardElement,
  },
});

if (error) {
  // Tarjeta rechazada (fondos insuficientes, etc.)
  throw new Error(error.message);
}

// ✅ Tarjeta validada
onSuccess(setupIntent.payment_method, metadata);
```

**Backend (create-stripe-setup-intent/index.ts)**
```typescript
const setupIntent = await stripe.setupIntents.create({
  payment_method_types: ['card'],
  usage: 'off_session', // Para cargos futuros
});

return json({ client_secret: setupIntent.client_secret });
```

#### Production Fix - Option B: $0.50 Authorization Hold
Cargo temporal que se cancela inmediatamente:

```typescript
// Test con cargo de $0.50
const paymentIntent = await stripe.paymentIntents.create({
  amount: 50, // $0.50
  currency: 'usd',
  payment_method: paymentMethodId,
  confirm: true,
  capture_method: 'manual', // No capturar, solo autorizar
});

if (paymentIntent.status === 'requires_capture') {
  // ✅ Tarjeta válida con fondos
  // Cancelar el cargo
  await stripe.paymentIntents.cancel(paymentIntent.id);
} else {
  // ❌ Tarjeta rechazada
  throw new Error('Card declined');
}
```

---

### 2. Environment Variables (Production)

**Required in Supabase Edge Functions:**
```bash
# Stripe
STRIPE_SECRET_KEY=sk_live_xxxxx  # ⚠️ Cambiar de test a live
VITE_STRIPE_PUBLIC_KEY=pk_live_xxxxx

# MercadoPago
MP_ACCESS_TOKEN=APP_USR-xxxxx  # ⚠️ Cambiar de sandbox a production
VITE_MERCADOPAGO_PUBLIC_KEY=APP_USR-xxxxx

# Supabase (ya configuradas)
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
```

**Set in Supabase Dashboard:**
```bash
supabase secrets set STRIPE_SECRET_KEY=sk_live_xxxxx
supabase secrets set MP_ACCESS_TOKEN=APP_USR_production_xxxxx
```

---

### 3. Test Amount Configuration

**Development:**
- Stripe: $0.50 hold (manual capture)
- MP: $0.01 preapproval

**Production:**
- Stripe: SetupIntent (recommended) o $1.00 hold
- MP: $0.01 preapproval (mantener)

**Config File Suggestion:**
```typescript
// config/payment-verification.ts
export const PAYMENT_VERIFICATION = {
  stripe: {
    method: process.env.NODE_ENV === 'production' ? 'setup_intent' : 'charge_hold',
    testAmount: process.env.NODE_ENV === 'production' ? 100 : 50, // cents
  },
  mercadopago: {
    testAmount: 0.01, // $0.01 ARS
  },
};
```

---

### 4. Error Handling & User Experience

**Stripe Decline Codes:**
```typescript
const STRIPE_ERROR_MESSAGES = {
  'insufficient_funds': 'Fondos insuficientes',
  'card_declined': 'Tarjeta rechazada por el banco',
  'expired_card': 'Tarjeta vencida',
  'incorrect_cvc': 'Código de seguridad incorrecto',
  'processing_error': 'Error procesando el pago',
};

if (error.decline_code) {
  const userMessage = STRIPE_ERROR_MESSAGES[error.decline_code] || error.message;
  toast.error(userMessage);
}
```

**MercadoPago Error Codes (Already Implemented):**
```typescript
// ✅ Ya implementado en mp-test-card-token
if (codes.includes("FUND")) errorMsg = "Fondos insuficientes";
else if (codes.includes("CALL")) errorMsg = "Tarjeta requiere validación telefónica";
else if (codes.includes("SECU")) errorMsg = "Código de seguridad inválido";
else if (codes.includes("EXPI")) errorMsg = "Tarjeta vencida";
```

---

### 5. Database Migration (Already Applied)

```sql
-- ✅ Ya aplicado
ALTER TABLE signup_payment_methods
ADD COLUMN IF NOT EXISTS payment_verified BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS payment_error TEXT;
```

---

### 6. Edge Functions to Deploy

**Current Functions:**
```bash
✅ signup-save-payment-method     # Guarda método en staging
✅ verify-signup-payment          # Verifica (NECESITA FIX PARA STRIPE)
✅ finalize-signup                # Crea empresa con validación
✅ mp-test-card-token            # Valida tarjeta MP inmediatamente
❌ stripe-test-payment-method    # CREAR PARA STRIPE
```

**New Function Needed:**
```bash
supabase/functions/stripe-test-payment-method/index.ts
```

---

## Implementation Checklist

### Immediate (Before Production)
- [ ] **CRITICAL**: Implementar validación real de Stripe en Step 4
  - [ ] Opción A: SetupIntent (recomendado)
  - [ ] Opción B: $1 authorization hold
- [ ] Crear `stripe-test-payment-method` edge function
- [ ] Actualizar `StripeCardFields.tsx` para llamar a validación
- [ ] Cambiar env vars de test/sandbox a production
- [ ] Testing exhaustivo con tarjetas de prueba:
  - [ ] Stripe: 4242 4242 4242 4242 (success)
  - [ ] Stripe: 4000 0000 0000 9995 (insufficient funds)
  - [ ] MP: APRO (success)
  - [ ] MP: FUND (fondos insuficientes)

### Post-Launch Monitoring
- [ ] Revisar logs de `mp-test-card-token` para rechazos
- [ ] Revisar logs de `stripe-test-payment-method` para rechazos
- [ ] Monitorear `signup_payment_methods.payment_verified = false`
- [ ] Alert si muchos signups fallan en Step 4

---

## Testing Strategy

### Test Cards

**Stripe Test Cards:**
```
Success: 4242 4242 4242 4242
Insufficient Funds: 4000 0000 0000 9995
Card Declined: 4000 0000 0000 0002
Expired: 4000 0000 0000 0069
CVC Fail: 4000 0000 0000 0127
```

**MercadoPago Test Cards (AR):**
```
Success (APRO): 5031 7557 3453 0604, nombre: APRO
Fondos Insuf. (FUND): 5031 7557 3453 0604, nombre: FUND
Llamar banco (CALL): 5031 7557 3453 0604, nombre: CALL
Vencida (EXPI): 5031 7557 3453 0604, nombre: EXPI
CVC inválido (SECU): 5031 7557 3453 0604, nombre: SECU
```

### Test Scenarios
1. **Happy Path**: Tarjeta válida → avanza a Step 5 → crea cuenta
2. **Fondos Insuficientes**: Error en Step 4 → NO avanza → NO crea cuenta
3. **Tarjeta Vencida**: Error en Step 4 → NO avanza → NO crea cuenta
4. **Re-intento**: Usuario puede corregir y volver a intentar
5. **Timeout**: Token MP expira → validar antes de guardar

---

## Security Considerations

### PCI Compliance
- ✅ **NO guardamos números de tarjeta** (solo tokens/PMs)
- ✅ **Stripe Elements** maneja datos sensibles
- ✅ **MP Bricks** maneja datos sensibles
- ✅ **HTTPS** en producción
- ⚠️ **Logs**: No loguear datos de tarjeta

### Rate Limiting
Considerar agregar rate limiting en edge functions:
```typescript
// Ejemplo en mp-test-card-token
const MAX_ATTEMPTS_PER_EMAIL = 5;
const WINDOW_MINUTES = 15;

const attempts = await redis.incr(`signup:${email}:attempts`);
if (attempts > MAX_ATTEMPTS_PER_EMAIL) {
  return json({ error: "Too many attempts" }, 429);
}
await redis.expire(`signup:${email}:attempts`, WINDOW_MINUTES * 60);
```

### Fraud Detection
Considerar integrar:
- Stripe Radar (detección automática de fraude)
- MP Device Fingerprinting
- Verificación de email (ya implementado?)

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        STEP 4 PAYMENT                        │
└─────────────────────────────────────────────────────────────┘
                              │
                ┌─────────────┴──────────────┐
                │                            │
         ┌──────▼──────┐            ┌────────▼────────┐
         │   STRIPE    │            │  MERCADO PAGO   │
         │ CardFields  │            │    Bricks       │
         └──────┬──────┘            └────────┬────────┘
                │                            │
                │ createPaymentMethod        │ token (expires!)
                │                            │
                ▼                            ▼
    ┌───────────────────────┐   ┌──────────────────────────┐
    │ stripe-test-payment   │   │  mp-test-card-token      │
    │ - SetupIntent or      │   │  - Create preapproval    │
    │ - $1 auth hold        │   │  - Test card NOW         │
    │ ✅ Validates funds    │   │  ✅ Validates funds      │
    └───────────┬───────────┘   └──────────┬───────────────┘
                │                          │
                │ PM ID                    │ Preapproval ID
                │                          │
                └──────────┬───────────────┘
                           ▼
              ┌─────────────────────────┐
              │ signup-save-payment     │
              │ - Stores in staging DB  │
              │ - Includes metadata     │
              └─────────────┬───────────┘
                            │
                            ▼
              ┌─────────────────────────┐
              │ verify-signup-payment   │
              │ - Checks payment_verified│
              │ - Rejects if false      │
              └─────────────┬───────────┘
                            │
                     Step 5 ✅ Password
                            │
                            ▼
              ┌─────────────────────────┐
              │   finalize-signup       │
              │ - Creates company       │
              │ - Links payment method  │
              │ - ONLY if verified=true │
              └─────────────────────────┘
```

---

## Cost Analysis

### Stripe
- **SetupIntent**: $0 (free)
- **Auth Hold $1**: $0.30 + 2.9% = ~$0.33 per signup attempt
  - Refunded automatically, pero Stripe cobra fee
  - **Recommendation**: Use SetupIntent

### MercadoPago
- **Preapproval $0.01**: Minimal fee (~$0.001 ARS)
- **Current implementation**: ✅ Cost-effective

---

## Rollback Plan

If issues in production:

1. **Disable payment verification temporarily:**
```typescript
// In verify-signup-payment
const SKIP_VERIFICATION = Deno.env.get("SKIP_PAYMENT_VERIFICATION") === "true";
if (SKIP_VERIFICATION) {
  paymentVerified = true;
  console.warn("SKIPPING payment verification (emergency mode)");
}
```

2. **Revert to old behavior:**
```bash
git revert <commit-hash>
npm run build
git push
```

3. **Monitor failed signups:**
```sql
SELECT email, payment_error, created_at
FROM signup_payment_methods
WHERE payment_verified = false
ORDER BY created_at DESC;
```

---

## Contact & Support

**Edge Function Logs:**
```bash
supabase functions logs mp-test-card-token
supabase functions logs verify-signup-payment
supabase functions logs finalize-signup
```

**Database Queries:**
```sql
-- Check failed payments
SELECT * FROM signup_payment_methods WHERE payment_verified = false;

-- Check successful signups
SELECT s.email, c.company_name, s.created_at
FROM signup_payment_methods s
JOIN companies c ON s.linked_to_company_id = c.id
WHERE s.payment_verified = true;
```
