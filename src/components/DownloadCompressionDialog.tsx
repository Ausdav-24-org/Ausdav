import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Loader2, Download } from 'lucide-react';
import { CompressionQuality, formatBytes } from '@/lib/downloadWithCompression';

interface DownloadCompressionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filename: string;
  fileType: 'pdf' | 'image';
  originalSize: number;
  onDownload: (quality: CompressionQuality) => Promise<void>;
  isLoading?: boolean;
}

export const DownloadCompressionDialog: React.FC<DownloadCompressionDialogProps> = ({
  open,
  onOpenChange,
  filename,
  fileType,
  originalSize,
  onDownload,
  isLoading = false,
}) => {
  const [selectedQuality, setSelectedQuality] = useState<CompressionQuality>('high');
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await onDownload(selectedQuality);
      onOpenChange(false);
    } finally {
      setDownloading(false);
    }
  };

  const qualityOptions: CompressionQuality[] = ['low', 'medium', 'high'];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Download {fileType === 'pdf' ? 'PDF' : 'Image'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded-lg">
            <p className="text-sm text-blue-900 dark:text-blue-100">
              Original file size: <span className="font-semibold">{formatBytes(originalSize)}</span>
            </p>
          </div>

          <RadioGroup value={selectedQuality} onValueChange={(value) => setSelectedQuality(value as CompressionQuality)}>
            <div className="space-y-3">
              {qualityOptions.map((quality) => (
                <div key={quality} className="flex items-start space-x-2 border rounded-lg p-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900">
                  <RadioGroupItem value={quality} id={`quality-${quality}`} className="mt-1" />
                  <Label htmlFor={`quality-${quality}`} className="flex-1 cursor-pointer">
                    <div className="capitalize font-medium">{quality} Quality</div>
                  </Label>
                </div>
              ))}
            </div>
          </RadioGroup>


        </div>

        <DialogFooter className="sm:justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={downloading || isLoading}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleDownload}
            disabled={downloading || isLoading}
          >
            {downloading || isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Downloading...
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                Download
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
