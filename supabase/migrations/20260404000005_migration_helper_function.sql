-- Helper function for Edge Function to update member profile path
-- This function sets the session flag internally so it bypasses the trigger
CREATE OR REPLACE FUNCTION public.migrate_member_profile(
  p_mem_id INTEGER,
  p_profile_path TEXT,
  p_profile_bucket TEXT
)
RETURNS TABLE (
  mem_id INTEGER,
  profile_path TEXT,
  profile_bucket TEXT,
  username TEXT
) AS $$
BEGIN
  -- Set the session flag to allow service role updates
  PERFORM set_config('app.allow_service_role_updates', 'true', false);
  
  -- Update the member record
  RETURN QUERY
  UPDATE public.members m
  SET 
    profile_path = p_profile_path,
    profile_bucket = p_profile_bucket,
    updated_at = NOW()
  WHERE m.mem_id = p_mem_id
  RETURNING 
    m.mem_id,
    m.profile_path,
    m.profile_bucket,
    m.username;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permission to service role
GRANT EXECUTE ON FUNCTION public.migrate_member_profile(INTEGER, TEXT, TEXT) TO service_role;
