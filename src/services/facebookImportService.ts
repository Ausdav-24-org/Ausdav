import { invokeFunction } from '@/integrations/supabase/functions';

export type FacebookContentType = 'post' | 'album' | 'auto_detect';

export interface FacebookImportRequest {
  facebook_url?: string;
  facebook_urls?: string[];
  content_type: FacebookContentType;
  event_id?: number | null;
  gallery_id?: string | null;
  force_resync?: boolean;
}

export interface FacebookImportedImage {
  id: string;
  image_url_original: string;
  image_path_local: string;
  public_url: string;
  sort_order: number;
  caption: string | null;
  source_url?: string;
}

export interface FacebookImportResponse {
  ok: boolean;
  message: string;
  imported_count: number;
  skipped_count?: number;
  total_urls?: number;
  images: FacebookImportedImage[];
  // Legacy fields for backward compatibility
  already_imported?: boolean;
  detected_type?: 'post' | 'album';
  facebook_object_id?: string;
  source_type?: 'facebook_post' | 'facebook_album';
  source_url?: string;
  source_title?: string | null;
  source_description?: string | null;
  source_caption?: string | null;
  existing_count?: number;
}

async function extractFunctionErrorMessage(error: unknown): Promise<string> {
  const fallback =
    error && typeof error === 'object' && 'message' in error
      ? String((error as { message?: unknown }).message || 'Facebook import request failed')
      : 'Facebook import request failed';

  if (!error || typeof error !== 'object' || !('context' in error)) {
    return fallback;
  }

  const context = (error as { context?: unknown }).context;
  if (!context || typeof context !== 'object') {
    return fallback;
  }

  try {
    const maybeResponse = context as {
      clone?: () => { json?: () => Promise<unknown>; text?: () => Promise<string> };
      json?: () => Promise<unknown>;
      text?: () => Promise<string>;
    };

    const response = typeof maybeResponse.clone === 'function' ? maybeResponse.clone() : maybeResponse;

    if (typeof response.json === 'function') {
      const body = (await response.json()) as {
        error?: string;
        message?: string;
        code?: string;
      };

      const errorText = body?.error || body?.message;
      const codeText = body?.code ? ` (${body.code})` : '';
      if (errorText) return `${errorText}${codeText}`;
    }

    if (typeof response.text === 'function') {
      const text = await response.text();
      if (text?.trim()) return text.trim();
    }
  } catch {
    // Fall back to generic error message.
  }

  return fallback;
}

export async function importFacebookUrl(payload: FacebookImportRequest): Promise<FacebookImportResponse> {
  const { data, error } = await invokeFunction('import-facebook-media', payload);

  if (error) {
    const msg = await extractFunctionErrorMessage(error);
    throw new Error(msg);
  }

  if (!data?.ok) {
    throw new Error(data?.error || data?.message || 'Facebook import failed');
  }

  return data as FacebookImportResponse;
}
