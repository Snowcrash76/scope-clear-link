import { ChangeRequestCard } from '@/components/ChangeRequestCard';
import { ImageDisplay } from '@/components/ImageUpload';
import { RespondToClientModal } from '@/components/RespondToClientModal';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { ChangeRequest, Project, Quote, QuoteLineItem } from '@/types/project';
import { variationItemTitle } from '@/lib/variationItems';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  DollarSign,
  Package,
  Pencil,
  Plus,
  User,
} from 'lucide-react';

type ResponseData = {
  title: string;
  description: string;
  costImpact: number;
  timeImpact: number;
  reason?: string;
  imageUrl?: string;
};

type ProjectVariationsTabContentProps = {
  project: Project;
  activeQuote: Quote | null;
  quoteLineItems: QuoteLineItem[];
  recentlyResolvedChanges: ChangeRequest[];
  respondingToRequest: ChangeRequest | null;
  onAddVariation: () => void;
  onCloseResponse: () => void;
  onSubmitResponse: (data: ResponseData) => Promise<void>;
  onRespondToClient: (requestId: string) => void;
  onEditChangeRequest: (request: ChangeRequest) => void;
};

export function ProjectVariationsTabContent({
  project,
  activeQuote,
  quoteLineItems,
  recentlyResolvedChanges,
  respondingToRequest,
  onAddVariation,
  onCloseResponse,
  onSubmitResponse,
  onRespondToClient,
  onEditChangeRequest,
}: ProjectVariationsTabContentProps) {
  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="font-heading text-lg font-semibold">Variations</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Record work outside the agreed quote, track client approval and keep every change tied to this job.</p>
        </div>
        <Button className="min-h-11 w-full sm:w-auto" onClick={onAddVariation}>
          <Plus className="mr-2 h-4 w-4" />
          + Add Variation
        </Button>
      </div>

      {activeQuote?.clientComment && (
        <Card className="border-dashed bg-secondary/40 p-4">
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Client's comment on the quote</p>
          <p className="text-sm">{activeQuote.clientComment}</p>
        </Card>
      )}

      {project.changeRequests.length === 0 ? (
        <Card className="p-10 text-center">
          <AlertTriangle className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
          <p className="mb-4 text-muted-foreground">No variations yet</p>
          <Button className="min-h-11" onClick={onAddVariation}>
            <Plus className="mr-2 h-4 w-4" />
            Add first variation
          </Button>
        </Card>
      ) : (
        <div className="space-y-4">
          {recentlyResolvedChanges.some(change => change.status === 'approved') && (
            <div className="flex items-center gap-2 rounded-lg border border-approved/20 bg-approved/10 p-3">
              <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-approved" />
              <p className="text-sm font-medium text-approved">
                {recentlyResolvedChanges.filter(change => change.status === 'approved').length} variation{recentlyResolvedChanges.filter(change => change.status === 'approved').length === 1 ? '' : 's'} approved in the last 72 hours.
              </p>
            </div>
          )}
          {project.changeRequests.map(request => (
            <div
              key={request.id}
              id={`variation-${request.id}`}
              tabIndex={-1}
              className="scroll-mt-32 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-amber-700"
            >
              {request.status === 'pending' ? (
                <ChangeRequestCard
                  request={request}
                  relatedItemTitle={variationItemTitle(request, project.scopeItems, quoteLineItems)}
                  viewerRole="trade"
                  onRespond={onRespondToClient}
                />
              ) : (
                <ChangeRequestItem
                  relatedItemTitle={variationItemTitle(request, project.scopeItems, quoteLineItems)}
                  request={request}
                  onEdit={() => onEditChangeRequest(request)}
                  isNew={recentlyResolvedChanges.some(change => change.id === request.id)}
                />
              )}
            </div>
          ))}
        </div>
      )}

      <RespondToClientModal
        isOpen={!!respondingToRequest}
        onClose={onCloseResponse}
        request={respondingToRequest}
        onSubmit={onSubmitResponse}
      />
    </>
  );
}

function ChangeRequestItem({
  request,
  onEdit,
  isNew,
  relatedItemTitle,
}: {
  request: ChangeRequest;
  onEdit?: () => void;
  isNew?: boolean;
  relatedItemTitle?: string;
}) {
  const typeConfig = {
    client_request: { icon: User, label: 'Client Request', color: 'text-primary' },
    site_issue: { icon: AlertTriangle, label: 'Site Issue', color: 'text-warning' },
    substitution: { icon: Package, label: 'Substitution', color: 'text-muted-foreground' },
    addition: { icon: Package, label: 'Addition', color: 'text-primary' },
  };
  const config = typeConfig[request.type];
  const Icon = config.icon;
  const isApproved = request.status === 'approved';

  return (
    <Card className={cn(
      'group relative overflow-hidden p-4',
      request.status === 'pending' && 'ring-2 ring-pending/30',
      isApproved && 'border-approved/40 bg-approved/5',
    )}>
      {isApproved && <div className="absolute bottom-0 left-0 top-0 w-1 bg-approved" />}
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Icon className={cn('h-4 w-4', config.color)} />
          <Badge variant="secondary" className="text-xs">{config.label}</Badge>
        </div>
        <div className="flex items-center gap-2">
          {isNew && (
            <Badge variant="success" className="gap-1 text-xs">
              <CheckCircle2 className="h-3 w-3" />
              New
            </Badge>
          )}
          {onEdit && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit} aria-label={`Edit variation ${request.title}`}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          )}
          <StatusBadge status={request.status} />
        </div>
      </div>
      <div className="mb-1 flex items-center gap-2">
        {isApproved && <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-approved" />}
        <h4 className="font-medium">{request.title}</h4>
      </div>
      {relatedItemTitle && <p className="mb-2 text-sm text-muted-foreground">Related quote item: {relatedItemTitle}</p>}
      <p className="mb-3 text-sm text-muted-foreground">{request.description}</p>
      {request.imageUrl && (
        <div className="mb-3">
          <ImageDisplay src={request.imageUrl} alt={request.title} className="max-w-[200px]" />
        </div>
      )}
      {request.resolutionComment && request.status !== 'pending' && request.status !== 'awaiting_client' && (
        <div className="mb-3 rounded-lg border border-border/50 bg-secondary/60 p-3">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Client's comment</p>
          <p className="text-sm">{request.resolutionComment}</p>
        </div>
      )}
      <div className="flex flex-wrap gap-3 text-sm">
        <div className={cn(
          'flex items-center gap-1.5 rounded px-2 py-1',
          request.costImpact > 0 ? 'bg-warning/10 text-warning-foreground' :
            request.costImpact < 0 ? 'bg-approved/10 text-approved' :
              'bg-secondary text-muted-foreground',
        )}>
          <DollarSign className="h-3.5 w-3.5" />
          {request.costImpact === 0 ? 'No cost change' :
            request.costImpact > 0 ? `+$${request.costImpact.toLocaleString()}` :
              `-$${Math.abs(request.costImpact).toLocaleString()}`}
        </div>
        <div className={cn(
          'flex items-center gap-1.5 rounded px-2 py-1',
          request.timeImpact > 0 ? 'bg-warning/10 text-warning-foreground' :
            request.timeImpact < 0 ? 'bg-approved/10 text-approved' :
              'bg-secondary text-muted-foreground',
        )}>
          <Clock className="h-3.5 w-3.5" />
          {request.timeImpact === 0 ? 'No delay' :
            request.timeImpact > 0 ? `+${request.timeImpact} days` :
              `${request.timeImpact} days`}
        </div>
        <div className="flex items-center gap-1.5 rounded bg-secondary px-2 py-1 text-muted-foreground">
          <Calendar className="h-3.5 w-3.5" />
          {format(request.createdAt, 'MMM d, yyyy')}
        </div>
      </div>
    </Card>
  );
}
