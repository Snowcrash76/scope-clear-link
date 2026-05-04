import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { ImageUpload } from '@/components/ImageUpload';
import { MessageSquarePlus, X, Send } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RequestChangeButtonProps {
  onSubmit: (description: string, imageUrl?: string) => void;
}

export function RequestChangeButton({ onSubmit }: RequestChangeButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState<string | undefined>();

  const handleSubmit = () => {
    if (description.trim()) {
      onSubmit(description, imageUrl);
      setDescription('');
      setImageUrl(undefined);
      setIsOpen(false);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setDescription('');
    setImageUrl(undefined);
  };

  if (isOpen) {
    return (
      <Card className="p-4 border-2 border-primary/20 animate-scale-in">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-heading font-semibold">Request a Variation</h3>
          <button 
            onClick={handleClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-sm text-muted-foreground mb-3">
          What would you like to vary or add? Your trade will review and respond with any cost or time impacts.
        </p>
        <Textarea
          placeholder="Describe the variation you'd like..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="mb-3 min-h-[100px]"
        />
        <div className="mb-3">
          <p className="text-sm text-muted-foreground mb-2">Add a photo (optional)</p>
          <ImageUpload value={imageUrl} onChange={setImageUrl} />
        </div>
        <div className="flex gap-2 justify-end">
          <Button variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
          <Button 
            variant="accent" 
            onClick={handleSubmit}
            disabled={!description.trim()}
          >
            <Send className="w-4 h-4" />
            Send Request
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Button 
      variant="outline" 
      onClick={() => setIsOpen(true)}
      className="w-full sm:w-auto"
    >
      <MessageSquarePlus className="w-4 h-4" />
      Request a Variation
    </Button>
  );
}
