-- Add trigger to automatically delete old QR codes when new one is created for same member
-- This enforces: One active QR per member maximum

-- Create function to handle QR cleanup
CREATE OR REPLACE FUNCTION cleanup_old_qr_codes()
RETURNS TRIGGER AS $$
BEGIN
  -- Delete any existing active QR codes for this member
  -- (keeping only the one being inserted)
  DELETE FROM member_qr_codes
  WHERE mem_id = NEW.mem_id
    AND id != NEW.id
    AND is_active = TRUE;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to run before insert
DROP TRIGGER IF EXISTS trigger_cleanup_old_qr ON member_qr_codes;
CREATE TRIGGER trigger_cleanup_old_qr
BEFORE INSERT ON member_qr_codes
FOR EACH ROW
EXECUTE FUNCTION cleanup_old_qr_codes();

-- Add unique constraint to ensure only one active QR per member
-- Drop existing index if it exists
DROP INDEX IF EXISTS idx_unique_active_qr_per_member;

-- Create partial unique index: only one active QR per member
CREATE UNIQUE INDEX idx_unique_active_qr_per_member 
ON member_qr_codes(mem_id) 
WHERE is_active = TRUE AND is_expired_manually = FALSE;

-- Add comment for documentation
COMMENT ON FUNCTION cleanup_old_qr_codes() IS 
'Automatically deletes old QR codes when a new one is created for the same member. 
Enforces business rule: One active QR per member maximum.';

COMMENT ON TRIGGER trigger_cleanup_old_qr ON member_qr_codes IS 
'Trigger that cleans up old QR codes before inserting new one. 
Ensures memberId:activeQR is 1:1 relationship.';

-- Index ensures uniqueness: only one active QR per member
-- Prevents duplicate active QRs even if app logic fails
