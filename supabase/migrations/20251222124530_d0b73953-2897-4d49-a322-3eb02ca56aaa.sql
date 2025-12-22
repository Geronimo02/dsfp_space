-- Fix remaining functions without search_path (non SECURITY DEFINER but still recommended)

ALTER FUNCTION public.activate_base_modules_for_company() SET search_path = public;
ALTER FUNCTION public.auto_generate_customer_support_ticket_number() SET search_path = public;
ALTER FUNCTION public.calculate_onboarding_completion() SET search_path = public;
ALTER FUNCTION public.create_company_onboarding_record() SET search_path = public;
ALTER FUNCTION public.create_sale_account_movement() SET search_path = public;
ALTER FUNCTION public.ensure_single_default_price_list() SET search_path = public;
ALTER FUNCTION public.format_comprobante_number(integer, integer) SET search_path = public;
ALTER FUNCTION public.generate_customer_support_ticket_number() SET search_path = public;
ALTER FUNCTION public.generate_platform_ticket_number() SET search_path = public;
ALTER FUNCTION public.integration_orders_counts(uuid) SET search_path = public;
ALTER FUNCTION public.set_platform_ticket_number() SET search_path = public;
ALTER FUNCTION public.update_commissions_updated_at() SET search_path = public;
ALTER FUNCTION public.update_company_custom_pricing_updated_at() SET search_path = public;
ALTER FUNCTION public.update_customer_balance() SET search_path = public;
ALTER FUNCTION public.update_customer_support_ticket_timestamp() SET search_path = public;
ALTER FUNCTION public.update_exchange_rate_settings_updated_at() SET search_path = public;
ALTER FUNCTION public.update_pos_afip_timestamp() SET search_path = public;
ALTER FUNCTION public.update_price_lists_updated_at() SET search_path = public;
ALTER FUNCTION public.update_product_prices_updated_at() SET search_path = public;
ALTER FUNCTION public.update_purchase_orders_updated_at() SET search_path = public;
ALTER FUNCTION public.update_support_ticket_updated_at() SET search_path = public;
ALTER FUNCTION public.update_ticket_config_updated_at() SET search_path = public;
ALTER FUNCTION public.update_updated_at_column() SET search_path = public;