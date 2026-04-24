import { supabase } from '@/integrations/supabase/client';

type InvokeResult = { data: any | null; error: any | null };

function isLikelyJwt(value: string | undefined): boolean {
  if (!value) return false;
  return value.split('.').length === 3;
}

/**
 * Invoke a Supabase Edge Function with a fetch-based fallback for environments
 * where `supabase.functions.invoke` may fail (network/host resolution issues).
 */
export async function invokeFunction(name: string, body: any): Promise<InvokeResult> {
  try {
    // Use a direct fetch to the Edge Function endpoint so we can guarantee
    // forwarding of both the anon `apikey` and the current session
    // `Authorization: Bearer <token>` header. Some environments or versions
    // of supabase-js do not reliably forward custom headers via
    // `supabase.functions.invoke`.
    const base = import.meta.env.VITE_SUPABASE_URL;
    const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    const anonJwtKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    const apiKey = publishableKey || anonJwtKey;
    if (!base) throw new Error('Missing VITE_SUPABASE_URL');

    let userAccessToken = '';
    try {
      const s = await supabase.auth.getSession();
      let token = s?.data?.session?.access_token;
      // Fallback: some environments may not have an initialized session yet.
      // Try reading the persisted session from localStorage using the same
      // storage key configured in the client (`ausdav.supabase.auth`).
      if (!token && typeof window !== 'undefined' && window.localStorage) {
        try {
          const raw = window.localStorage.getItem('ausdav.supabase.auth');
          if (raw) {
            const parsed = JSON.parse(raw);
            // supabase stores session under 'currentSession' or 'session'
            token = parsed?.currentSession?.access_token || parsed?.session?.access_token || parsed?.access_token || token;
          }
        } catch (_e) {
          // ignore parsing errors
        }
      }
      if (token) userAccessToken = token;
    } catch (_e) {
      // ignore
    }

    // Gateway JWT verification accepts JWTs, not publishable key format.
    // If no user session exists, fallback to anon JWT key when available.
    const bearerFallbackToken = isLikelyJwt(anonJwtKey)
      ? anonJwtKey
      : (isLikelyJwt(apiKey) ? apiKey : '');
    const bearerToken = userAccessToken || bearerFallbackToken;
    const authHeader = bearerToken ? { Authorization: `Bearer ${bearerToken}` } : {};

    // Debugging: log a masked token sample and expiry (if present) so we can
    // confirm what the client will send to Edge Functions without printing
    // the full secret to the console.
    try {
      const sample = authHeader.Authorization ? authHeader.Authorization.replace(/Bearer\s+/i, '') : '';
      if (sample) {
        const parts = sample.split('.');
        let expInfo = '';
        if (parts.length === 3) {
          try {
            const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
            if (payload?.exp) {
              const exp = Number(payload.exp) * 1000;
              const now = Date.now();
              expInfo = `exp=${new Date(exp).toISOString()}(${exp <= now ? 'expired' : 'valid'})`;
            }
          } catch (_e) {
            // ignore
          }
        }
        console.debug('invokeFunction will send Authorization sample=', `${sample.slice(0,8)}...`, expInfo);
      } else {
        console.debug('invokeFunction: no Authorization header will be sent');
        if (apiKey && !bearerFallbackToken) {
          console.debug(
            'invokeFunction: no user access token and no JWT anon fallback. If function JWT verification is enabled, public calls will return 401.',
          );
        }
      }
    } catch (_e) {
      // ignore logging errors
    }

    const url = `${base.replace(/\/$/, '')}/functions/v1/${name}`;
    const r = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { apikey: apiKey } : {}),
        ...authHeader,
      },
      body: JSON.stringify(body),
    });

    const text = await r.text().catch(() => '');
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch (_e) { data = text; }
    if (!r.ok) {
      const message = data?.error || (typeof data === 'string' ? data : r.statusText);
      const error = new Error(`Edge function ${name} returned ${r.status}: ${message}`);
      console.error('invokeFunction fetch error', { name, url, status: r.status, body: data });
      return { data, error };
    }

    return { data, error: null };
  } catch (err) {
    // Fallback: call the function endpoint directly and surface detailed errors
    try {
      const base = import.meta.env.VITE_SUPABASE_URL;
      const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const anonJwtKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      const apiKey = publishableKey || anonJwtKey;
      if (!base) throw err;
      const url = `${base.replace(/\/$/, '')}/functions/v1/${name}`;

      // Include the current session access token so Edge Functions can
      // authenticate the caller (falls back to anon key if not available).
      let userAccessToken = '';
      try {
        const s = await supabase.auth.getSession();
        const token = s?.data?.session?.access_token;
        if (token) userAccessToken = token;
      } catch (_e) {
        // ignore
      }

      const bearerFallbackToken = isLikelyJwt(anonJwtKey)
        ? anonJwtKey
        : (isLikelyJwt(apiKey) ? apiKey : '');
      const bearerToken = userAccessToken || bearerFallbackToken;
      const authHeader = bearerToken ? { Authorization: `Bearer ${bearerToken}` } : {};

      const r = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { apikey: apiKey } : {}),
          ...authHeader,
        },
        body: JSON.stringify(body),
      });

      const text = await r.text().catch(() => '');
      let data = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch (_e) {
        data = text;
      }

      if (!r.ok) {
        const message = data?.error || (typeof data === 'string' ? data : r.statusText);
        const error = new Error(`Edge function ${name} returned ${r.status}: ${message}`);
        console.error('invokeFunction fallback error', { name, url, status: r.status, body: data, originalErr: err });
        return { data, error };
      }

      return { data, error: null };
    } catch (e) {
      console.error('invokeFunction failed', { name, originalErr: err, fallbackErr: e });

      // Build a combined error message with as much context as we can extract.
      const origMsg = err instanceof Error ? err.message : JSON.stringify(err);
      const fbMsg = e instanceof Error ? e.message : JSON.stringify(e);
      const combined = new Error(`invokeFunction: primary error: ${origMsg}; fallback error: ${fbMsg}`);
      return { data: null, error: combined };
    }
  }
}

export default invokeFunction;
