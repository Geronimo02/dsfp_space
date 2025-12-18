-- Add SLA tracking fields to customer_support_tickets
ALTER TABLE customer_support_tickets
ADD COLUMN IF NOT EXISTS sla_response_hours integer DEFAULT 24,
ADD COLUMN IF NOT EXISTS sla_resolution_hours integer DEFAULT 72,
ADD COLUMN IF NOT EXISTS first_response_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS sla_response_breached boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS sla_resolution_breached boolean DEFAULT false;

-- Create response templates table
CREATE TABLE IF NOT EXISTS customer_support_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name varchar(255) NOT NULL,
  subject varchar(255),
  content text NOT NULL,
  category varchar(100),
  is_active boolean DEFAULT true,
  usage_count integer DEFAULT 0,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE customer_support_templates ENABLE ROW LEVEL SECURITY;

-- RLS policies for templates
CREATE POLICY "Users can view templates from their company"
ON customer_support_templates FOR SELECT
USING (company_id IN (
  SELECT company_id FROM company_users 
  WHERE user_id = auth.uid() AND active = true
));

CREATE POLICY "Admins can manage templates"
ON customer_support_templates FOR ALL
USING (company_id IN (
  SELECT company_id FROM company_users 
  WHERE user_id = auth.uid() AND active = true 
  AND role IN ('admin', 'manager')
));

-- Create trigger for updated_at
CREATE TRIGGER update_customer_support_templates_updated_at
  BEFORE UPDATE ON customer_support_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create SLA settings table per company
CREATE TABLE IF NOT EXISTS customer_support_sla_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL UNIQUE REFERENCES companies(id) ON DELETE CASCADE,
  default_response_hours integer DEFAULT 24,
  default_resolution_hours integer DEFAULT 72,
  high_priority_response_hours integer DEFAULT 4,
  high_priority_resolution_hours integer DEFAULT 24,
  medium_priority_response_hours integer DEFAULT 12,
  medium_priority_resolution_hours integer DEFAULT 48,
  low_priority_response_hours integer DEFAULT 48,
  low_priority_resolution_hours integer DEFAULT 120,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE customer_support_sla_settings ENABLE ROW LEVEL SECURITY;

-- RLS policies for SLA settings
CREATE POLICY "Users can view SLA settings from their company"
ON customer_support_sla_settings FOR SELECT
USING (company_id IN (
  SELECT company_id FROM company_users 
  WHERE user_id = auth.uid() AND active = true
));

CREATE POLICY "Admins can manage SLA settings"
ON customer_support_sla_settings FOR ALL
USING (company_id IN (
  SELECT company_id FROM company_users 
  WHERE user_id = auth.uid() AND active = true 
  AND role IN ('admin', 'manager')
));

-- Create trigger for updated_at
CREATE TRIGGER update_customer_support_sla_settings_updated_at
  BEFORE UPDATE ON customer_support_sla_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();