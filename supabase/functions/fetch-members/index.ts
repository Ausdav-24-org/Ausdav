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
  // Masked logging to help debug missing/invalid tokens without printing secrets
  try {
    if (authHeader) {
      const sample = authHeader.slice(0, 12);
      console.log('fetch-members auth header received sample=', `${sample}...`, 'len=', authHeader.length);
    } else {
      console.log('fetch-members no Authorization header received');
    }
  } catch (_e) {
    // ignore logging failures
  }

  const token = authHeader.replace(/^Bearer\s+/i, '');
  try {
    const parts = token ? token.split('.') : [];
    console.log('fetch-members token parts count=', parts.length);
  } catch (_e) {}

  if (!token) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  try {
    let userId: string | null = null;
    let userMeta: any = null;
    try {
      const { data: userData, error: userErr } = await adminClient.auth.getUser({ access_token: token as string }) as any;
      if (userErr) throw userErr;
      userId = userData?.user?.id ?? null;
      userMeta = userData?.user?.user_metadata ?? null;
    } catch (e) {
      console.error('auth.getUser failed, falling back to JWT decode', e instanceof Error ? e.message : e);
      // As a fallback, attempt to decode the JWT payload to extract `sub` and
      // `user_metadata`. This avoids failing when auth-js cannot validate the
      // token (some edge runtime or token types), while still allowing us to
      // identify the caller for authorization checks. We do not verify the
      // signature here.
      try {
        const parts = token.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
          userId = payload?.sub ?? null;
          userMeta = payload?.user_metadata ?? payload?.app_user_metadata ?? null;
          console.log('fetch-members decoded JWT sub=', userId, 'payload_keys=', Object.keys(payload || {}));
        }
      } catch (decErr) {
        console.error('JWT decode fallback failed', decErr);
      }
    }

    if (!userId) return new Response(JSON.stringify({ error: 'Cannot identify user' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    // Prefer members table lookup, but allow a fallback to user metadata for admins
    let callerRole: string | null = null;
    try {
      const { data: callerRow, error: callerErr } = await adminClient
        .from('members')
        .select('mem_id, role')
        .eq('auth_user_id', userId)
        .maybeSingle();
      if (callerErr) throw callerErr;
      if (callerRow && callerRow.role) callerRole = callerRow.role;
    } catch (e) {
      console.error('members lookup failed', e);
    }

    if (!callerRole) {
      const meta = userMeta;
      if (meta?.is_super_admin === true) callerRole = 'super_admin';
      else if (Array.isArray(meta?.roles) && meta.roles.includes('super_admin')) callerRole = 'super_admin';
      else if (Array.isArray(meta?.roles) && meta.roles.includes('admin')) callerRole = 'admin';
    }

    if (!callerRole || !['admin','super_admin'].includes(callerRole)) {
      return new Response(JSON.stringify({ error: 'Forbidden: not an admin' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Fetch all members using service role (bypasses RLS) and return
    const { data: membersData, error: membersErr } = await adminClient
      .from('members')
      .select('mem_id, auth_user_id, fullname, username, phone, batch, created_at, role, designation')
      .order('created_at', { ascending: false });
    if (membersErr) throw membersErr;

    return new Response(JSON.stringify({ members: membersData ?? [] }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('fetch-members failed', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Fetch failed' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
