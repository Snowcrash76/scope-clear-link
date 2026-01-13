import { useState } from 'react';
import { mockProject } from '@/data/mockProject';
import { ProjectHeader } from '@/components/ProjectHeader';
import { ActionRequired } from '@/components/ActionRequired';
import { ScopeSection } from '@/components/ScopeSection';
import { ChangeRequestCard } from '@/components/ChangeRequestCard';
import { ProjectTimeline } from '@/components/ProjectTimeline';
import { RequestChangeButton } from '@/components/RequestChangeButton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { Package, RefreshCw, TrendingUp } from 'lucide-react';

export default function ClientProjectView() {
  const [project, setProject] = useState(mockProject);

  const includedItems = project.scopeItems.filter(item => item.category === 'included');
  const excludedItems = project.scopeItems.filter(item => item.category === 'excluded');
  const assumptionItems = project.scopeItems.filter(item => item.category === 'assumption');
  
  const pendingChanges = project.changeRequests.filter(req => req.status === 'pending');
  const unacknowledgedItems = project.scopeItems.filter(item => !item.acknowledged);

  const handleAcknowledge = (itemId: string) => {
    setProject(prev => ({
      ...prev,
      scopeItems: prev.scopeItems.map(item =>
        item.id === itemId ? { ...item, acknowledged: !item.acknowledged } : item
      ),
    }));
    toast.success('Item acknowledged');
  };

  const handleApproveChange = (changeId: string) => {
    setProject(prev => ({
      ...prev,
      changeRequests: prev.changeRequests.map(req =>
        req.id === changeId 
          ? { ...req, status: 'approved' as const, resolvedAt: new Date() } 
          : req
      ),
    }));
    toast.success('Change approved! Your trade has been notified.');
  };

  const handleDeclineChange = (changeId: string) => {
    setProject(prev => ({
      ...prev,
      changeRequests: prev.changeRequests.map(req =>
        req.id === changeId 
          ? { ...req, status: 'declined' as const, resolvedAt: new Date() } 
          : req
      ),
    }));
    toast.info('Change declined. Your trade has been notified.');
  };

  const handleRequestChange = (description: string, imageUrl?: string) => {
    const newRequest = {
      id: `change_${Date.now()}`,
      type: 'client_request' as const,
      title: 'New change request',
      description,
      costImpact: 0,
      timeImpact: 0,
      status: 'pending' as const,
      createdAt: new Date(),
      imageUrl,
    };
    
    setProject(prev => ({
      ...prev,
      changeRequests: [...prev.changeRequests, newRequest],
    }));
    toast.success('Change request sent! Your trade will review and respond.');
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
          <TabsList className="w-full sm:w-auto grid grid-cols-3 sm:inline-flex">
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
                    onApprove={handleApproveChange}
                    onDecline={handleDeclineChange}
                  />
                ))}
              </div>
            )}
          </TabsContent>

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
