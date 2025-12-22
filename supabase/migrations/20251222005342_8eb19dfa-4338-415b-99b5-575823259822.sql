-- Make the platform-support-attachments bucket public so files can be downloaded
UPDATE storage.buckets 
SET public = true 
WHERE id = 'platform-support-attachments';