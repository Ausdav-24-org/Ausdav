// @ts-expect-error - Deno remote imports
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-expect-error
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

declare const Deno: { env: { get(key: string): string | undefined } };

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface MigrationResult {
  total: number;
  migrated: number;
  failed: number;
  errors: Array<{ mem_id: number; error: string }>;
}

serve(async (req: Request) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: 'Missing Supabase credentials' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Enable bypass for RLS policies since we're using service role
    const supabaseAdmin = supabase.auth.admin;

    // Check if request includes a specific member ID
    const body = await req.json().catch(() => ({}));
    const targetMemId = body?.mem_id;

    // Build query - filter by mem_id if provided
    let query = supabase
      .from('members')
      .select('mem_id, username, batch, profile_path, profile_bucket')
      .not('profile_path', 'is', null);

    if (targetMemId) {
      query = query.eq('mem_id', targetMemId);
    }

    // Get members with profile pictures
    const { data: members, error: queryError } = await query;

    if (queryError) {
      throw new Error(`Failed to fetch members: ${queryError.message}`);
    }

    const result: MigrationResult = {
      total: members?.length || 0,
      migrated: 0,
      failed: 0,
      errors: [],
    };

    if (!members || members.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No members to migrate', ...result }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Migrate each member's profile picture
    for (const member of members) {
      try {
        const oldPath = member.profile_path;
        const bucket = member.profile_bucket || 'member-profiles';

        console.log(`Processing member ${member.mem_id}: current path = "${oldPath}"`);

        // Get file extension
        const ext = oldPath?.split('.').pop() || 'jpg';

        // New path: batch/username_member_id.ext
        const newPath = `${member.batch}/${member.username}_${member.mem_id}.${ext}`;

        // Skip if path is already in new format
        if (oldPath === newPath) {
          console.log(`Member ${member.mem_id} already in new format (${oldPath})`);
          result.migrated++;
          continue;
        }

        console.log(`Migrating ${member.mem_id}: ${oldPath} → ${newPath}`);

        // Download old file
        const { data: fileData, error: downloadError } = await supabase.storage
          .from(bucket)
          .download(oldPath);

        if (downloadError) {
          throw new Error(`Failed to download: ${downloadError.message}`);
        }

        // Upload to new location
        const { error: uploadError } = await supabase.storage
          .from(bucket)
          .upload(newPath, fileData, { upsert: true, contentType: 'image/jpeg' });

        if (uploadError) {
          throw new Error(`Failed to upload: ${uploadError.message}`);
        }

        // Update database with new path using helper RPC function
        console.log(`Attempting to update member ${member.mem_id}: profile_path = ${newPath}`);

        const { data: updateData, error: updateError } = await supabase
          .rpc('migrate_member_profile', {
            p_mem_id: member.mem_id,
            p_profile_path: newPath,
            p_profile_bucket: bucket
          });

        console.log(`Update response - Data:`, JSON.stringify(updateData));
        console.log(`Update response - Error:`, updateError ? JSON.stringify(updateError) : 'none');

        if (updateError) {
          console.error(`DB Update Error for member ${member.mem_id}:`, JSON.stringify(updateError));
          throw new Error(`Failed to update DB: ${updateError.message}`);
        }

        if (!updateData || (Array.isArray(updateData) && updateData.length === 0)) {
          console.error(`No rows returned from update for member ${member.mem_id}`);
          throw new Error(`Database update returned no rows for member ${member.mem_id}`);
        }

        const updatedRow = Array.isArray(updateData) ? updateData[0] : updateData;
        console.log(`✓ Updated DB for member ${member.mem_id}:`, JSON.stringify(updatedRow));

        // Verify the update
        const { data: verified, error: verifyError } = await supabase
          .from('members')
          .select('profile_path')
          .eq('mem_id', member.mem_id)
          .single();

        if (verifyError) {
          console.warn(`Could not verify update for member ${member.mem_id}: ${verifyError.message}`);
        } else if (verified?.profile_path !== newPath) {
          console.error(`Verification failed for member ${member.mem_id}. Expected: ${newPath}, Got: ${verified?.profile_path}`);
          throw new Error(`Database update verification failed for member ${member.mem_id}`);
        } else {
          console.log(`✓ Verified: member ${member.mem_id} profile_path is now ${newPath}`);
        }

        // Delete old file
        const { error: deleteError } = await supabase.storage
          .from(bucket)
          .remove([oldPath]);

        if (deleteError) {
          console.warn(`Warning: Failed to delete old file ${oldPath}: ${deleteError.message}`);
        }

        result.migrated++;
        console.log(`✓ Successfully migrated member ${member.mem_id}`);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error(`✗ Failed to migrate member ${member.mem_id}: ${errorMsg}`);
        result.failed++;
        result.errors.push({ mem_id: member.mem_id, error: errorMsg });
      }
    }

    return new Response(
      JSON.stringify({ success: true, ...result }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('Migration error:', msg);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
