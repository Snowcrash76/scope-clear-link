import { useState } from 'react';
import { ScopeItem } from '@/types/project';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronUp, Package, Ban, AlertTriangle, TrendingUp } from 'lucide-react';
import { cn, cleanVariationTitle, isVariationItem, stripVariationMeta } from '@/lib/utils';
import { RichTextContent } from '@/components/RichTextEditor';
import { MultiImageDisplay } from '@/components/MultiImageUpload';
import { ImageDisplay } from '@/components/ImageUpload';

interface ApprovedChange {
  id: string;
  title: string;
  costImpact: number;
}

interface ScopeSectionProps {
  title: string;
  description: string;
  category: 'included' | 'excluded' | 'assumption';
  items: ScopeItem[];
  approvedChanges?: ApprovedChange[];
  isVariationSection?: boolean;
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
    color: 'text-muted-foreground',
    bgColor: 'bg-muted/30',
    borderColor: 'border-border',
    badge: 'excluded' as const,
  },
  assumption: {
    icon: AlertTriangle,
    color: 'text-muted-foreground',
    bgColor: 'bg-muted/30',
    borderColor: 'border-border',
    badge: 'assumption' as const,
  },
};

export function ScopeSection({ 
  title, 
  description, 
  category, 
  items, 
  approvedChanges = [],
  isVariationSection = false,
}: ScopeSectionProps) {
  const [isExpanded, setIsExpanded] = useState(category === 'included');
  const config = categoryConfig[category];
  const Icon = isVariationSection ? TrendingUp : config.icon;
  
  const subtotal = items.reduce((sum, item) => sum + (item.cost || 0), 0);

  const isSubtle = category !== 'included';

  const borderClass = isVariationSection
    ? 'border-2 border-approved/30'
    : isSubtle ? 'border' : 'border-2';

  return (
    <Card className={cn(
      "overflow-hidden transition-all duration-200",
      borderClass,
      !isVariationSection && !isSubtle && config.borderColor,
      isExpanded && !isSubtle && config.bgColor
    )}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          "w-full min-w-0 p-4 sm:p-5 flex items-center justify-between gap-3 transition-colors",
          isSubtle ? "hover:bg-muted/50" : "hover:bg-secondary/50"
        )}
      >
          <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className={cn(
            "rounded-lg",
            isSubtle ? "p-1.5" : "p-2",
            isVariationSection ? "bg-approved/10" : isSubtle ? "bg-muted" : config.bgColor
          )}>
            <Icon className={cn(
              isSubtle ? "w-4 h-4" : "w-5 h-5",
              config.color
            )} />
          </div>
          <div className="min-w-0 text-left">
            <h3 className={cn(
              "break-words [overflow-wrap:anywhere] font-heading font-semibold",
              isSubtle ? "text-base text-muted-foreground" : "text-lg"
            )}>{title}</h3>
            {!isSubtle && (
              <p className="text-sm text-muted-foreground">{description}</p>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {isSubtle && !isExpanded && (
            <Badge variant="secondary" className="text-xs">
              {items.length} item{items.length !== 1 ? 's' : ''}
            </Badge>
          )}
          {isExpanded ? (
            <ChevronUp className={cn("text-muted-foreground", isSubtle ? "w-4 h-4" : "w-5 h-5")} />
          ) : (
            <ChevronDown className={cn("text-muted-foreground", isSubtle ? "w-4 h-4" : "w-5 h-5")} />
          )}
        </div>
      </button>

      {isExpanded && (
        <div className="px-4 sm:px-5 pb-4 sm:pb-5 space-y-3 animate-fade-in">
          {items.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">No items in this section.</p>
          )}

          {items.map((item) => (
            <div
              key={item.id}
              className="p-4 rounded-lg bg-card border border-border"
            >
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="break-words [overflow-wrap:anywhere] font-medium text-foreground">{cleanVariationTitle(item.title)}</h4>
                      {isVariationItem(item.title) && !isVariationSection && (
                        <Badge variant="secondary" className="text-xs" data-testid={`badge-variation-scope-${item.id}`}>
                          Variation
                        </Badge>
                      )}
                    </div>
                    {item.cost !== undefined && item.cost > 0 && (
                      <span className={cn(
                        "text-sm font-medium whitespace-nowrap",
                        isVariationSection ? "text-approved" : "text-primary"
                      )}>
                        {isVariationSection ? '+' : ''}${item.cost.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    )}
                  </div>
                  {stripVariationMeta(item.description) && (
                    <RichTextContent
                      html={stripVariationMeta(item.description)}
                      className="mt-1"
                    />
                  )}
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
          
          {subtotal > 0 && (
            <div className="pt-3 mt-3 border-t border-dashed flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">
                {isVariationSection ? 'Variations Total' : category === 'included' ? 'Subtotal' : 'Category Total'}
              </span>
              <span className={cn(
                "font-semibold",
                isVariationSection ? "text-approved" : "text-primary"
              )}>
                {isVariationSection ? '+' : ''}${subtotal.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
