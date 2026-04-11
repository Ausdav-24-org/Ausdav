-- Drop member_qr_scan_logs table if it exists
-- This table is no longer needed for the QR code system

DROP TABLE IF EXISTS public.member_qr_scan_logs CASCADE;

-- The indexes will be automatically dropped with the table
-- No need to drop them separately
