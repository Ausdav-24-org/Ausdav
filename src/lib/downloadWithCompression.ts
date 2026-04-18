import { compressImageBlob } from './imageCompression';
import { compressPDFBlob } from './pdfCompression';

export type CompressionQuality = 'low' | 'medium' | 'high';

export interface DownloadOptions {
  filename: string;
  bucket: string;
  path: string;
  fileType: 'pdf' | 'image';
  defaultQuality?: CompressionQuality;
}

export interface CompressionStats {
  originalSize: number;
  compressedSize: number;
  savingsPercent: number;
  format?: string;
}

/**
 * Download and compress a PDF file
 */
export const downloadPDFWithCompression = async (
  blob: Blob,
  filename: string,
  quality: CompressionQuality = 'high'
): Promise<{ blob: Blob; stats: CompressionStats }> => {
  const originalSize = blob.size;

  // Compress PDF
  const compressedBlob = await compressPDFBlob(blob, { quality });

  const compressedSize = compressedBlob.size;
  const savingsPercent = Math.round(((originalSize - compressedSize) / originalSize) * 100);

  return {
    blob: compressedBlob,
    stats: {
      originalSize,
      compressedSize,
      savingsPercent,
      format: 'PDF',
    },
  };
};

/**
 * Download and compress an image file
 */
export const downloadImageWithCompression = async (
  blob: Blob,
  filename: string,
  quality: CompressionQuality = 'high'
): Promise<{ blob: Blob; stats: CompressionStats }> => {
  const originalSize = blob.size;

  // Determine quality percentage
  const qualityMap = {
    low: 0.75, // 75% quality
    medium: 0.85, // 85% quality
    high: 0.92, // 92% quality
  };

  // Compress image
  const compressedBlob = await compressImageBlob(blob, {
    maxSize: 1200,
    quality: qualityMap[quality],
    mimeType: 'image/jpeg',
  });

  const compressedSize = compressedBlob.size;
  const savingsPercent = Math.round(((originalSize - compressedSize) / originalSize) * 100);

  return {
    blob: compressedBlob,
    stats: {
      originalSize,
      compressedSize,
      savingsPercent,
      format: 'JPEG',
    },
  };
};

/**
 * Trigger browser download for a blob file
 */
export const triggerDownload = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Format bytes to readable size
 */
export const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
};

/**
 * Get compression description text
 */
export const getCompressionDescription = (quality: CompressionQuality): string => {
  const descriptions = {
    low: 'Smaller file size, lower quality',
    medium: 'Balanced quality and file size',
    high: 'Best quality, minimal compression',
  };
  return descriptions[quality];
};
