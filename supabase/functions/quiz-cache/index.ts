// @ts-expect-error - Deno std/esm imports
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-expect-error - Supabase client for edge runtime
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Simple CORS setup
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, DELETE, OPTIONS",
};

declare const Deno: { env: { get(key: string): string | undefined } };

type QuizRow = {
  id: number;
  quiz_password_id: number;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answer: string;
  image_path: string | null;
};

type CachePayload = {
  questions: QuizRow[];
  cached: boolean;
  source: "cache" | "fresh";
};

type Body = {
  quiz_password_id?: number;
  bypassCache?: boolean;
};

serve(async (req: Request) => {
  try {
    // Always handle preflight quickly with 204 (no content) and CORS headers
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }
    if (!['POST', 'DELETE'].includes(req.method)) {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let body: Body = {};
    try {
      body = await req.json();
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const qpId = Number(body.quiz_password_id);
    if (!qpId || Number.isNaN(qpId)) {
      return new Response(JSON.stringify({ error: 'quiz_password_id is required' }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: 'Service misconfigured' }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // DELETE: clear cache for this quiz
    if (req.method === 'DELETE') {
      const { error } = await admin.from('quiz_cache').delete().eq('quiz_password_id', qpId);
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // POST: fetch from cache or populate it
    const nowIso = new Date().toISOString();
    const { data: cacheRow, error: cacheErr } = await admin
      .from('quiz_cache')
      .select('payload, expires_at')
      .eq('quiz_password_id', qpId)
      .maybeSingle();

    if (cacheErr) {
      console.error('cache select error', cacheErr);
    }

    const bypass = Boolean(body.bypassCache);
    const notExpired = cacheRow?.expires_at && new Date(cacheRow.expires_at) > new Date();

    if (!bypass && cacheRow?.payload && notExpired) {
      const resp: CachePayload = {
        questions: cacheRow.payload as QuizRow[],
        cached: true,
        source: "cache",
      };
      return new Response(JSON.stringify(resp), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Fetch fresh questions
    const { data: questions, error: qErr } = await admin
      .from('quiz_mcq')
      .select('id, quiz_password_id, question_text, option_a, option_b, option_c, option_d, correct_answer, image_path')
      .eq('quiz_password_id', qpId)
      .order('created_at', { ascending: true });

    if (qErr) {
      return new Response(JSON.stringify({ error: qErr.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!questions || questions.length === 0) {
      return new Response(JSON.stringify({ error: 'No questions found' }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 minutes

    const { error: upsertErr } = await admin
      .from('quiz_cache')
      .upsert({ quiz_password_id: qpId, payload: questions, updated_at: nowIso, expires_at: expiresAt });

    if (upsertErr) {
      console.error('cache upsert error', upsertErr);
    }

    const resp: CachePayload = {
      questions: questions as QuizRow[],
      cached: false,
      source: "fresh",
    };

    return new Response(JSON.stringify(resp), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error('quiz-cache handler error', err);
    return new Response(JSON.stringify({ error: 'Internal error' }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
