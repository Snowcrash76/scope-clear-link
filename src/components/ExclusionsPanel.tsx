import { useState } from 'react';
import { Ban, AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScopeItem } from '@/types/project';
import { stripVariationMeta } from '@/lib/utils';
import { htmlToText } from '@/components/RichTextEditor';

interface ExclusionsPanelProps {
  excludedItems: Pick<ScopeItem, 'id' | 'title' | 'description'>[];
  assumptionItems: Pick<ScopeItem, 'id' | 'title' | 'description'>[];
  defaultOpen?: boolean;
}

export function ExclusionsPanel({ excludedItems, assumptionItems, defaultOpen = false }: ExclusionsPanelProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const totalCount = excludedItems.length + assumptionItems.length;

  if (totalCount === 0) return null;

  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setIsOpen(v => !v)}
        className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-muted/40 transition-colors"
        data-testid="button-toggle-exclusions"
      >
        <div className="flex items-center gap-2">
          <Ban className="w-4 h-4 text-muted-foreground" />
          <span className="font-medium text-sm">Exclusions & Assumptions</span>
          <Badge variant="secondary" className="text-xs">
            {totalCount}
          </Badge>
        </div>
        {isOpen ? (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        )}
      </button>

      {isOpen && (
        <div className="border-t divide-y">
          {excludedItems.length > 0 && (
            <>
              <div className="px-4 py-2 bg-muted/30 flex items-center gap-1.5">
                <Ban className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Not Included
                </span>
              </div>
              {excludedItems.map(item => (
                <div key={item.id} className="px-4 py-3">
                  <p className="text-sm font-medium">{item.title}</p>
                  {item.description && stripVariationMeta(item.description) && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {htmlToText(stripVariationMeta(item.description))}
                    </p>
                  )}
                </div>
              ))}
            </>
          )}
          {assumptionItems.length > 0 && (
            <>
              <div className="px-4 py-2 bg-muted/30 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Assumptions
                </span>
              </div>
              {assumptionItems.map(item => (
                <div key={item.id} className="px-4 py-3">
                  <p className="text-sm font-medium">{item.title}</p>
                  {item.description && stripVariationMeta(item.description) && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {htmlToText(stripVariationMeta(item.description))}
                    </p>
                  )}
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
