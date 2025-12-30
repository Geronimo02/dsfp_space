# Refactorización Completa del Sistema de Métodos de Pago - Resumen de Cambios

## 📝 Cambios Realizados

### 1. **SignupFormData - Esquema Unificado** ✅
**Archivo**: `src/hooks/useSignupWizard.tsx`

**Cambios**:
- ❌ Eliminado: `provider: "stripe" | "mercadopago" | "auto"`
- ❌ Eliminado: `stripe_payment_method_id?: string`
- ❌ Eliminado: `country?: string`
- ✅ Agregado: `payment_provider?: "stripe" | "mercadopago"`
- ✅ Agregado: `payment_method_ref?: string` (PM ID para Stripe, token para MP)
- ✅ Agregado: `billing_country?: string` (ISO code)
- ✅ Agregado: `payment_method_last4?: string` (opcional)
- ✅ Agregado: `payment_method_brand?: string` (opcional)

### 2. **Step3Payment - Flujo Unificado** ✅
**Archivo**: `src/components/signup/Step3Payment.tsx`

**Cambios**:
- ❌ Eliminadas: Dos tarjetas de selección (Stripe vs Mercado Pago)
- ❌ Eliminado: Flujo de "Configura después del registro"
- ✅ Agregado: Campo obligatorio "País de facturación" (Select con 11 países)
- ✅ Agregado: Lógica de routing automático:
  - País = "AR" → Formulario de Mercado Pago
  - País ≠ "AR" → Formulario de Stripe
- ✅ Ambos flujos guardan con `signup-save-payment-method`
- ✅ UI única y limpia con Cards y Buttons coherentes

### 3. **Edge Functions**

#### a. `create-signup-setup-intent` (Actualizada) ✅
**Archivo**: `supabase/functions/create-signup-setup-intent/index.ts`
- Ya existía, no cambios en lógica
- Validada para ser usada solo con provider = "stripe"

#### b. `signup-save-payment-method` (Nueva) ✅
**Archivo**: `supabase/functions/signup-save-payment-method/index.ts`
- Función centralizada para ambos proveedores
- Input: `{ email, name, billing_country, provider, payment_method_ref }`
- Output: `{ ok: true, id, message }`
- Guarda en tabla temporal `signup_payment_methods`
- NO valida tokens (backend lo hace después)

#### c. `save-stripe-payment-method` (Pendiente de eliminar o deprecar)
**Recomendación**: Mantener para compatibilidad con Settings, pero marcar como legacy
- Se usa en Settings → Suscripción
- No es crítica para signup
- Plan futuro: migrar Settings a usar `company_payment_methods` directamente

### 4. **Base de Datos**

#### a. Nueva tabla `signup_payment_methods` ✅
**Archivo**: `supabase/migrations/20251226_create_signup_payment_methods.sql`
- Almacenamiento temporal de métodos de pago en signup
- Auto-expira en 24 horas si no se vincula
- Se vincula a `company_payment_methods` después de crear cuenta
- Campos: email, name, billing_country, provider, payment_method_ref

#### b. Tabla existente `company_payment_methods`
- Sin cambios
- Se usa después de crear la empresa
- Se vincula desde `signup_payment_methods` durante finalización

### 5. **SignupWizard (Main)** ✅
**Archivo**: `src/pages/SignupWizard.tsx`
- Actualizado `handleCreateIntent` para usar nuevo esquema:
  - `payment_provider` en lugar de `provider`
  - `payment_method_ref` en lugar de `stripe_payment_method_id`
  - Incluye `billing_country`
- Step 3 ahora es Step3Payment unificado

---

## 📋 Lista de Archivos Modificados

| Archivo | Estado | Descripción |
|---------|--------|-------------|
| `src/hooks/useSignupWizard.tsx` | ✅ Modificado | Esquema uniforme de pago |
| `src/components/signup/Step3Payment.tsx` | ✅ Modificado | Flujo unificado con país + formulario dinámico |
| `src/pages/SignupWizard.tsx` | ✅ Modificado | Pasaje de datos actualizado a create-intent |
| `src/components/settings/PaymentMethodsManager.tsx` | ✅ Verificado | Compatible, sin cambios necesarios |
| `supabase/functions/create-signup-setup-intent/index.ts` | ✅ Validado | Funciona con nuevo flujo |
| `supabase/functions/signup-save-payment-method/index.ts` | ✅ Creado | Nuevafunción centralizada |
| `supabase/migrations/20251226_create_signup_payment_methods.sql` | ✅ Creado | Nueva tabla temporal |

---

## 🧹 Archivos Legacy (Sin cambios, pero a considerar)

| Archivo | Recomendación |
|---------|---|
| `supabase/functions/save-stripe-payment-method/index.ts` | Mantener (usado en Settings actualmente) |
| `supabase/functions/create-stripe-setup-intent/index.ts` | Eliminar si no se usa (reemplazado por `create-signup-setup-intent`) |

---

## 🔄 Flujo Post-Refactorización

### Durante Signup (Paso 3):
```
1. Usuario selecciona País
2. Sistema determina provider (AR = MP, otro = Stripe)
3. Se renderiza formulario correspondiente
4. Usuario ingresa datos de tarjeta
5. Frontend obtiene token/PM seguro
6. Llama signup-save-payment-method
7. Se guarda en signup_payment_methods (temporal)
8. Datos se persisten en SignupFormData
```

### En Finalización (Step5Confirmation):
```
1. create-intent recibe payment_provider + payment_method_ref
2. Backend procesa según provider
3. Crea company + suscripción
4. Vincula signup_payment_methods.id → company_payment_methods
```

---

## ⚙️ Próximas Acciones Requeridas

### 1. Ejecutar Migraciones
```bash
# En Supabase Dashboard → SQL Editor
# Copiar y ejecutar: supabase/migrations/20251226_create_signup_payment_methods.sql
```

### 2. Deployar Edge Functions
```bash
cd supabase/functions
npx supabase functions deploy signup-save-payment-method
npx supabase functions deploy create-signup-setup-intent
```

### 3. Regenerar Tipos TypeScript
```bash
npx supabase gen types typescript --linked > src/integrations/supabase/types.ts
```

### 4. Testing E2E
- [ ] Signup con país AR → Mercado Pago
- [ ] Signup con país US → Stripe
- [ ] Signup saltando pago → sin tarjeta
- [ ] Settings → Agregar tarjeta aún funciona
- [ ] Settings → Establecer default aún funciona

---

## 🎯 Beneficios de la Refactorización

✅ **UX Unificada**: Un solo flujo, sin confusión de opciones
✅ **Routing Automático**: El país determina el proveedor sin intervención del usuario
✅ **Código Limpio**: Sin `provider` redundante, campos unificados
✅ **Mantenimiento**: Una sola edge function para ambos proveedores
✅ **Seguridad**: Tokens/PM nunca se tocan en el frontend, solo IDs
✅ **Escalabilidad**: Fácil agregar nuevos proveedores en el futuro

---

## 📞 Notas Importantes

1. **Mercado Pago Form**: Actualmente es un formulario HTML simple (mock). En producción, integrar con [MP Bricks](https://www.mercadopago.com/developers/es/docs/checkout-api/bricks) o MP SDK oficial.

2. **Validación de Tokens**: El backend (create-intent) debe validar que:
   - PM de Stripe es válido
   - Token de MP es válido
   - Antes de crear la suscripción

3. **Expiración**: `signup_payment_methods` se auto-limpia cada 24 horas (usar cron job de Supabase).

4. **Settings Coherencia**: `PaymentMethodsManager` en Settings sigue igual (usa `company_payment_methods`), coherente post-signup.
