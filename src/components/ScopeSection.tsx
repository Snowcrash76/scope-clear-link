import { useState } from 'react';
import { ScopeItem } from '@/types/project';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Circle, ChevronDown, ChevronUp, Package, Ban, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MultiImageDisplay } from '@/components/MultiImageUpload';
import { ImageDisplay } from '@/components/ImageUpload';

interface ScopeSectionProps {
  title: string;
  description: string;
  category: 'included' | 'excluded' | 'assumption';
  items: ScopeItem[];
  onAcknowledge: (itemId: string) => void;
  isClientView?: boolean;
}

const categoryConfig = {
  included: {
    icon: Package,
    color: 'text-approved',
    bgColor: 'bg-approved/5',
    borderColor: 'border-approved/20',
    badge: 'included' as const,
  },
  excluded: {
    icon: Ban,
    color: 'text-destructive',
    bgColor: 'bg-destructive/5',
    borderColor: 'border-destructive/20',
    badge: 'excluded' as const,
  },
  assumption: {
    icon: AlertTriangle,
    color: 'text-pending-foreground',
    bgColor: 'bg-pending/5',
    borderColor: 'border-pending/20',
    badge: 'assumption' as const,
  },
};

export function ScopeSection({ 
  title, 
  description, 
  category, 
  items, 
  onAcknowledge,
  isClientView = true 
}: ScopeSectionProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const config = categoryConfig[category];
  const Icon = config.icon;
  
  const acknowledgedCount = items.filter(item => item.acknowledged).length;
  const allAcknowledged = acknowledgedCount === items.length;
  
  // Calculate subtotal for items with costs
  const subtotal = items.reduce((sum, item) => sum + (item.cost || 0), 0);

  return (
    <Card className={cn(
      "overflow-hidden border-2 transition-all duration-200",
      config.borderColor,
      isExpanded && config.bgColor
    )}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 sm:p-5 flex items-center justify-between hover:bg-secondary/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={cn("p-2 rounded-lg", config.bgColor)}>
            <Icon className={cn("w-5 h-5", config.color)} />
          </div>
          <div className="text-left">
            <h3 className="font-heading font-semibold text-lg">{title}</h3>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {isClientView && (
            <Badge variant={allAcknowledged ? 'success' : 'secondary'} className="hidden sm:flex">
              {acknowledgedCount}/{items.length} acknowledged
            </Badge>
          )}
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-5 h-5 text-muted-foreground" />
          )}
        </div>
      </button>

      {isExpanded && (
        <div className="px-4 sm:px-5 pb-4 sm:pb-5 space-y-3 animate-fade-in">
          {items.map((item) => (
            <div
              key={item.id}
              className={cn(
                "p-4 rounded-lg bg-card border transition-all duration-200",
                item.acknowledged ? "border-approved/30" : "border-border"
              )}
            >
              <div className="flex items-start gap-3">
                {isClientView ? (
                  <button
                    onClick={() => onAcknowledge(item.id)}
                    className={cn(
                      "mt-0.5 flex-shrink-0 transition-colors",
                      item.acknowledged ? "text-approved" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {item.acknowledged ? (
                      <CheckCircle2 className="w-5 h-5" />
                    ) : (
                      <Circle className="w-5 h-5" />
                    )}
                  </button>
                ) : (
                  <div className={cn(
                    "mt-0.5 flex-shrink-0",
                    item.acknowledged ? "text-approved" : "text-muted-foreground"
                  )}>
                    {item.acknowledged ? (
                      <CheckCircle2 className="w-5 h-5" />
                    ) : (
                      <Circle className="w-5 h-5" />
                    )}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-medium text-foreground">{item.title}</h4>
                    {item.cost !== undefined && item.cost > 0 && (
                      <span className="text-sm font-medium text-primary whitespace-nowrap">
                        ${item.cost.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                    {item.description}
                  </p>
                  {/* Show multiple images if available, otherwise fall back to single image */}
                  {item.imageUrls && item.imageUrls.length > 0 ? (
                    <div className="mt-3">
                      <MultiImageDisplay paths={item.imageUrls} />
                    </div>
                  ) : item.imageUrl ? (
                    <div className="mt-3">
                      <ImageDisplay src={item.imageUrl} alt={item.title} className="max-w-xs" />
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
          
          {/* Category Subtotal */}
          {subtotal > 0 && (
            <div className="pt-3 mt-3 border-t border-dashed flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">
                {category === 'included' ? 'Subtotal' : 'Category Total'}
              </span>
              <span className="font-semibold text-primary">
                ${subtotal.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}