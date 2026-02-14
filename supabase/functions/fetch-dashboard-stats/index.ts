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
    let userId: string | null = null;
    let userMeta: any = null;
    try {
      const { data: userData, error: userErr } = await adminClient.auth.getUser({ access_token: token as string }) as any;
      if (userErr) throw userErr;
      userId = userData?.user?.id ?? null;
      userMeta = userData?.user?.user_metadata ?? null;
    } catch (e) {
      console.error('auth.getUser failed, falling back to JWT decode', e instanceof Error ? e.message : e);
      try {
        const parts = token.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
          userId = payload?.sub ?? null;
          userMeta = payload?.user_metadata ?? payload?.app_user_metadata ?? null;
        }
      } catch (decErr) {
        console.error('JWT decode fallback failed', decErr);
      }
    }

    if (!userId) return new Response(JSON.stringify({ error: 'Cannot identify user' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    // Verify admin role via members table or user metadata
    let callerRole: string | null = null;
    try {
      const { data: callerRow, error: callerErr } = await adminClient
        .from('members')
        .select('role')
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

    if (!callerRole || !['admin', 'super_admin'].includes(callerRole)) {
      return new Response(JSON.stringify({ error: 'Forbidden: not an admin' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Run aggregated queries
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startISO = startOfMonth.toISOString().split('T')[0];

    // Use Promise.all to parallelize
    const [membersRes, activeRes, batchRes, financeRes, pendingSubRes, applicantsRes, eventsRes] = await Promise.all([
      adminClient.from('members').select('mem_id', { count: 'exact', head: true }),
      adminClient.from('profiles').select('is_active', { count: 'exact', head: true }).eq('is_active', true),
      adminClient.from('members').select('batch'),
      adminClient.from('finance').select('exp_type, amount, txn_date').gte('txn_date', startISO),
      adminClient.from('finance_submissions').select('*', { count: 'exact', head: true }).eq('approved', false),
      adminClient.from('applicants').select('*', { count: 'exact', head: true }),
      adminClient.from('events').select('*', { count: 'exact', head: true }).gte('start_date', now.toISOString().split('T')[0])
    ] as any[]);

    const totalMembers = membersRes?.count ?? (Array.isArray(membersRes?.data) ? membersRes.data.length : 0);
    const activeMembers = activeRes?.count ?? 0;

    // membersByBatch: aggregate from batchRes.data
    const batchRows = Array.isArray(batchRes.data) ? batchRes.data : [];
    const batchCounts: { [key: string]: number } = {};
    batchRows.forEach((r: any) => {
      const b = r.batch ?? 'Unknown';
      batchCounts[b] = (batchCounts[b] || 0) + 1;
    });
    const membersByBatch = Object.entries(batchCounts).map(([batch, count]) => ({ batch, count })).sort((a, b) => b.count - a.count);

    const txs = Array.isArray(financeRes.data) ? financeRes.data : [];
    const monthlyIncome = txs.filter((t: any) => t?.exp_type === 'income').reduce((s: number, t: any) => s + Number(t?.amount ?? 0), 0);
    const monthlyExpense = txs.filter((t: any) => t?.exp_type === 'expense').reduce((s: number, t: any) => s + Number(t?.amount ?? 0), 0);

    const pendingSubmissions = pendingSubRes?.count ?? 0;
    const applicantsCount = applicantsRes?.count ?? 0;
    const upcomingEvents = eventsRes?.count ?? 0;

    const payload = {
      totalMembers,
      activeMembers,
      monthlyIncome,
      monthlyExpense,
      pendingSubmissions,
      membersByBatch,
      applicantsCount,
      upcomingEvents,
      timestamp: new Date().toISOString(),
    };

    return new Response(JSON.stringify(payload), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('fetch-dashboard-stats failed', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Fetch failed' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
