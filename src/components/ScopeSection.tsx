import { useState } from 'react';
import { ScopeItem } from '@/types/project';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Circle, ChevronDown, ChevronUp, Package, Ban, AlertTriangle, Calculator } from 'lucide-react';
import { cn } from '@/lib/utils';
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
  onAcknowledge: (itemId: string) => void;
  onAcknowledgeAll?: () => void;
  isClientView?: boolean;
  showTotal?: boolean;
  totalAmount?: number;
  approvedChanges?: ApprovedChange[];
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
  onAcknowledge,
  onAcknowledgeAll,
  isClientView = true,
  showTotal = false,
  totalAmount = 0,
  approvedChanges = []
}: ScopeSectionProps) {
  const [isExpanded, setIsExpanded] = useState(category === 'included');
  const config = categoryConfig[category];
  const Icon = config.icon;
  
  const acknowledgedCount = items.filter(item => item.acknowledged).length;
  const allAcknowledged = acknowledgedCount === items.length;
  
  const subtotal = items.reduce((sum, item) => sum + (item.cost || 0), 0);

  const isSubtle = category !== 'included';

  return (
    <Card className={cn(
      "overflow-hidden transition-all duration-200",
      isSubtle ? "border" : "border-2",
      config.borderColor,
      isExpanded && !isSubtle && config.bgColor
    )}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          "w-full p-4 sm:p-5 flex items-center justify-between transition-colors",
          isSubtle ? "hover:bg-muted/50" : "hover:bg-secondary/50"
        )}
      >
        <div className="flex items-center gap-3">
          <div className={cn(
            "rounded-lg",
            isSubtle ? "p-1.5" : "p-2",
            isSubtle ? "bg-muted" : config.bgColor
          )}>
            <Icon className={cn(
              isSubtle ? "w-4 h-4" : "w-5 h-5",
              config.color
            )} />
          </div>
          <div className="text-left">
            <h3 className={cn(
              "font-heading font-semibold",
              isSubtle ? "text-base text-muted-foreground" : "text-lg"
            )}>{title}</h3>
            {!isSubtle && (
              <p className="text-sm text-muted-foreground">{description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {isSubtle && !isExpanded && (
            <Badge variant="secondary" className="text-xs">
              {items.length} item{items.length !== 1 ? 's' : ''}
            </Badge>
          )}
          {!isSubtle && isClientView && (
            <Badge variant={allAcknowledged ? 'success' : 'secondary'} className="hidden sm:flex">
              {acknowledgedCount}/{items.length} acknowledged
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
          {!isSubtle && isClientView && (
            <p className="text-sm text-muted-foreground -mt-1 mb-2">{description}</p>
          )}
          {isSubtle && (
            <p className="text-sm text-muted-foreground -mt-1 mb-2">{description}</p>
          )}

          {/* Acknowledge All button — shown when client view and there are unacknowledged items */}
          {isClientView && onAcknowledgeAll && !allAcknowledged && items.length > 1 && (
            <div className="flex justify-end -mt-1 mb-1">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs h-8"
                onClick={(e) => {
                  e.stopPropagation();
                  onAcknowledgeAll();
                }}
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-approved" />
                Acknowledge All
              </Button>
            </div>
          )}

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
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-medium text-foreground">{item.title}</h4>
                      {item.title.startsWith('Variation: ') && (
                        <Badge variant="secondary" className="text-xs" data-testid={`badge-variation-scope-${item.id}`}>
                          Variation
                        </Badge>
                      )}
                    </div>
                    {item.cost !== undefined && item.cost > 0 && (
                      <span className="text-sm font-medium text-primary whitespace-nowrap">
                        ${item.cost.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                    {item.description}
                  </p>
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
          
          {subtotal > 0 && !showTotal && (
            <div className="pt-3 mt-3 border-t border-dashed flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">
                {category === 'included' ? 'Subtotal' : 'Category Total'}
              </span>
              <span className="font-semibold text-primary">
                ${subtotal.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          )}

          {showTotal && (
            <div className="pt-4 mt-4 border-t-2 border-primary/20 space-y-3">
              <h4 className="text-sm font-bold text-foreground uppercase tracking-wide mb-3">Contract Summary</h4>
              
              <div className="flex items-center justify-between text-sm">
                <span className="text-foreground font-medium">Original Contract</span>
                <span className="font-semibold tabular-nums text-right">
                  ${subtotal.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              {approvedChanges.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-foreground font-medium">
                      Approved Variations ({approvedChanges.length})
                    </span>
                    <span className={cn(
                      "font-semibold tabular-nums text-right",
                      approvedChanges.reduce((sum, c) => sum + c.costImpact, 0) >= 0 ? "text-approved" : "text-destructive"
                    )}>
                      {approvedChanges.reduce((sum, c) => sum + c.costImpact, 0) >= 0 ? '+' : ''}
                      ${Math.abs(approvedChanges.reduce((sum, c) => sum + c.costImpact, 0)).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  
                  <div className="pl-4 border-l-2 border-muted space-y-1.5">
                    {approvedChanges.map((change) => (
                      <div key={change.id} className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground truncate mr-3 flex-1">{change.title}</span>
                        <span className={cn(
                          "font-medium tabular-nums text-right whitespace-nowrap",
                          change.costImpact >= 0 ? "text-approved" : "text-destructive"
                        )}>
                          {change.costImpact >= 0 ? '+' : ''}${Math.abs(change.costImpact).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between p-4 rounded-lg bg-primary/5 mt-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Calculator className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <span className="font-heading font-semibold">
                      {approvedChanges.length > 0 ? 'Revised Contract Total' : 'Contract Total'}
                    </span>
                    <p className="text-xs text-muted-foreground">
                      {approvedChanges.length > 0 ? 'Original + approved changes' : 'Sum of all included items'}
                    </p>
                  </div>
                </div>
                <span className="text-xl sm:text-2xl font-bold text-primary tabular-nums">
                  ${totalAmount.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
