-- Create storage bucket for company logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('company-logos', 'company-logos', true);

-- RLS policies for company logos bucket
CREATE POLICY "Company logos are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'company-logos');

CREATE POLICY "Admins can upload company logos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'company-logos' 
  AND auth.uid() IN (
    SELECT cu.user_id 
    FROM company_users cu 
    WHERE cu.role = 'admin' AND cu.active = true
  )
);

CREATE POLICY "Admins can update company logos"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'company-logos'
  AND auth.uid() IN (
    SELECT cu.user_id 
    FROM company_users cu 
    WHERE cu.role = 'admin' AND cu.active = true
  )
);

CREATE POLICY "Admins can delete company logos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'company-logos'
  AND auth.uid() IN (
    SELECT cu.user_id 
    FROM company_users cu 
    WHERE cu.role = 'admin' AND cu.active = true
  )
);