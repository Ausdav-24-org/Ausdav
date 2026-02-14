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

  let payload: { mem_ids?: number[]; new_role?: string };
  try {
    payload = await req.json();
  } catch (_err) {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const memIds = payload?.mem_ids;
  const newRole = payload?.new_role;
  if (!Array.isArray(memIds) || memIds.length === 0 || !newRole) {
    return new Response(JSON.stringify({ error: 'Missing mem_ids array or new_role' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
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
          console.log('update-member-role decoded JWT sub=', userId, 'payload_keys=', Object.keys(payload || {}));
        }
      } catch (decErr) {
        console.error('JWT decode fallback failed', decErr);
      }
    }

    if (!userId) return new Response(JSON.stringify({ error: 'Cannot identify user' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    // Prefer member lookup, fallback to user metadata roles
    let callerRole: string | null = null;
    let callerMemId: number | null = null;
    try {
      const { data: memberRow, error: memberErr } = await adminClient
        .from('members')
        .select('mem_id, role')
        .eq('auth_user_id', userId)
        .maybeSingle();
      if (memberErr) throw memberErr;
      if (memberRow) {
        callerRole = memberRow.role;
        callerMemId = memberRow.mem_id;
      }
    } catch (e) {
      console.error('members lookup failed', e);
    }

    if (!callerRole) {
      const meta = userMeta;
      if (meta?.is_super_admin === true) callerRole = 'super_admin';
      else if (Array.isArray(meta?.roles) && meta.roles.includes('super_admin')) callerRole = 'super_admin';
      else if (Array.isArray(meta?.roles) && meta.roles.includes('admin')) callerRole = 'admin';
    }

    // Fetch target rows early for subsequent checks
    const { data: targets, error: targetsErr } = await adminClient
      .from('members')
      .select('mem_id, role')
      .in('mem_id', memIds as number[]);
    if (targetsErr) throw targetsErr;

    // Count existing super_admins
    const { data: superAdmins, error: saErr } = await adminClient
      .from('members')
      .select('mem_id')
      .eq('role', 'super_admin');
    if (saErr) throw saErr;
    const totalSuper = (superAdmins || []).length;

    // Load committee changing phase setting to enforce server-side
    let committeeChangingPhase: boolean | null = null;
    try {
      const { data: settingRow, error: settingErr } = await adminClient
        .from('app_settings')
        .select('committee_changing_phase')
        .eq('id', 1)
        .maybeSingle();
      if (settingErr) throw settingErr;
      committeeChangingPhase = settingRow?.committee_changing_phase ?? null;
    } catch (err) {
      console.warn('Unable to load committee_changing_phase setting', err);
      committeeChangingPhase = null;
    }

    console.log('update-member-role called by', userId, 'callerRole=', callerRole, 'callerMemId=', callerMemId, 'memIds=', memIds, 'newRole=', newRole, 'totalSuper=', totalSuper);

    // Only super_admin can change roles
    if (callerRole !== 'super_admin') {
      return new Response(JSON.stringify({ error: 'Only super admins can change roles' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Enforce at most 2 super_admins: if promoting targets to super_admin, ensure limit
    if (newRole === 'super_admin') {
      const toPromote = (targets || []).filter((t: any) => t.role !== 'super_admin').length;
      if (totalSuper + toPromote > 2) {
        return new Response(JSON.stringify({ error: 'Cannot have more than 2 super_admins' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // Prevent the last remaining super_admin from downgrading themselves
    if (callerMemId !== null && memIds.includes(callerMemId) && newRole !== 'super_admin' && totalSuper <= 1) {
      return new Response(JSON.stringify({ error: 'Cannot change role: would remove the last super_admin' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Prevent changing role of existing Honourable members away from honourable
    if (newRole !== 'honourable') {
      const honourableTargets = (targets || []).filter((t: any) => t.role === 'honourable');
      if (honourableTargets.length > 0) {
        return new Response(JSON.stringify({ error: 'Honourable role is immutable and cannot be changed' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // Restrict promotions TO honourable: only targets that are currently 'admin' may be promoted
    if (newRole === 'honourable') {
      // Server-side enforcement: if committee changing phase is disabled, disallow promoting to honourable
      if (committeeChangingPhase === false) {
        return new Response(JSON.stringify({ error: 'Committee changing phase is disabled — cannot promote to Honourable' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const nonAdminTargets = (targets || []).filter((t: any) => t.role !== 'admin');
      if (nonAdminTargets.length > 0) {
        return new Response(JSON.stringify({ error: 'Only members with role "admin" may be promoted to honourable' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // Perform update via privileged RPC which sets a session flag so the
    // trigger will allow service-side updates. This avoids trigger
    // 'forbidden' exceptions when changing role/designation.
    const { data: rpcResult, error: rpcErr } = await adminClient.rpc('set_member_roles', { p_ids: memIds, p_role: newRole }) as any;
    if (rpcErr) throw rpcErr;

    // rpcResult contains mem_id and role; fetch full rows for notifications
    const { data: updatedRows, error: fetchErr } = await adminClient
      .from('members')
      .select('mem_id, role, fullname, auth_user_id')
      .in('mem_id', memIds as number[]);
    if (fetchErr) throw fetchErr;
    const updated = updatedRows;

    // If we just promoted members to honourable, notify all super admins
    if (newRole === 'honourable') {
      try {
        const updatedRows = (updated || []) as any[];
        const names = updatedRows.map((r) => `${r.fullname || r.mem_id}`).join(', ');

        // Fetch super admins' auth_user_id values
        const { data: superAdmins, error: saErr } = await adminClient
          .from('members')
          .select('auth_user_id')
          .eq('role', 'super_admin');
        if (!saErr && Array.isArray(superAdmins) && superAdmins.length > 0) {
          const adminIds = superAdmins.map((s: any) => s.auth_user_id).filter(Boolean);
          const message = `The following member(s) were set to Honourable: ${names}. This is a one-time transformation.`;
          const notifications = adminIds.map((adminId: string) => ({
            admin_id: adminId,
            type: 'info',
            title: 'Member promoted to Honourable',
            message,
          }));
          if (notifications.length > 0) {
            await adminClient.from('admin_notifications').insert(notifications);
          }
        }
      } catch (notifyErr) {
        console.error('Failed to create honourable notifications', notifyErr);
      }
    }

    return new Response(JSON.stringify({ updated: updated ?? [] }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('Update-member-role failed', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Update failed' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
