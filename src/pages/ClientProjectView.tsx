import { useParams } from 'react-router-dom';
import { ProjectHeader } from '@/components/ProjectHeader';
import { ActionRequired } from '@/components/ActionRequired';
import { ScopeSection } from '@/components/ScopeSection';
import { ChangeRequestCard } from '@/components/ChangeRequestCard';
import { ProjectTimeline } from '@/components/ProjectTimeline';
import { RequestChangeButton } from '@/components/RequestChangeButton';
import { ClientDocumentsSection } from '@/components/ClientDocumentsSection';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { useProject } from '@/hooks/useProject';
import { toast } from 'sonner';
import { Package, RefreshCw, TrendingUp, FileText, Loader2 } from 'lucide-react';

export default function ClientProjectView() {
  const { id } = useParams();
  const {
    project,
    documents,
    loading,
    acknowledgeScopeItem,
    createChangeRequest,
    updateChangeRequestStatus,
  } = useProject(id);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Project Not Found</h1>
          <p className="text-muted-foreground">This project link may be invalid or has been removed.</p>
        </div>
      </div>
    );
  }

  const includedItems = project.scopeItems.filter(item => item.category === 'included');
  const excludedItems = project.scopeItems.filter(item => item.category === 'excluded');
  const assumptionItems = project.scopeItems.filter(item => item.category === 'assumption');
  
  const pendingChanges = project.changeRequests.filter(req => req.status === 'pending');
  const unacknowledgedItems = project.scopeItems.filter(item => !item.acknowledged);

  const handleAcknowledge = async (itemId: string) => {
    const item = project.scopeItems.find(i => i.id === itemId);
    if (item) {
      const success = await acknowledgeScopeItem(itemId, !item.acknowledged);
      if (success) {
        toast.success(item.acknowledged ? 'Acknowledgement removed' : 'Item acknowledged');
      }
    }
  };

  const handleApproveChange = async (changeId: string) => {
    const success = await updateChangeRequestStatus(changeId, 'approved');
    if (success) {
      toast.success('Change approved! Your trade has been notified.');
    }
  };

  const handleDeclineChange = async (changeId: string) => {
    const success = await updateChangeRequestStatus(changeId, 'declined');
    if (success) {
      toast.info('Change declined. Your trade has been notified.');
    }
  };

  const handleRequestChange = async (description: string, imageUrl?: string) => {
    const success = await createChangeRequest({
      type: 'client_request',
      title: 'New change request',
      description,
      costImpact: 0,
      timeImpact: 0,
      imageUrl,
    });
    
    if (success) {
      toast.success('Change request sent! Your trade will review and respond.');
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <ProjectHeader project={project} />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {/* Action Required Banner */}
        <ActionRequired 
          pendingChanges={pendingChanges}
          unacknowledgedItems={unacknowledgedItems}
        />

        {/* Main Content Tabs */}
        <Tabs defaultValue="scope" className="space-y-6">
          <TabsList className="w-full sm:w-auto grid grid-cols-4 sm:inline-flex">
            <TabsTrigger value="scope" className="gap-2">
              <Package className="w-4 h-4 hidden sm:block" />
              Scope
            </TabsTrigger>
            <TabsTrigger value="changes" className="gap-2">
              <RefreshCw className="w-4 h-4 hidden sm:block" />
              Changes
              {pendingChanges.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-pending text-pending-foreground">
                  {pendingChanges.length}
                </span>
              )}
            </TabsTrigger>
            {documents.length > 0 && (
              <TabsTrigger value="documents" className="gap-2">
                <FileText className="w-4 h-4 hidden sm:block" />
                Docs
              </TabsTrigger>
            )}
            <TabsTrigger value="progress" className="gap-2">
              <TrendingUp className="w-4 h-4 hidden sm:block" />
              Progress
            </TabsTrigger>
          </TabsList>

          {/* Scope Tab */}
          <TabsContent value="scope" className="space-y-4 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h2 className="font-heading text-xl font-bold">Project Scope</h2>
                <p className="text-sm text-muted-foreground">
                  Please review and acknowledge each section below
                </p>
              </div>
            </div>

            <ScopeSection
              title="What's Included"
              description="Work and materials covered in your quote"
              category="included"
              items={includedItems}
              onAcknowledge={handleAcknowledge}
            />

            <ScopeSection
              title="What's Not Included"
              description="Items outside the scope of this project"
              category="excluded"
              items={excludedItems}
              onAcknowledge={handleAcknowledge}
            />

            <ScopeSection
              title="Our Assumptions"
              description="Conditions we're expecting — if different, we'll discuss"
              category="assumption"
              items={assumptionItems}
              onAcknowledge={handleAcknowledge}
            />
          </TabsContent>

          {/* Changes Tab */}
          <TabsContent value="changes" className="space-y-4 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h2 className="font-heading text-xl font-bold">Changes & Variations</h2>
                <p className="text-sm text-muted-foreground">
                  Track all modifications to the original scope
                </p>
              </div>
              <RequestChangeButton onSubmit={handleRequestChange} />
            </div>

            {project.changeRequests.length === 0 ? (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground">No changes requested yet.</p>
              </Card>
            ) : (
              <div className="space-y-4">
                {project.changeRequests.map(request => (
                  <ChangeRequestCard
                    key={request.id}
                    request={request}
                    viewerRole="client"
                    onApprove={handleApproveChange}
                    onDecline={handleDeclineChange}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {/* Documents Tab */}
          {documents.length > 0 && (
            <TabsContent value="documents" className="space-y-4 animate-fade-in">
              <ClientDocumentsSection documents={documents} />
            </TabsContent>
          )}

          {/* Progress Tab */}
          <TabsContent value="progress" className="space-y-4 animate-fade-in">
            <div>
              <h2 className="font-heading text-xl font-bold">Project Progress</h2>
              <p className="text-sm text-muted-foreground">
                See where your project is at and what's coming next
              </p>
            </div>

            <Card className="p-4 sm:p-6">
              <ProjectTimeline 
                stages={project.stages} 
                currentStageIndex={project.currentStageIndex}
              />
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* Footer */}
      <footer className="border-t mt-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 text-center text-sm text-muted-foreground">
          <p>This project page is provided by {project.tradeBusinessName}</p>
          <p className="mt-1">Questions? Contact {project.tradeName} directly.</p>
        </div>
      </footer>
    </div>
  );
}
