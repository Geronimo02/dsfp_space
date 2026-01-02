# Solución a errores en Step 4

## Error 1: "Could not find the 'plan_id' column"

La migración no se aplicó en la base de datos remota. Necesitas ejecutar esto:

### Opción A: Supabase Dashboard (RECOMENDADO)
1. Abre https://supabase.com/dashboard/project/pjcfncnydhxrlnaowbae/sql/new
2. Pega este SQL:

```sql
ALTER TABLE signup_payment_methods 
ADD COLUMN IF NOT EXISTS plan_id UUID REFERENCES subscription_plans(id),
ADD COLUMN IF NOT EXISTS amount DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'USD',
ADD COLUMN IF NOT EXISTS payment_id TEXT;

COMMENT ON COLUMN signup_payment_methods.plan_id IS 'Selected subscription plan to charge';
COMMENT ON COLUMN signup_payment_methods.amount IS 'Amount charged for the subscription';
COMMENT ON COLUMN signup_payment_methods.payment_id IS 'Stripe PaymentIntent ID or MercadoPago payment ID';
```

3. Haz clic en "Run"

### Opción B: CLI (si necesitas sincronizar todas las migraciones)
```bash
# Primero repara el historial de migraciones
supabase migration repair --status reverted [lista de IDs que te dió el error]

# Luego intenta push de nuevo
supabase db push
```

## Error 2: Botones duplicados

Si ves dos botones en Step 4:
- El botón "Guardar y continuar" está DENTRO de MercadoPagoCardFields/StripeCardFields - este es el correcto
- Si hay otro botón visible, puede ser del wizard padre o un problema de CSS/layout

Los componentes están correctos, cada uno tiene su propio botón de submit que llama a `handlePaymentSuccess`.

## Verificación después de aplicar el SQL

Después de ejecutar el SQL en Supabase Dashboard, refresca la página del signup y debería funcionar correctamente.
