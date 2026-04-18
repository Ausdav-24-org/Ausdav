import { useState } from 'react';
import {
  CompressionQuality,
  downloadPDFWithCompression,
  downloadImageWithCompression,
  triggerDownload,
  CompressionStats,
} from '@/lib/downloadWithCompression';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface UseDownloadWithCompressionState {
  dialogOpen: boolean;
  selectedFile: {
    bucket: string;
    path: string;
    filename: string;
    fileType: 'pdf' | 'image';
    originalSize: number;
  } | null;
  isDownloading: boolean;
}

export const useDownloadWithCompression = () => {
  const [state, setState] = useState<UseDownloadWithCompressionState>({
    dialogOpen: false,
    selectedFile: null,
    isDownloading: false,
  });

  const openDownloadDialog = (
    bucket: string,
    path: string,
    filename: string,
    fileType: 'pdf' | 'image',
    originalSize: number
  ) => {
    setState(prev => ({
      ...prev,
      dialogOpen: true,
      selectedFile: { bucket, path, filename, fileType, originalSize },
    }));
  };

  const closeDownloadDialog = () => {
    setState(prev => ({ ...prev, dialogOpen: false }));
  };

  const handleDownload = async (quality: CompressionQuality) => {
    if (!state.selectedFile) return;

    setState(prev => ({ ...prev, isDownloading: true }));

    try {
      const { data, error } = await supabase.storage
        .from(state.selectedFile.bucket)
        .download(state.selectedFile.path);

      if (error) throw error;

      let result: { blob: Blob; stats: CompressionStats };

      if (state.selectedFile.fileType === 'pdf') {
        result = await downloadPDFWithCompression(data, state.selectedFile.filename, quality);
      } else {
        result = await downloadImageWithCompression(data, state.selectedFile.filename, quality);
      }

      // Show compression stats
      const stats = result.stats;
      toast.success(
        `Downloaded! (${stats.savingsPercent}% smaller, ${stats.format})`
      );

      // Trigger download
      triggerDownload(result.blob, state.selectedFile.filename);
    } catch (err: any) {
      toast.error(`Download failed: ${err.message}`);
    } finally {
      setState(prev => ({ ...prev, isDownloading: false }));
    }
  };

  return {
    dialogOpen: state.dialogOpen,
    selectedFile: state.selectedFile,
    isDownloading: state.isDownloading,
    openDownloadDialog,
    closeDownloadDialog,
    handleDownload,
  };
};
