// @ts-expect-error - Deno remote imports
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-expect-error
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

declare const Deno: { env: { get(key: string): string | undefined } };

type ContentType = "post" | "album" | "auto_detect";
type DetectedType = "post" | "album";
type SourceType = "facebook_post" | "facebook_album";

type ImportPayload = {
  facebook_url?: string;
  facebook_urls?: string[];
  content_type: ContentType;
  event_id?: number | null;
  gallery_id?: string | null;
  force_resync?: boolean;
};

type SourceImage = {
  imageUrl: string;
  caption?: string | null;
  originalId?: string | null;
  createdTime?: string | null;
  link?: string | null;
};

type GraphRequestContext = {
  detectedType?: DetectedType;
  objectId?: string;
  fields?: string;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

class HttpError extends Error {
  status: number;
  code: string;
  details?: Record<string, unknown>;

  constructor(status: number, message: string, code: string, details?: Record<string, unknown>) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function getEnv(name: string, required = true): string {
  const value = Deno.env.get(name)?.trim();
  if (!value && required) {
    throw new HttpError(500, `Missing required server env: ${name}`, "server_misconfigured");
  }
  return value || "";
}

function sanitizeText(input: unknown, maxLength: number): string {
  if (typeof input !== "string") return "";
  return input.trim().slice(0, maxLength);
}

function parseBoolean(input: unknown): boolean {
  return input === true || input === "true" || input === 1 || input === "1";
}

function getFileExtensionFromMime(mimeType: string): string {
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
  };
  return map[mimeType.toLowerCase()] || "jpg";
}

function safeParseUrl(url: string): URL {
  try {
    return new URL(url);
  } catch {
    throw new HttpError(400, "Invalid Facebook URL", "invalid_facebook_url");
  }
}

function isFacebookHost(hostname: string): boolean {
  return (
    hostname === "facebook.com" ||
    hostname === "web.facebook.com" ||
    hostname === "www.facebook.com" ||
    hostname === "m.facebook.com" ||
    hostname === "fb.watch"
  );
}

function isFacebookSharePath(pathname: string): boolean {
  const path = pathname.toLowerCase();
  return path.startsWith("/share/p/") || path.startsWith("/share/v/");
}

function isUnsupportedResolvedFacebookPath(pathname: string): boolean {
  const path = pathname.toLowerCase();
  return (
    path.startsWith("/login") ||
    path.startsWith("/checkpoint") ||
    path.startsWith("/recover") ||
    path.startsWith("/auth")
  );
}

async function resolveFacebookShareUrl(url: string): Promise<string> {
  const parsed = safeParseUrl(url);
  if (!isFacebookSharePath(parsed.pathname)) {
    return url;
  }

  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
    });

    const finalUrl = String(response.url || "").trim();
    if (!finalUrl) {
      throw new Error("empty_redirect_url");
    }

    const finalParsed = safeParseUrl(finalUrl);
    if (!isFacebookHost(finalParsed.hostname.toLowerCase())) {
      throw new Error("redirected_to_non_facebook_host");
    }

    if (finalUrl === url && isFacebookSharePath(finalParsed.pathname)) {
      throw new Error("share_not_resolved");
    }

    return finalUrl;
  } catch {
    throw new HttpError(
      400,
      "Please paste the original Facebook post or album URL, not an unresolved share link.",
      "unsupported_url_pattern",
    );
  }
}

function detectTypeFromUrl(url: string): DetectedType | null {
  const parsed = safeParseUrl(url);
  const path = parsed.pathname.toLowerCase();
  const setParam = parsed.searchParams.get("set")?.toLowerCase() || "";
  const albumIdParam = parsed.searchParams.get("album_id")?.trim() || "";
  const aidParam = parsed.searchParams.get("aid")?.trim() || "";

  if (parsed.hostname.toLowerCase() === "fb.watch") {
    return "post";
  }

  if (
    path.includes("/media/set") ||
    path.includes("/albums/") ||
    setParam.startsWith("a.") ||
    /^\d+$/.test(albumIdParam) ||
    /^\d+$/.test(aidParam)
  ) {
    return "album";
  }

  if (
    path.includes("/posts/") ||
    path.includes("/permalink/") ||
    path.includes("/permalink.php") ||
    parsed.searchParams.has("story_fbid") ||
    parsed.searchParams.has("fbid") ||
    path.includes("/photos/")
  ) {
    return "post";
  }

  return null;
}

function extractAlbumId(url: string): string | null {
  const parsed = safeParseUrl(url);
  const setParam = parsed.searchParams.get("set") || "";
  const aid = parsed.searchParams.get("aid");
  const albumId = parsed.searchParams.get("album_id");

  const setMatch = setParam.match(/^a\.(\d+)/i);
  if (setMatch) return setMatch[1];

  const albumPathMatch = parsed.pathname.match(/\/albums\/[^/]+\/(\d+)/i);
  if (albumPathMatch) return albumPathMatch[1];

  if (albumId && /^\d+$/.test(albumId)) return albumId;

  if (aid && /^\d+$/.test(aid)) return aid;

  return null;
}

function extractPostId(url: string): string | null {
  const parsed = safeParseUrl(url);

  const storyFbid = parsed.searchParams.get("story_fbid");
  if (storyFbid && /^\d+$/.test(storyFbid)) return storyFbid;

  const fbid = parsed.searchParams.get("fbid");
  if (fbid && /^\d+$/.test(fbid)) return fbid;

  const postPathMatch = parsed.pathname.match(/\/posts\/(\d+)/i);
  if (postPathMatch) return postPathMatch[1];

  const photosPathMatch = parsed.pathname.match(/\/photos\/[^/]+\/(\d+)/i);
  if (photosPathMatch) return photosPathMatch[1];

  return null;
}

function toGraphPostObjectId(postId: string | null, pageId: string): string {
  const normalizedPostId = String(postId || "").trim();
  if (!normalizedPostId) return "";

  // Already in canonical Graph form: {page_id}_{post_id}
  if (normalizedPostId.includes("_")) {
    return normalizedPostId;
  }

  // Singular status IDs can hit deprecated endpoint paths on Graph.
  // Compose canonical post object ID so /{id} fetches post data reliably.
  return `${pageId}_${normalizedPostId}`;
}

class FacebookGraphService {
  private graphVersion: string;
  private facebookActorToken: string;
  private pageId: string;
  private pageAccessTokenFromEnv: string;

  constructor() {
    this.graphVersion = getEnv("FACEBOOK_GRAPH_VERSION", false) || "v25.0";
    this.facebookActorToken =
      getEnv("FACEBOOK_SYSTEM_USER_TOKEN", false) ||
      getEnv("FACEBOOK_USER_ACCESS_TOKEN");
    this.pageId = getEnv("FACEBOOK_PAGE_ID");
    this.pageAccessTokenFromEnv = getEnv("FACEBOOK_PAGE_ACCESS_TOKEN", false);
  }

  private buildGraphUrl(path: string, params: Record<string, string>): string {
    const query = new URLSearchParams(params);
    return `https://graph.facebook.com/${this.graphVersion}${path}?${query.toString()}`;
  }

  private async graphGet(path: string, params: Record<string, string>, token: string, context: GraphRequestContext = {}): Promise<any> {
    const url = this.buildGraphUrl(path, {
      ...params,
      access_token: token,
    });

    const response = await fetch(url);
    const raw = await response.text();
    let payload: any = null;
    try {
      payload = raw ? JSON.parse(raw) : {};
    } catch {
      payload = { raw };
    }

    if (!response.ok || payload?.error) {
      const fbError = payload?.error || {};
      const message = String(fbError?.message || "Facebook Graph API request failed");
      const code = Number(fbError?.code || 0);
      const subcode = Number(fbError?.error_subcode || 0);

      console.error("facebook graph error", {
        endpoint_path: path,
        requested_fields: context.fields || params.fields || null,
        detected_type: context.detectedType || null,
        object_id: context.objectId || null,
        http_status: response.status,
        graph_code: code,
        graph_subcode: subcode,
        graph_message: message,
      });

      if (code === 190) {
        throw new HttpError(401, "Facebook token expired or invalid", "facebook_token_expired", {
          graph_code: code,
          graph_subcode: subcode,
          graph_message: message,
        });
      }

      if (code === 10 || code === 200 || code === 294) {
        throw new HttpError(403, "Missing Facebook permissions for this operation", "facebook_missing_permissions", {
          graph_code: code,
          graph_subcode: subcode,
          graph_message: message,
        });
      }

      if (code === 4 || code === 17 || code === 32 || response.status === 429) {
        throw new HttpError(429, "Facebook API rate limit reached. Try again later", "facebook_rate_limited", {
          graph_code: code,
          graph_subcode: subcode,
          graph_message: message,
        });
      }

      throw new HttpError(502, message, "facebook_api_error", {
        graph_code: code,
        graph_subcode: subcode,
        graph_message: message,
      });
    }

    return payload;
  }

  async fetchFacebookObject(path: string, token: string, fields: string, context: GraphRequestContext = {}) {
    return this.graphGet(path, { fields }, token, {
      ...context,
      fields,
    });
  }

  async getManagedPages() {
    const payload = await this.graphGet("/me/accounts", {
      // `perms` is no longer returned on newer Graph API versions.
      fields: "id,name,access_token,tasks",
      limit: "100",
    }, this.facebookActorToken);

    return Array.isArray(payload?.data) ? payload.data : [];
  }

  async getPageAccessToken(): Promise<string> {
    if (this.pageAccessTokenFromEnv) {
      return this.pageAccessTokenFromEnv;
    }

    const pages = await this.getManagedPages();
    const current = pages.find((page: any) => String(page.id) === this.pageId);

    if (!current?.access_token) {
      throw new HttpError(500, "Unable to resolve page access token for configured FACEBOOK_PAGE_ID", "facebook_page_token_missing");
    }

    return current.access_token;
  }

  getConfiguredPageId(): string {
    return this.pageId;
  }

  private extractPostImages(post: any): SourceImage[] {
    const imageMap = new Map<string, SourceImage>();

    const maybePush = (imageUrl?: string | null, source: Partial<SourceImage> = {}) => {
      if (!imageUrl) return;
      const clean = String(imageUrl).trim();
      if (!clean) return;
      if (!imageMap.has(clean)) {
        imageMap.set(clean, {
          imageUrl: clean,
          caption: source.caption || null,
          originalId: source.originalId || null,
          createdTime: source.createdTime || null,
          link: source.link || null,
        });
      }
    };

    maybePush(post?.full_picture, {
      caption: post?.message || null,
      createdTime: post?.created_time || null,
      link: post?.permalink_url || null,
    });

    const attachments = Array.isArray(post?.attachments?.data) ? post.attachments.data : [];
    for (const attachment of attachments) {
      const mediaType = String(attachment?.media_type || "").toLowerCase();
      const mediaImage = attachment?.media?.image?.src || attachment?.media?.image?.source;
      if (mediaType === "photo" || mediaImage) {
        maybePush(mediaImage, {
          link: attachment?.url || post?.permalink_url || null,
        });
      }

      const subattachments = Array.isArray(attachment?.subattachments?.data)
        ? attachment.subattachments.data
        : [];

      for (const sub of subattachments) {
        const subMediaType = String(sub?.media_type || "").toLowerCase();
        const subImage = sub?.media?.image?.src || sub?.media?.image?.source;
        if (subMediaType === "photo" || subImage) {
          maybePush(subImage, {
            link: sub?.url || attachment?.url || post?.permalink_url || null,
          });
        }
      }
    }

    return Array.from(imageMap.values());
  }

  async fetchFacebookPost(postId: string, token: string) {
    let post: any;
    try {
      post = await this.fetchFacebookObject(
        `/${postId}`,
        token,
        "id,message,created_time,permalink_url,full_picture,attachments{media,media_type,url,target,subattachments{media,media_type,url,target}}",
        { detectedType: "post", objectId: postId },
      );
    } catch (error) {
      if (
        error instanceof HttpError &&
        error.code === "facebook_api_error" &&
        String(error.message || "").toLowerCase().includes("permalink_url")
      ) {
        post = await this.fetchFacebookObject(
          `/${postId}`,
          token,
          "id,message,created_time,link,full_picture,attachments{media,media_type,url,target,subattachments{media,media_type,url,target}}",
          { detectedType: "post", objectId: postId },
        );
        if (!post?.permalink_url && post?.link) {
          post.permalink_url = post.link;
        }
      } else {
        throw error;
      }
    }

    const images = this.extractPostImages(post);

    return {
      post,
      images,
    };
  }

  async fetchFacebookAlbum(albumId: string, token: string) {
    return this.fetchFacebookObject(
      `/${albumId}`,
      token,
      "id,name,description,count,cover_photo,link,created_time",
      { detectedType: "album", objectId: albumId },
    );
  }

  async fetchFacebookAlbumPhotos(albumId: string, token: string) {
    const album = await this.fetchFacebookAlbum(albumId, token);

    const images: SourceImage[] = [];
    const seenUrls = new Set<string>();
    let nextPath = `/${albumId}/photos`;
    let hasNext = true;
    let afterCursor: string | null = null;

    while (hasNext) {
      const params: Record<string, string> = {
        fields: "id,name,images,created_time,link",
        limit: "100",
      };

      if (afterCursor) params.after = afterCursor;

      const page = await this.graphGet(nextPath, params, token, {
        detectedType: "album",
        objectId: albumId,
        fields: params.fields,
      });
      const rows = Array.isArray(page?.data) ? page.data : [];

      for (const row of rows) {
        const best = Array.isArray(row?.images) && row.images.length > 0 ? row.images[0] : null;
        const source = best?.source;
        if (source && !seenUrls.has(source)) {
          seenUrls.add(source);
          images.push({
            imageUrl: source,
            caption: row?.name || null,
            originalId: row?.id || null,
            createdTime: row?.created_time || null,
            link: row?.link || album?.link || null,
          });
        }
      }

      afterCursor = page?.paging?.cursors?.after || null;
      hasNext = Boolean(afterCursor);
    }

    return {
      album,
      images,
    };
  }
}

class FacebookImportController {
  private adminClient: any;
  private graphService: FacebookGraphService;
  private supabaseUrl: string;
  private allowedOrigins: string[];

  constructor(adminClient: any, supabaseUrl: string) {
    this.adminClient = adminClient;
    this.supabaseUrl = supabaseUrl;
    this.graphService = new FacebookGraphService();
    this.allowedOrigins = (getEnv("FACEBOOK_IMPORT_ALLOWED_ORIGINS", false) || "")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean);
  }

  private assertOrigin(req: Request) {
    if (this.allowedOrigins.length === 0) return;
    const origin = req.headers.get("origin")?.trim();
    if (!origin) {
      throw new HttpError(403, "Forbidden origin", "forbidden_origin");
    }
    if (!this.allowedOrigins.includes(origin)) {
      throw new HttpError(403, "Forbidden origin", "forbidden_origin");
    }
  }

  private async authenticateAdmin(req: Request): Promise<string> {
    const authHeader = req.headers.get("authorization")?.trim() || "";

    if (!authHeader) {
      console.warn("import-facebook-media missing Authorization header");
      throw new HttpError(401, "Unauthorized: missing bearer token", "unauthorized");
    }

    if (!/^Bearer\s+/i.test(authHeader)) {
      console.warn("import-facebook-media invalid Authorization scheme");
      throw new HttpError(401, "Unauthorized: invalid bearer token", "unauthorized");
    }

    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) {
      console.warn("import-facebook-media empty bearer token");
      throw new HttpError(401, "Unauthorized: missing bearer token", "unauthorized");
    }

    let userId: string | null = null;
    const { data: userData, error: userErr } = await this.adminClient.auth.getUser(token) as any;
    if (userErr || !userData?.user?.id) {
      console.warn("import-facebook-media auth.getUser failed", {
        code: userErr?.code || null,
        status: userErr?.status || null,
        message: userErr?.message || "Cannot identify user",
      });
      throw new HttpError(401, "Unauthorized: invalid or expired session", "unauthorized");
    }

    userId = userData.user.id;

    if (!userId) {
      throw new HttpError(401, "Cannot identify user", "unauthorized");
    }

    let allowed = false;

    try {
      const { data, error } = await this.adminClient
        .rpc("has_permission", { p_perm: "events" });
      if (!error && data === true) {
        allowed = true;
      }
    } catch {
      // noop, fallback checks below
    }

    if (!allowed) {
      const { data: memberRow, error: memberErr } = await this.adminClient
        .from("members")
        .select("role")
        .eq("auth_user_id", userId)
        .maybeSingle();

      if (!memberErr && memberRow?.role && ["admin", "super_admin"].includes(memberRow.role)) {
        allowed = true;
      }
    }

    if (!allowed) {
      throw new HttpError(403, "Forbidden: events admin permission required", "forbidden");
    }

    return userId;
  }

  private validatePayload(input: unknown): ImportPayload {
    if (!input || typeof input !== "object") {
      throw new HttpError(400, "Invalid request payload", "invalid_payload");
    }

    const payload = input as Record<string, unknown>;

    // Support both single URL and multiple URLs
    let urlsToValidate: string[] = [];
    
    if (Array.isArray(payload.facebook_urls) && payload.facebook_urls.length > 0) {
      urlsToValidate = payload.facebook_urls
        .map((url) => sanitizeText(url, 2000))
        .filter(Boolean);
    } else {
      const singleUrl = sanitizeText(payload.facebook_url, 2000);
      if (singleUrl) {
        urlsToValidate = [singleUrl];
      }
    }

    if (urlsToValidate.length === 0) {
      throw new HttpError(400, "facebook_url or facebook_urls is required", "invalid_facebook_url");
    }

    // Validate all URLs
    for (const url of urlsToValidate) {
      const parsed = safeParseUrl(url);
      if (!isFacebookHost(parsed.hostname.toLowerCase())) {
        throw new HttpError(400, "Only Facebook post/album URLs are supported (facebook.com, web.facebook.com, m.facebook.com, fb.watch)", "unsupported_url_pattern");
      }
    }

    const rawType = sanitizeText(payload.content_type, 24).toLowerCase() as ContentType;
    const contentType: ContentType = ["post", "album", "auto_detect"].includes(rawType)
      ? rawType
      : "auto_detect";

    const eventIdRaw = payload.event_id;
    const eventId = eventIdRaw === null || eventIdRaw === undefined || eventIdRaw === ""
      ? null
      : Number(eventIdRaw);

    if (eventId !== null && (!Number.isInteger(eventId) || eventId <= 0)) {
      throw new HttpError(400, "event_id must be a positive integer", "invalid_event_id");
    }

    const galleryId = sanitizeText(payload.gallery_id, 80) || null;

    return {
      facebook_urls: urlsToValidate,
      content_type: contentType,
      event_id: eventId,
      gallery_id: galleryId,
      force_resync: parseBoolean(payload.force_resync),
    };
  }

  private async ensureEventAndGallery(payload: ImportPayload) {
    if (payload.event_id) {
      const { data: eventRow, error } = await this.adminClient
        .from("events")
        .select("id")
        .eq("id", payload.event_id)
        .maybeSingle();

      if (error || !eventRow) {
        throw new HttpError(400, "Selected event does not exist", "invalid_event_id");
      }
    }

    if (payload.gallery_id) {
      const { data: galleryRow, error } = await this.adminClient
        .from("galleries")
        .select("id,event_id")
        .eq("id", payload.gallery_id)
        .maybeSingle();

      if (error || !galleryRow) {
        throw new HttpError(400, "Selected gallery does not exist", "invalid_gallery_id");
      }

      if (payload.event_id && Number(galleryRow.event_id) !== payload.event_id) {
        throw new HttpError(400, "Gallery does not belong to selected event", "gallery_event_mismatch");
      }
    }
  }

  private detectFacebookUrlType(url: string): DetectedType {
    const detectedType = detectTypeFromUrl(url);
    if (!detectedType) {
      throw new HttpError(
        400,
        "Unable to detect Facebook URL type. Use a post URL (/posts/ or /permalink/) or an album URL (/albums/ or album_id=).",
        "unsupported_url_pattern",
      );
    }

    return detectedType;
  }

  private extractFacebookObjectId(url: string, detectedType: DetectedType): string {
    if (detectedType === "album") {
      const albumId = extractAlbumId(url);
      if (!albumId) {
        throw new HttpError(400, "Unable to extract Facebook album id from URL", "unsupported_url_pattern");
      }
      return albumId;
    }

    const postId = extractPostId(url);
    const graphPostId = toGraphPostObjectId(postId, this.graphService.getConfiguredPageId());
    if (!graphPostId) {
      throw new HttpError(400, "Unable to extract Facebook post id from URL", "unsupported_url_pattern");
    }

    return graphPostId;
  }

  private async resolveTypeAndObject(payload: Partial<ImportPayload> & { facebook_url: string }): Promise<{ detectedType: DetectedType; objectId: string }> {
    const originalParsed = safeParseUrl(payload.facebook_url);
    const isOriginalShare = isFacebookSharePath(originalParsed.pathname);

    let canonicalUrl = payload.facebook_url;
    try {
      canonicalUrl = await resolveFacebookShareUrl(payload.facebook_url);
    } catch (error) {
      if (isOriginalShare) {
        console.warn("import-facebook-media url resolution", {
          original_url: payload.facebook_url,
          resolved_url: canonicalUrl,
          resolved_pathname: originalParsed.pathname,
          resolved_search: originalParsed.search,
          detected_type: null,
          extracted_post_id: null,
          extracted_album_id: null,
          failure_reason: "share_resolution_failed",
        });
        throw new HttpError(
          400,
          "Please paste the original Facebook post or album URL, not a Facebook share link.",
          "facebook_share_link_not_supported",
        );
      }

      throw error;
    }

    const resolvedParsed = safeParseUrl(canonicalUrl);
    const extractedPostId = extractPostId(canonicalUrl);
    const extractedAlbumId = extractAlbumId(canonicalUrl);

    if (isOriginalShare) {
      let failureReason: string | null = null;
      if (isFacebookSharePath(resolvedParsed.pathname)) {
        failureReason = "share_still_unresolved";
      } else if (isUnsupportedResolvedFacebookPath(resolvedParsed.pathname)) {
        failureReason = "resolved_to_login_or_unsupported_path";
      } else if (!extractedPostId && !extractedAlbumId) {
        failureReason = "no_extractable_post_or_album_id";
      }

      if (failureReason) {
        console.warn("import-facebook-media url resolution", {
          original_url: payload.facebook_url,
          resolved_url: canonicalUrl,
          resolved_pathname: resolvedParsed.pathname,
          resolved_search: resolvedParsed.search,
          detected_type: null,
          extracted_post_id: extractedPostId,
          extracted_album_id: extractedAlbumId,
          failure_reason: failureReason,
        });
        throw new HttpError(
          400,
          "Please paste the original Facebook post or album URL, not a Facebook share link.",
          "facebook_share_link_not_supported",
        );
      }
    }

    let autoDetectedType: DetectedType;
    try {
      autoDetectedType = this.detectFacebookUrlType(canonicalUrl);
    } catch {
      // Fallback to simple id-based inference for uncommon URL forms.
      if (extractedAlbumId) {
        autoDetectedType = "album";
      } else if (extractedPostId) {
        autoDetectedType = "post";
      } else {
        if (isOriginalShare) {
          console.warn("import-facebook-media url resolution", {
            original_url: payload.facebook_url,
            resolved_url: canonicalUrl,
            resolved_pathname: resolvedParsed.pathname,
            resolved_search: resolvedParsed.search,
            detected_type: null,
            extracted_post_id: extractedPostId,
            extracted_album_id: extractedAlbumId,
            failure_reason: "share_detect_type_failed",
          });
          throw new HttpError(
            400,
            "Please paste the original Facebook post or album URL, not a Facebook share link.",
            "facebook_share_link_not_supported",
          );
        }

        throw new HttpError(
          400,
          "Unable to detect Facebook URL type. Use a post URL (/posts/ or /permalink/) or an album URL (/albums/ or album_id=).",
          "unsupported_url_pattern",
        );
      }
    }

    const contentType = payload.content_type || "auto_detect";
    const detectedType: DetectedType = contentType === "auto_detect"
      ? autoDetectedType
      : (contentType as DetectedType);
    const objectId = this.extractFacebookObjectId(canonicalUrl, detectedType);

    console.log("import-facebook-media url resolution", {
      original_url: payload.facebook_url,
      resolved_url: canonicalUrl,
      resolved_pathname: resolvedParsed.pathname,
      resolved_search: resolvedParsed.search,
      detected_type: detectedType,
      extracted_post_id: extractedPostId,
      extracted_album_id: extractedAlbumId,
      extracted_object_id: objectId,
      failure_reason: null,
    });

    return { detectedType, objectId };
  }

  private async downloadAndStoreImage(imageUrl: string, sourceType: SourceType, objectId: string, index: number) {
    const response = await fetch(imageUrl);

    if (!response.ok) {
      throw new HttpError(502, "Failed to download image from Facebook", "image_download_failed", {
        image_url: imageUrl,
        status: response.status,
      });
    }

    const mimeType = String(response.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    if (!mimeType.startsWith("image/")) {
      throw new HttpError(415, "Downloaded file is not a valid image", "invalid_image_mime", {
        image_url: imageUrl,
        mime_type: mimeType || "unknown",
      });
    }

    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length === 0) {
      throw new HttpError(422, "Downloaded image is empty", "image_download_failed", {
        image_url: imageUrl,
      });
    }

    const extension = getFileExtensionFromMime(mimeType);
    const filePath = [
      "facebook-imports",
      sourceType,
      objectId,
      `${Date.now()}-${index}-${crypto.randomUUID()}.${extension}`,
    ].join("/");

    const { error: uploadError } = await this.adminClient
      .storage
      .from("event-gallery")
      .upload(filePath, bytes, {
        contentType: mimeType,
        upsert: false,
      });

    if (uploadError) {
      throw new HttpError(500, "Failed to store downloaded image", "storage_upload_failed", {
        image_url: imageUrl,
        storage_error: uploadError.message,
      });
    }

    const publicUrl = `${this.supabaseUrl}/storage/v1/object/public/event-gallery/${filePath}`;

    return {
      mimeType,
      filePath,
      publicUrl,
      byteSize: bytes.length,
    };
  }

  async importFacebookUrl(req: Request) {
    this.assertOrigin(req);

    const userId = await this.authenticateAdmin(req);

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      throw new HttpError(400, "Invalid JSON body", "invalid_payload");
    }

    const payload = this.validatePayload(body);
    await this.ensureEventAndGallery(payload);

    const pageToken = await this.graphService.getPageAccessToken();
    const facebookUrls = payload.facebook_urls || [];

    console.log("import-facebook-media request", {
      request_urls: facebookUrls,
      url_count: facebookUrls.length,
      event_id: payload.event_id || null,
      gallery_id: payload.gallery_id || null,
      force_resync: payload.force_resync === true,
    });

    // Deduplicate images across all URLs
    const seenImageUrls = new Set<string>();
    const allSavedImages: Array<Record<string, unknown>> = [];
    let totalImportedCount = 0;
    let totalSkippedCount = 0;

    for (const facebookUrl of facebookUrls) {
      try {
        const { detectedType, objectId } = await this.resolveTypeAndObject({
          facebook_url: facebookUrl,
          content_type: payload.content_type,
          event_id: payload.event_id,
          gallery_id: payload.gallery_id,
          force_resync: payload.force_resync,
        });

        const sourceType: SourceType = detectedType === "album" ? "facebook_album" : "facebook_post";
        let sourceImages: SourceImage[] = [];

        if (detectedType === "post") {
          const postData = await this.graphService.fetchFacebookPost(objectId, pageToken);
          sourceImages = postData.images;
        } else {
          const albumData = await this.graphService.fetchFacebookAlbumPhotos(objectId, pageToken);
          sourceImages = albumData.images;
        }

        if (sourceImages.length === 0) {
          console.warn("import-facebook-media no images", {
            facebook_url: facebookUrl,
            detected_type: detectedType,
          });
          continue;
        }

        // Add images from this URL, skipping duplicates across all URLs
        for (let i = 0; i < sourceImages.length; i += 1) {
          const sourceImage = sourceImages[i];

          if (seenImageUrls.has(sourceImage.imageUrl)) {
            totalSkippedCount += 1;
            continue;
          }

          seenImageUrls.add(sourceImage.imageUrl);
          totalImportedCount += 1;
          allSavedImages.push({
            id: crypto.randomUUID(),
            image_url_original: sourceImage.imageUrl,
            image_path_local: '',
            public_url: sourceImage.imageUrl,
            sort_order: allSavedImages.length,
            caption: sourceImage.caption,
            source_url: facebookUrl,
          });
        }
      } catch (error) {
        console.error("import-facebook-media url fetch error", {
          facebook_url: facebookUrl,
          error: error instanceof Error ? error.message : String(error),
        });
        // Continue with next URL instead of failing
        continue;
      }
    }

    if (allSavedImages.length === 0) {
      throw new HttpError(422, "No images found in any of the provided Facebook URLs", "no_images_found");
    }

    console.log("import-facebook-media result", {
      request_urls: facebookUrls,
      url_count: facebookUrls.length,
      imported_count: totalImportedCount,
      skipped_count: totalSkippedCount,
      total_images: allSavedImages.length,
    });

    return {
      ok: true,
      message: `Imported ${totalImportedCount} image(s)${totalSkippedCount > 0 ? `, skipped ${totalSkippedCount} duplicate(s)` : ""} from ${facebookUrls.length} source(s).`,
      imported_count: totalImportedCount,
      skipped_count: totalSkippedCount,
      total_urls: facebookUrls.length,
      images: allSavedImages,
    };
  }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const supabaseUrl = getEnv("SUPABASE_URL");
    const serviceRoleKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const controller = new FacebookImportController(adminClient, supabaseUrl);
    const result = await controller.importFacebookUrl(req);
    return jsonResponse(result, 200);
  } catch (error) {
    if (error instanceof HttpError) {
      console.error("import-facebook-media handled error", {
        code: error.code,
        message: error.message,
        status: error.status,
        details: error.details || null,
      });

      return jsonResponse(
        {
          error: error.message,
          code: error.code,
          details: error.details || null,
        },
        error.status,
      );
    }

    console.error("import-facebook-media unhandled error", error);
    return jsonResponse(
      {
        error: "Unexpected server error",
        code: "unexpected_error",
      },
      500,
    );
  }
});
