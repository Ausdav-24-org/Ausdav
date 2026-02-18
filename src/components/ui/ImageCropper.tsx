import { useState, useRef, useCallback, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { ZoomIn, ZoomOut, RotateCw, Check, X, Loader2 } from 'lucide-react';

interface ImageCropperProps {
  open: boolean;
  onClose: () => void;
  imageSrc: string;
  onCropComplete: (croppedBlob: Blob) => void;
  aspectRatio?: number; // 1 for square (default for profile pics)
}

export function ImageCropper({
  open,
  onClose,
  imageSrc,
  onCropComplete,
  aspectRatio = 1,
}: ImageCropperProps) {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, posX: 0, posY: 0 });
  const [imageLoaded, setImageLoaded] = useState(false);
  const [isCropping, setIsCropping] = useState(false);
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // Reset state when image changes
  useEffect(() => {
    if (open) {
      setZoom(1);
      setRotation(0);
      setPosition({ x: 0, y: 0 });
      setImageLoaded(false);
    }
  }, [open, imageSrc]);

  const handleImageLoad = useCallback(() => {
    if (imageRef.current) {
      setImageDimensions({
        width: imageRef.current.naturalWidth,
        height: imageRef.current.naturalHeight,
      });
      setImageLoaded(true);
    }
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setDragStart({
      x: e.clientX,
      y: e.clientY,
      posX: position.x,
      posY: position.y,
    });
  }, [position]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    
    const deltaX = e.clientX - dragStart.x;
    const deltaY = e.clientY - dragStart.y;
    
    setPosition({
      x: dragStart.posX + deltaX,
      y: dragStart.posY + deltaY,
    });
  }, [isDragging, dragStart]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    setIsDragging(true);
    setDragStart({
      x: touch.clientX,
      y: touch.clientY,
      posX: position.x,
      posY: position.y,
    });
  }, [position]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging) return;
    
    const touch = e.touches[0];
    const deltaX = touch.clientX - dragStart.x;
    const deltaY = touch.clientY - dragStart.y;
    
    setPosition({
      x: dragStart.posX + deltaX,
      y: dragStart.posY + deltaY,
    });
  }, [isDragging, dragStart]);

  const handleCrop = useCallback(async () => {
    if (!imageRef.current || !containerRef.current) return;
    if (isCropping) return;
    setIsCropping(true);

    try {
      const image = imageRef.current;
      const container = containerRef.current;
      const containerRect = container.getBoundingClientRect();
      
      // The crop circle is 80% of container (40% radius from center)
      const cropSize = containerRect.width * 0.8;
      const cropLeft = (containerRect.width - cropSize) / 2;
      const cropTop = (containerRect.height - cropSize) / 2;

      // Create a canvas to draw the result
      const outputSize = 400;
      const canvas = document.createElement('canvas');
      canvas.width = outputSize;
      canvas.height = outputSize;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        setIsCropping(false);
        return;
      }

      // Calculate the displayed image dimensions (object-cover behavior)
      const containerAspect = containerRect.width / containerRect.height;
      const imageAspect = imageDimensions.width / imageDimensions.height;
      
      let displayedWidth: number, displayedHeight: number;
      if (imageAspect > containerAspect) {
        // Image is wider - height fits, width is cropped
        displayedHeight = containerRect.height;
        displayedWidth = displayedHeight * imageAspect;
      } else {
        // Image is taller - width fits, height is cropped
        displayedWidth = containerRect.width;
        displayedHeight = displayedWidth / imageAspect;
      }

      // Apply zoom
      displayedWidth *= zoom;
      displayedHeight *= zoom;

      // Calculate where the image starts (centered + position offset)
      const imageLeft = (containerRect.width - displayedWidth) / 2 + position.x;
      const imageTop = (containerRect.height - displayedHeight) / 2 + position.y;

      // Calculate the source rectangle in the original image
      const scaleX = imageDimensions.width / displayedWidth;
      const scaleY = imageDimensions.height / displayedHeight;

      const srcX = (cropLeft - imageLeft) * scaleX;
      const srcY = (cropTop - imageTop) * scaleY;
      const srcWidth = cropSize * scaleX;
      const srcHeight = cropSize * scaleY;

      // Handle rotation
      if (rotation !== 0) {
        ctx.translate(outputSize / 2, outputSize / 2);
        ctx.rotate((rotation * Math.PI) / 180);
        ctx.translate(-outputSize / 2, -outputSize / 2);
      }

      // Draw the cropped portion
      ctx.drawImage(
        image,
        Math.max(0, srcX),
        Math.max(0, srcY),
        Math.min(srcWidth, imageDimensions.width - srcX),
        Math.min(srcHeight, imageDimensions.height - srcY),
        0,
        0,
        outputSize,
        outputSize
      );

      canvas.toBlob(
        (blob) => {
          try {
            if (blob) {
              onCropComplete(blob);
              handleClose();
            }
          } finally {
            setIsCropping(false);
          }
        },
        'image/jpeg',
        0.92
      );
    } catch (err) {
      console.error('Crop failed:', err);
      setIsCropping(false);
    }
  }, [zoom, position, rotation, imageDimensions, onCropComplete, isCropping, handleClose]);

  const handleClose = useCallback(() => {
    setZoom(1);
    setRotation(0);
    setPosition({ x: 0, y: 0 });
    onClose();
  }, [onClose]);

  const rotateImage = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Crop Image</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Crop Area */}
          <div
            ref={containerRef}
            className="relative w-full aspect-square bg-black rounded-lg overflow-hidden cursor-move select-none"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleMouseUp}
          >
            {/* Image */}
            <img
              ref={imageRef}
              src={imageSrc}
              alt="Crop preview"
              className="absolute w-full h-full object-cover pointer-events-none"
              style={{
                transform: `translate(${position.x}px, ${position.y}px) scale(${zoom}) rotate(${rotation}deg)`,
                transformOrigin: 'center',
              }}
              draggable={false}
              onLoad={handleImageLoad}
            />
            
            {/* Overlay with circular cutout */}
            <div className="absolute inset-0 pointer-events-none">
              <svg className="w-full h-full">
                <defs>
                  <mask id="circleMask">
                    <rect width="100%" height="100%" fill="white" />
                    <circle cx="50%" cy="50%" r="40%" fill="black" />
                  </mask>
                </defs>
                <rect
                  width="100%"
                  height="100%"
                  fill="rgba(0,0,0,0.6)"
                  mask="url(#circleMask)"
                />
                <circle
                  cx="50%"
                  cy="50%"
                  r="40%"
                  fill="none"
                  stroke="white"
                  strokeWidth="2"
                  strokeDasharray="4 4"
                />
              </svg>
            </div>
          </div>

          {/* Zoom Control */}
          <div className="flex items-center gap-3">
            <ZoomOut className="w-4 h-4 text-muted-foreground" />
            <Slider
              value={[zoom]}
              onValueChange={([value]) => setZoom(value)}
              min={1}
              max={3}
              step={0.1}
              className="flex-1"
            />
            <ZoomIn className="w-4 h-4 text-muted-foreground" />
          </div>

          {/* Rotate Button */}
          <div className="flex justify-center">
            <Button variant="outline" size="sm" onClick={rotateImage}>
              <RotateCw className="w-4 h-4 mr-2" />
              Rotate 90°
            </Button>
          </div>
        </div>

        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={handleClose} disabled={isCropping}>
            <X className="w-4 h-4 mr-2" />
            Cancel
          </Button>
          <Button onClick={handleCrop} disabled={isCropping || !imageLoaded}>
            {isCropping ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Applying...
              </>
            ) : (
              <>
                <Check className="w-4 h-4 mr-2" />
                Apply
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
