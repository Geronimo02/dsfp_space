-- Add RLS policies for customer_support_messages
CREATE POLICY "Users can view their company's support messages"
ON public.customer_support_messages
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM customer_support_tickets t
    WHERE t.id = customer_support_messages.ticket_id
    AND public.user_belongs_to_company(t.company_id)
  )
);

CREATE POLICY "Users can create messages for their company's tickets"
ON public.customer_support_messages
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM customer_support_tickets t
    WHERE t.id = customer_support_messages.ticket_id
    AND public.user_belongs_to_company(t.company_id)
  )
);