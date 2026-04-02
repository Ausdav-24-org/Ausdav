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

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: 'Service misconfigured' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Authenticate caller
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  try {
    // Verify user
    let userId: string | null = null;
    try {
      const { data: userData, error: userErr } = await adminClient.auth.getUser(token) as any;
      if (userErr) throw userErr;
      userId = userData?.user?.id ?? null;
    } catch (e) {
      console.error('auth.getUser failed', e);
    }

    if (!userId) {
      return new Response(JSON.stringify({ error: 'Cannot identify user' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Verify caller is admin
    const { data: callerRow, error: callerErr } = await adminClient
      .from('members')
      .select('role')
      .eq('auth_user_id', userId)
      .maybeSingle();

    if (callerErr || !callerRow || !['admin', 'super_admin'].includes(callerRow.role)) {
      return new Response(JSON.stringify({ error: 'Forbidden: not an admin' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Parse request body
    const body = await req.json();
    const { email, fullname, inviteRole = 'member' } = body;

    if (!email || !fullname) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Invite user via auth.admin.inviteUserByEmail
    const { data: inviteData, error: inviteErr } = await adminClient.auth.admin.inviteUserByEmail(
      email,
      { redirectTo: `${supabaseUrl}/auth/callback` }
    ) as any;

    if (inviteErr) {
      console.error('inviteUserByEmail failed', inviteErr);
      return new Response(JSON.stringify({ error: inviteErr.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const newUserId = inviteData?.user?.id;
    if (!newUserId) {
      return new Response(JSON.stringify({ error: 'Failed to create auth user' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Create member record
    const { error: memberErr } = await adminClient
      .from('members')
      .insert({
        auth_user_id: newUserId,
        fullname: fullname.trim(),
        username: email.split('@')[0].toLowerCase(),
        role: inviteRole,
        batch: new Date().getFullYear(),
      });

    if (memberErr) {
      console.error('Failed to create member record:', memberErr);
      // Note: Auth user was created, but member record failed
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: `Invitation sent to ${email}`,
      user_id: newUserId 
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (e) {
    console.error('send-member-invitation failed', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Invitation failed' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
