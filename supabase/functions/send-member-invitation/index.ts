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
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { 
      status: 405, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: 'Service misconfigured' }), { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    
    if (!token) {
      return new Response(JSON.stringify({ error: 'No token' }), { status: 401, headers: corsHeaders });
    }

    const body = await req.json();
    const { email, fullname, inviteRole = 'member' } = body;

    if (!email || !fullname) {
      return new Response(JSON.stringify({ error: 'Email and fullname required' }), { status: 400, headers: corsHeaders });
    }

    // Get user info
    const { data: { user } } = await adminClient.auth.getUser(token);
    
    if (!user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 401, headers: corsHeaders });
    }

    // Check if user is admin
    const { data: memberRow } = await adminClient
      .from('members')
      .select('role')
      .eq('auth_user_id', user.id)
      .single();

    if (!memberRow || !['admin', 'super_admin'].includes(memberRow.role)) {
      return new Response(JSON.stringify({ error: 'Not authorized' }), { status: 403, headers: corsHeaders });
    }

    // Send invitation
    const { data: inviteData, error: inviteErr } = await adminClient.auth.admin.inviteUserByEmail(
      email.toLowerCase().trim()
    );

    if (inviteErr) {
      return new Response(JSON.stringify({ error: 'Invite error: ' + inviteErr.message }), { status: 400, headers: corsHeaders });
    }

    if (!inviteData?.user?.id) {
      return new Response(JSON.stringify({ error: 'No user created' }), { status: 500, headers: corsHeaders });
    }

    // Create member record (non-blocking)
    await adminClient.from('members').insert({
      auth_user_id: inviteData.user.id,
      fullname: fullname.trim(),
      username: email.split('@')[0].toLowerCase(),
      role: inviteRole,
      batch: new Date().getFullYear(),
    });

    return new Response(JSON.stringify({ 
      success: true, 
      message: `Invitation sent to ${email}`
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Error' 
    }), { status: 500, headers: corsHeaders });
  }
});
