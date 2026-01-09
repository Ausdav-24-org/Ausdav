export interface ImageCompressionOptions {
  maxSize?: number;
  quality?: number;
  mimeType?: string;
}

export interface TargetSizeOptions {
  maxSize?: number;
  minBytes: number;
  maxBytes: number;
  mimeType?: string;
}

export async function compressImageBlob(
  blob: Blob,
  { maxSize = 512, quality = 0.82, mimeType = 'image/jpeg' }: ImageCompressionOptions = {}
): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(blob);
    const maxDim = Math.max(bitmap.width, bitmap.height);
    const scale = Math.min(1, maxSize / maxDim);
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      bitmap.close?.();
      return blob;
    }

    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();

    const compressed = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, mimeType, quality)
    );

    return compressed || blob;
  } catch {
    return blob;
  }
}

export async function compressImageToTargetSize(
  blob: Blob,
  { maxSize = 1200, minBytes, maxBytes, mimeType = 'image/jpeg' }: TargetSizeOptions
): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(blob);
    const maxDim = Math.max(bitmap.width, bitmap.height);
    const scale = Math.min(1, maxSize / maxDim);
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      bitmap.close?.();
      return blob;
    }

    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();

    let low = 0.4;
    let high = 0.92;
    let best: Blob | null = null;

    for (let i = 0; i < 7; i += 1) {
      const mid = (low + high) / 2;
      const candidate = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, mimeType, mid)
      );
      if (!candidate) break;

      if (candidate.size > maxBytes) {
        high = mid;
      } else {
        best = candidate;
        if (candidate.size < minBytes) {
          low = mid;
        } else {
          break;
        }
      }
    }

    return best || blob;
  } catch {
    return blob;
  }
}
