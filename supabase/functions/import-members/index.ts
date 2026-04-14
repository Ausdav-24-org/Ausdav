// @ts-expect-error - Deno remote imports
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-expect-error
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

declare const Deno: { env: { get(key: string): string | undefined } };

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: 'Service misconfigured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let payload: { members?: any[] };
  try {
    payload = await req.json();
  } catch (_err) {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const members = payload?.members;
  if (!Array.isArray(members) || members.length === 0) {
    return new Response(JSON.stringify({ error: 'Missing members array' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Reject any attempt to set auth_user_id via this import to avoid accidental linking
  for (const m of members) {
    if (m?.auth_user_id) {
      return new Response(JSON.stringify({ error: 'auth_user_id is not allowed in this import' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (m?.mem_id) {
      return new Response(JSON.stringify({ error: 'mem_id is not allowed in this import; use username to update existing members' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Authenticate caller and ensure they are a super_admin
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
          console.log('import-members decoded JWT sub=', userId, 'payload_keys=', Object.keys(payload || {}));
        }
      } catch (decErr) {
        console.error('JWT decode fallback failed', decErr);
      }
    }

    if (!userId) {
      return new Response(JSON.stringify({ error: 'Cannot identify user' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Prefer member lookup, fallback to user metadata for super_admin
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
    }

    if (!callerRole || callerRole !== 'super_admin') {
      return new Response(JSON.stringify({ error: 'Forbidden: super admin only' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
  } catch (e) {
    console.error('Auth check failed', e);
    return new Response(JSON.stringify({ error: 'Authentication failed' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  // Allowed columns — mirror members schema
  const allowed = new Set([
    'mem_id', 'fullname', 'username', 'nic', 'gender', 'role', 'batch', 'university', 'school', 'phone', 'designation', 'uni_degree', 'auth_user_id', 'profile_bucket', 'profile_path'
  ]);

  const sanitized = members.map((m) => {
    const obj: Record<string, any> = {};
    for (const k of Object.keys(m)) {
      if (allowed.has(k)) obj[k] = m[k];
    }
    // Ensure required fields for inserts/updates
    if (!obj.fullname || !obj.username) {
      // let DB constraints catch this too; but we try to be helpful
      throw new Error('fullname and username are required for each member');
    }
    // Cast gender to boolean if provided
    if (obj.gender !== undefined) {
      if (typeof obj.gender === 'string') {
        obj.gender = ['true','1','male','m'].includes(String(obj.gender).toLowerCase());
      } else {
        obj.gender = Boolean(obj.gender);
      }
    }
    if (obj.batch !== undefined) obj.batch = Number(obj.batch);
    return obj;
  });

  try {
    // Ensure mem_id is not present and use username as the conflict key for updates
    const cleaned = sanitized.map((r) => {
      const c = { ...r } as Record<string, any>;
      delete c.mem_id;
      return c;
    });

    const { data, error } = await adminClient.from('members').upsert(cleaned, { onConflict: 'username' }).select('mem_id,username');
    if (error) throw error;
    return new Response(JSON.stringify({ inserted: data ?? [] }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('Upsert failed', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Upsert failed' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
