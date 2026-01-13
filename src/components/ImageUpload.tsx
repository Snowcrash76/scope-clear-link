import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { ImagePlus, X, Image as ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ImageUploadProps {
  value?: string;
  onChange: (url: string | undefined) => void;
  className?: string;
}

export function ImageUpload({ value, onChange, className }: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileChange = (file: File | null) => {
    if (file && file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      onChange(url);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    handleFileChange(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    handleFileChange(file);
  };

  const handleRemove = () => {
    onChange(undefined);
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  if (value) {
    return (
      <div className={cn("relative group", className)}>
        <img 
          src={value} 
          alt="Uploaded" 
          className="w-full h-32 object-cover rounded-lg border border-border"
        />
        <button
          onClick={handleRemove}
          className="absolute top-2 right-2 p-1.5 bg-background/80 backdrop-blur-sm rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive hover:text-destructive-foreground"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={cn(
        "relative flex flex-col items-center justify-center gap-2 p-4 border-2 border-dashed rounded-lg cursor-pointer transition-all duration-200",
        isDragging 
          ? "border-primary bg-primary/5" 
          : "border-border hover:border-primary/50 hover:bg-secondary/50",
        className
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleInputChange}
        className="hidden"
      />
      <ImagePlus className="w-6 h-6 text-muted-foreground" />
      <span className="text-sm text-muted-foreground text-center">
        Click or drag to add photo
      </span>
    </div>
  );
}

interface ImageDisplayProps {
  src: string;
  alt?: string;
  className?: string;
}

export function ImageDisplay({ src, alt = "Attached image", className }: ImageDisplayProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <>
      <div 
        className={cn(
          "relative cursor-pointer overflow-hidden rounded-lg border border-border transition-all hover:border-primary/50",
          className
        )}
        onClick={() => setIsExpanded(true)}
      >
        <img 
          src={src} 
          alt={alt}
          className="w-full h-24 object-cover"
        />
        <div className="absolute inset-0 bg-background/0 hover:bg-background/10 transition-colors flex items-center justify-center">
          <ImageIcon className="w-5 h-5 text-white/0 hover:text-white/80 transition-colors drop-shadow-md" />
        </div>
      </div>

      {isExpanded && (
        <div 
          className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setIsExpanded(false)}
        >
          <div className="relative max-w-4xl max-h-[90vh] animate-scale-in">
            <img 
              src={src} 
              alt={alt}
              className="max-w-full max-h-[90vh] rounded-lg shadow-2xl object-contain"
            />
            <button
              onClick={() => setIsExpanded(false)}
              className="absolute top-2 right-2 p-2 bg-background/80 backdrop-blur-sm rounded-full shadow-md hover:bg-destructive hover:text-destructive-foreground transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
