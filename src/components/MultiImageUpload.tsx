import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { ImagePlus, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { isClientPage } from '@/lib/clientAccess';
import { uploadClientImage } from '@/lib/clientImageUpload';
import { toast } from 'sonner';

interface MultiImageUploadProps {
  value: string[];
  onChange: (urls: string[]) => void;
  className?: string;
  bucket?: string;
  folder?: string;
  maxImages?: number;
}

export function MultiImageUpload({ 
  value = [], 
  onChange, 
  className,
  bucket = 'scope-images',
  folder = 'uploads',
  maxImages = 10
}: MultiImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const uploadToStorage = async (file: File): Promise<string | null> => {
    try {
      if (isClientPage()) return await uploadClientImage(file,bucket);
      const {data:{user}}=await supabase.auth.getUser();
      if(!user)throw new Error('Sign in before uploading an image.');
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${folder}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      
      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (error) {
        console.error('Upload error:', error);
        return null;
      }

      // Store the path, not the signed URL (we'll generate signed URLs when displaying)
      return data.path;
    } catch (error) {
      console.error('Upload error:', error);
      return null;
    }
  };

  const handleFilesChange = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    
    const remainingSlots = maxImages - value.length;
    if (remainingSlots <= 0) {
      toast.error(`Maximum ${maxImages} images allowed`);
      return;
    }

    const filesToUpload = Array.from(files).slice(0, remainingSlots);
    const imageFiles = filesToUpload.filter(f => f.type.startsWith('image/'));
    
    if (imageFiles.length === 0) {
      toast.error('Please select image files only');
      return;
    }

    setIsUploading(true);
    
    try {
      const uploadPromises = imageFiles.map(file => uploadToStorage(file));
      const results = await Promise.all(uploadPromises);
      const successfulUploads = results.filter((url): url is string => url !== null);
      
      if (successfulUploads.length > 0) {
        onChange([...value, ...successfulUploads]);
        toast.success(`${successfulUploads.length} image${successfulUploads.length > 1 ? 's' : ''} uploaded`);
      }
      
      if (successfulUploads.length < imageFiles.length) {
        toast.error(`${imageFiles.length - successfulUploads.length} image(s) failed to upload`);
      }
    } finally {
      setIsUploading(false);
      if (inputRef.current) {
        inputRef.current.value = '';
      }
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFilesChange(e.target.files);
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
    handleFilesChange(e.dataTransfer.files);
  };

  const handleRemove = (index: number) => {
    const newUrls = value.filter((_, i) => i !== index);
    onChange(newUrls);
  };

  return (
    <div className={cn("space-y-3", className)}>
      {/* Existing images grid */}
      {value.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {value.map((url, index) => (
            <ImageThumbnail 
              key={index} 
              path={url} 
              bucket={bucket}
              onRemove={() => handleRemove(index)} 
            />
          ))}
        </div>
      )}

      {/* Upload area */}
      {value.length < maxImages && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !isUploading && inputRef.current?.click()}
          className={cn(
            "relative flex flex-col items-center justify-center gap-2 p-4 border-2 border-dashed rounded-lg cursor-pointer transition-all duration-200",
            isDragging 
              ? "border-primary bg-primary/5" 
              : "border-border hover:border-primary/50 hover:bg-secondary/50",
            isUploading && "pointer-events-none opacity-60"
          )}
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleInputChange}
            className="hidden"
            disabled={isUploading}
          />
          {isUploading ? (
            <>
              <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
              <span className="text-sm text-muted-foreground text-center">
                Uploading...
              </span>
            </>
          ) : (
            <>
              <ImagePlus className="w-6 h-6 text-muted-foreground" />
              <span className="text-sm text-muted-foreground text-center">
                Click or drag to add photos ({value.length}/{maxImages})
              </span>
            </>
          )}
        </div>
      )}
    </div>
  );
}

interface ImageThumbnailProps {
  path: string;
  bucket: string;
  onRemove: () => void;
}

function ImageThumbnail({ path, bucket, onRemove }: ImageThumbnailProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useState(() => {
    // Generate signed URL for display
    const loadImage = async () => {
      // If it's already a full URL (signed or public), use it directly
      if (path.startsWith('http') || path.startsWith('blob:')) {
        setImageUrl(path);
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase.storage
          .from(bucket)
          .createSignedUrl(path, 3600); // 1 hour

        if (error) {
          console.error('Error getting signed URL:', error);
          setLoading(false);
          return;
        }

        setImageUrl(data.signedUrl);
      } catch (error) {
        console.error('Error loading image:', error);
      } finally {
        setLoading(false);
      }
    };

    loadImage();
  });

  return (
    <div className="relative group aspect-square">
      {loading ? (
        <div className="w-full h-full bg-muted rounded-lg flex items-center justify-center">
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        </div>
      ) : imageUrl ? (
        <img 
          src={imageUrl} 
          alt="Uploaded project image preview" 
          className="w-full h-full object-cover rounded-lg border border-border"
        />
      ) : (
        <div className="w-full h-full bg-muted rounded-lg flex items-center justify-center">
          <span className="text-xs text-muted-foreground">Failed</span>
        </div>
      )}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        type="button"
        aria-label="Remove uploaded image"
        className="absolute top-1 right-1 p-1 bg-background/80 backdrop-blur-sm rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive hover:text-destructive-foreground"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}

// Display component for viewing multiple images
interface MultiImageDisplayProps {
  paths: string[];
  bucket?: string;
  className?: string;
}

export function MultiImageDisplay({ paths, bucket = 'scope-images', className }: MultiImageDisplayProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [signedUrls, setSignedUrls] = useState<Record<number, string>>({});

  const loadSignedUrl = async (path: string, index: number) => {
    if (signedUrls[index]) return signedUrls[index];
    
    if (path.startsWith('http') || path.startsWith('blob:')) {
      setSignedUrls(prev => ({ ...prev, [index]: path }));
      return path;
    }

    try {
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(path, 3600);

      if (!error && data) {
        setSignedUrls(prev => ({ ...prev, [index]: data.signedUrl }));
        return data.signedUrl;
      }
    } catch (error) {
      console.error('Error loading image:', error);
    }
    return null;
  };

  if (!paths || paths.length === 0) return null;

  return (
    <>
      <div className={cn("flex gap-2 flex-wrap", className)}>
        {paths.map((path, index) => (
          <ImageDisplayThumbnail
            key={index}
            path={path}
            bucket={bucket}
            onClick={() => {
              loadSignedUrl(path, index);
              setExpandedIndex(index);
            }}
          />
        ))}
      </div>

      {expandedIndex !== null && (
        <div 
          className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setExpandedIndex(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] animate-scale-in">
            <ExpandedImage 
              path={paths[expandedIndex]} 
              bucket={bucket}
              signedUrl={signedUrls[expandedIndex]}
            />
            <button
              onClick={() => setExpandedIndex(null)}
              type="button"
              aria-label="Close enlarged image preview"
              className="absolute top-2 right-2 p-2 bg-background/80 backdrop-blur-sm rounded-full shadow-md hover:bg-destructive hover:text-destructive-foreground transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            {/* Navigation arrows */}
            {paths.length > 1 && (
              <>
                {expandedIndex > 0 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      loadSignedUrl(paths[expandedIndex - 1], expandedIndex - 1);
                      setExpandedIndex(expandedIndex - 1);
                    }}
                    type="button"
                    aria-label="View previous image"
                    className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-background/80 backdrop-blur-sm rounded-full shadow-md hover:bg-secondary transition-colors"
                  >
                    ←
                  </button>
                )}
                {expandedIndex < paths.length - 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      loadSignedUrl(paths[expandedIndex + 1], expandedIndex + 1);
                      setExpandedIndex(expandedIndex + 1);
                    }}
                    type="button"
                    aria-label="View next image"
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-background/80 backdrop-blur-sm rounded-full shadow-md hover:bg-secondary transition-colors"
                  >
                    →
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function ImageDisplayThumbnail({ path, bucket, onClick }: { path: string; bucket: string; onClick: () => void }) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useState(() => {
    const loadImage = async () => {
      if (path.startsWith('http') || path.startsWith('blob:')) {
        setImageUrl(path);
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase.storage
          .from(bucket)
          .createSignedUrl(path, 3600);

        if (!error && data) {
          setImageUrl(data.signedUrl);
        }
      } catch (error) {
        console.error('Error loading thumbnail:', error);
      } finally {
        setLoading(false);
      }
    };

    loadImage();
  });

  return (
    <div 
      className="relative cursor-pointer overflow-hidden rounded-lg border border-border transition-all hover:border-primary/50 w-16 h-16"
      onClick={onClick}
    >
      {loading ? (
        <div className="w-full h-full bg-muted flex items-center justify-center">
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        </div>
      ) : imageUrl ? (
        <img 
          src={imageUrl} 
          alt="Project image thumbnail"
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full bg-muted flex items-center justify-center">
          <span className="text-xs text-muted-foreground">!</span>
        </div>
      )}
    </div>
  );
}

function ExpandedImage({ path, bucket, signedUrl }: { path: string; bucket: string; signedUrl?: string }) {
  const [imageUrl, setImageUrl] = useState<string | null>(signedUrl || null);
  const [loading, setLoading] = useState(!signedUrl);

  useState(() => {
    if (signedUrl) return;

    const loadImage = async () => {
      if (path.startsWith('http') || path.startsWith('blob:')) {
        setImageUrl(path);
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase.storage
          .from(bucket)
          .createSignedUrl(path, 3600);

        if (!error && data) {
          setImageUrl(data.signedUrl);
        }
      } catch (error) {
        console.error('Error loading image:', error);
      } finally {
        setLoading(false);
      }
    };

    loadImage();
  });

  if (loading) {
    return (
      <div className="w-96 h-96 bg-muted rounded-lg flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!imageUrl) {
    return (
      <div className="w-96 h-96 bg-muted rounded-lg flex items-center justify-center">
        <span className="text-muted-foreground">Failed to load image</span>
      </div>
    );
  }

  return (
      <img 
      src={imageUrl} 
        alt="Enlarged project image"
      className="max-w-full max-h-[90vh] rounded-lg shadow-2xl object-contain"
    />
  );
}
