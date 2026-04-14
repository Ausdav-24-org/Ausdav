// @ts-expect-error - Deno remote imports
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-expect-error
import { createClient } from "https://esm.sh/@supabase/supabase-js";

// bring the Deno globals into scope for the TS checker
declare const Deno: { env: { get(key: string): string | undefined } };

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseKey);

serve(async (req: Request) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "apikey, authorization, content-type",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  };

  if (req.method === 'OPTIONS') {
    // respond with no content but include CORS headers so browser allows
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    let email = "";

    if (req.method === 'GET') {
      const url = new URL(req.url);
      email = (url.searchParams.get('email') || '').toString().trim().toLowerCase();
    } else {
      const body = await req.json();
      email = (body?.email || '').toString().trim().toLowerCase();
    }

    if (!email) {
      return new Response(JSON.stringify({ error: "missing email" }), { status: 400, headers: corsHeaders });
    }

    const { data, error } = await supabase
      .from("members")
      .select("id, role")
      .eq("email", email)
      .single();

    if (error) {
      console.error("check-user-exists error", error);
      return new Response(JSON.stringify({ exists: false, error: error.message }), { status: 200, headers: corsHeaders });
    }

    // include role if available
    return new Response(JSON.stringify({ exists: !!data, role: data?.role ?? null }), { status: 200, headers: corsHeaders });
  } catch (err) {
    console.error("check-user-exists exception", err);
    return new Response(JSON.stringify({ exists: false, error: String(err) }), { status: 500, headers: corsHeaders });
  }
});
