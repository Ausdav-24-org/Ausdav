// The Deno runtime supplies these remote modules at deploy/serve time.
// @ts-expect-error - TypeScript in this workspace does not resolve remote Deno imports.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-expect-error - TypeScript in this workspace does not resolve remote Deno imports.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Minimal declaration so editors know Deno.env exists during local type checking.
declare const Deno: {
  env: { get(key: string): string | undefined };
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: "Service misconfigured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let payload: { email?: string; password?: string };

  try {
    payload = await req.json();
  } catch (_err) {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const email = payload?.email?.trim();
  const password = payload?.password;

  if (!email) {
    return new Response(JSON.stringify({ error: "Email is required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!password) {
    return new Response(JSON.stringify({ error: "Password is required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (password.length < 8) {
    return new Response(JSON.stringify({ error: "Password must be at least 8 characters" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data: settings, error: settingsError } = await adminClient
    .from("app_settings")
    .select("allow_signup")
    .eq("id", 1)
    .maybeSingle();

  if (settingsError) {
    console.error("Failed to read signup flag", settingsError.message);
    return new Response(JSON.stringify({ error: "Cannot read signup settings" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { count: memberCount, error: countError } = await adminClient
    .from("members")
    .select("mem_id", { count: "exact", head: true });

  if (countError) {
    console.error("Failed to count members", countError.message);
    return new Response(JSON.stringify({ error: "Cannot verify member count" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const bootstrapMode = (memberCount ?? 0) === 0;
  const signupsEnabled = settings?.allow_signup === true || bootstrapMode;

  if (!signupsEnabled) {
    return new Response(JSON.stringify({ error: "Sign ups are disabled" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: userData, error: createError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { created_via: "controlled-signup" },
  });

  if (createError) {
    console.error("Signup failed", createError.message);
    return new Response(JSON.stringify({ error: createError.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(
    JSON.stringify({ userId: userData.user?.id ?? null, bootstrap: bootstrapMode }),
    {
      status: 201,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
});
