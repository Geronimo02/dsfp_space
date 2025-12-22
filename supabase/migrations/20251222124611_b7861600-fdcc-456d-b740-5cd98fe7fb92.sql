-- Fix all remaining SECURITY DEFINER functions without search_path

-- Functions with their exact signatures
ALTER FUNCTION public.apply_payment_to_invoice(p_payment_id uuid, p_sale_id uuid, p_customer_id uuid, p_amount_applied numeric, p_user_id uuid) SET search_path = public;
ALTER FUNCTION public.assign_base_modules_to_new_company() SET search_path = public;
ALTER FUNCTION public.calculate_company_subscription_price(p_company_id uuid, p_billing_cycle text, p_invoice_volume integer) SET search_path = public;
ALTER FUNCTION public.complete_stock_reservation() SET search_path = public;
ALTER FUNCTION public.create_customer_payment(p_customer_id uuid, p_amount numeric, p_payment_method character varying, p_notes text, p_user_id uuid) SET search_path = public;
ALTER FUNCTION public.expire_old_reservations() SET search_path = public;
ALTER FUNCTION public.expire_trial_modules() SET search_path = public;
ALTER FUNCTION public.get_all_customer_movements(search_query text) SET search_path = public;
ALTER FUNCTION public.get_customer_movements(customer_id uuid) SET search_path = public;
ALTER FUNCTION public.get_effective_module_price(p_company_id uuid, p_module_id uuid, p_billing_cycle text) SET search_path = public;
ALTER FUNCTION public.get_invoice_payments(customer_id uuid) SET search_path = public;
ALTER FUNCTION public.get_next_comprobante_number(_pos_afip_id uuid) SET search_path = public;
ALTER FUNCTION public.log_module_change() SET search_path = public;
ALTER FUNCTION public.notify_admins_on_ticket() SET search_path = public;
ALTER FUNCTION public.notify_message_received() SET search_path = public;
ALTER FUNCTION public.notify_status_changed() SET search_path = public;
ALTER FUNCTION public.notify_ticket_created() SET search_path = public;
ALTER FUNCTION public.setup_accountant_permissions(company_uuid uuid) SET search_path = public;
ALTER FUNCTION public.update_bank_account_balance() SET search_path = public;
ALTER FUNCTION public.update_product_reserved_stock() SET search_path = public;