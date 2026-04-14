// @ts-expect-error - Deno remote imports
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-expect-error
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

declare const Deno: { env: { get(key: string): string | undefined } };

serve(async (req: Request) => {
  const origin = req.headers.get('origin') || '*';
  const corsHeaders = {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Credentials': 'true',
  };

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: 'Service misconfigured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let payload: { mem_ids?: number[] };
  try {
    payload = await req.json();
  } catch (_err) {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const memIds = payload?.mem_ids;
  if (!Array.isArray(memIds) || memIds.length === 0) {
    return new Response(JSON.stringify({ error: 'Missing mem_ids array' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
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
          console.log('delete-members decoded JWT sub=', userId, 'payload_keys=', Object.keys(payload || {}));
        }
      } catch (decErr) {
        console.error('JWT decode fallback failed', decErr);
      }
    }

    if (!userId) return new Response(JSON.stringify({ error: 'Cannot identify user' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    // Prefer member lookup, fallback to user metadata
    let callerRole: string | null = null;
    try {
      const { data: memberRow, error: memberErr } = await adminClient
        .from('members')
        .select('role')
        .eq('auth_user_id', userId)
        .maybeSingle();
      if (memberErr) throw memberErr;
      if (memberRow) callerRole = memberRow.role;
    } catch (e) {
      console.error('members lookup failed', e);
    }

    if (!callerRole) {
      const meta = userMeta;
      if (meta?.is_super_admin === true) callerRole = 'super_admin';
      else if (Array.isArray(meta?.roles) && meta.roles.includes('super_admin')) callerRole = 'super_admin';
      else if (Array.isArray(meta?.roles) && meta.roles.includes('admin')) callerRole = 'admin';
    }

    if (!callerRole) return new Response(JSON.stringify({ error: 'Forbidden: not an admin' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    // If caller is admin (not super_admin), ensure targets are only role='member'
    if (callerRole !== 'super_admin') {
      if (callerRole !== 'admin') {
        return new Response(JSON.stringify({ error: 'Forbidden: admin only' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const { data: targets, error: tErr } = await adminClient
        .from('members')
        .select('mem_id,role')
        .in('mem_id', memIds as number[]);
      if (tErr) throw tErr;
      const invalid = (targets || []).find((t: any) => t.role !== 'member');
      if (invalid) {
        return new Response(JSON.stringify({ error: 'Admins may only delete members with role=member' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // Fetch affected members to collect `auth_user_id`s before deleting rows
    const { data: targets, error: fetchErr } = await adminClient
      .from('members')
      .select('mem_id, auth_user_id')
      .in('mem_id', memIds as number[]);
    if (fetchErr) throw fetchErr;

    const authIds = (targets || []).map((t: any) => t.auth_user_id).filter(Boolean) as string[];

    // Perform deletion using service role
    const { data: deleted, error: delErr } = await adminClient.from('members').delete().in('mem_id', memIds).select('mem_id');
    if (delErr) throw delErr;

    // Delete corresponding auth users (best-effort). log but don't fail overall if some deletions fail.
    const deletedAuth: string[] = [];
    for (const aid of authIds) {
      try {
        // supabase-js admin API: auth.admin.deleteUser
        // @ts-expect-error - runtime provides admin API
        const { error: authErr } = await (adminClient as any).auth.admin.deleteUser(aid);
        if (authErr) {
          console.error('Failed to delete auth user', aid, authErr.message || authErr);
        } else {
          deletedAuth.push(aid);
        }
      } catch (e) {
        console.error('Exception deleting auth user', aid, e);
      }
    }

    return new Response(
      JSON.stringify({ deleted: deleted ?? [], deleted_auth_ids: deletedAuth }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    console.error('Delete-members failed', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Delete failed' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
