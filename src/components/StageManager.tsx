import { useState } from 'react';
import { ProjectStage, Invoice, Quote } from '@/types/project';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  CheckCircle2, 
  Circle, 
  Play, 
  RotateCcw, 
  Plus, 
  Pencil, 
  Trash2,
  ChevronUp,
  ChevronDown,
  Receipt,
  DollarSign
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { EditStageModal } from './EditStageModal';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface StageManagerProps {
  stages: ProjectStage[];
  currentStageIndex: number;
  invoices?: Invoice[];
  quote?: Quote | null;
  onUpdateStage: (stageId: string, status: 'upcoming' | 'current' | 'completed') => void;
  onSetCurrentStage: (index: number) => void;
  onAddStage?: (data: { name: string; description: string; invoiceAmount?: number; invoicePercentage?: number }) => Promise<boolean>;
  onEditStage?: (stageId: string, data: { name: string; description: string; invoiceAmount?: number; invoicePercentage?: number }) => Promise<boolean>;
  onDeleteStage?: (stageId: string) => Promise<boolean>;
  onReorderStages?: (stageIds: string[]) => Promise<boolean>;
  onClearAllStages?: () => Promise<boolean>;
  onGenerateStageInvoice?: (stage: ProjectStage, amount: number) => void;
}

export function StageManager({ 
  stages, 
  currentStageIndex,
  invoices = [],
  quote,
  onUpdateStage,
  onSetCurrentStage,
  onAddStage,
  onEditStage,
  onDeleteStage,
  onReorderStages,
  onClearAllStages,
  onGenerateStageInvoice,
}: StageManagerProps) {
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingStage, setEditingStage] = useState<ProjectStage | undefined>();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [stageToDelete, setStageToDelete] = useState<string | null>(null);
  const [clearAllDialogOpen, setClearAllDialogOpen] = useState(false);

  // Each handler makes exactly ONE call — either onSetCurrentStage (which sets
  // ALL stage statuses correctly in a single sequential pass) or onUpdateStage
  // for the edge case where there is no adjacent stage to advance/retreat to.
  const handleMarkComplete = (stageIndex: number) => {
    if (stageIndex + 1 < stages.length) {
      // Advance to next stage; onSetCurrentStage marks everything correctly.
      onSetCurrentStage(stageIndex + 1);
    } else {
      // Last stage — just mark it complete, nothing to advance to.
      onUpdateStage(stages[stageIndex].id, 'completed');
    }
  };

  const handleStartStage = (stageIndex: number) => {
    // onSetCurrentStage sets all previous stages to completed and this one current.
    onSetCurrentStage(stageIndex);
  };

  const handleRevertStage = (stageIndex: number) => {
    if (stageIndex > 0) {
      // Go back to previous stage; onSetCurrentStage handles all statuses.
      onSetCurrentStage(stageIndex - 1);
    } else {
      // First stage — just mark it upcoming; nothing to revert to.
      onUpdateStage(stages[0].id, 'upcoming');
    }
  };

  const handleAddStage = () => {
    setEditingStage(undefined);
    setEditModalOpen(true);
  };

  const handleEditStage = (stage: ProjectStage) => {
    setEditingStage(stage);
    setEditModalOpen(true);
  };

  const handleSaveStage = async (data: { name: string; description: string; invoiceAmount?: number; invoicePercentage?: number }) => {
    if (editingStage && onEditStage) {
      await onEditStage(editingStage.id, data);
    } else if (onAddStage) {
      await onAddStage(data);
    }
  };

  // Helper to get invoice for a stage
  const getStageInvoice = (stageId: string) => {
    return invoices.find(inv => inv.stageId === stageId);
  };

  // Helper to calculate stage billing amount (always returns ex-tax subtotal).
  // Gate on quote.total (reliably non-zero) rather than quote.subtotal which can
  // be 0 for older records mapped as `q.subtotal || 0` in useQuotes.
  const getStageBillingAmount = (stage: ProjectStage) => {
    if (stage.invoiceAmount) return stage.invoiceAmount;
    if (stage.invoicePercentage && quote?.total) {
      const taxRate = quote.taxRate || 0;
      // Use stored subtotal when available; derive from total otherwise.
      const subtotal =
        quote.subtotal && quote.subtotal > 0
          ? quote.subtotal
          : quote.total / (1 + taxRate / 100);
      return (subtotal * stage.invoicePercentage) / 100;
    }
    return null;
  };

  // Check if stage has billing configured
  const hasBilling = (stage: ProjectStage) => {
    return !!(stage.invoiceAmount || stage.invoicePercentage);
  };

  const handleDeleteStage = async () => {
    if (stageToDelete && onDeleteStage) {
      await onDeleteStage(stageToDelete);
      setStageToDelete(null);
      setDeleteDialogOpen(false);
    }
  };

  const handleMoveStage = async (index: number, direction: 'up' | 'down') => {
    if (!onReorderStages) return;
    
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= stages.length) return;
    
    const newStageIds = stages.map(s => s.id);
    [newStageIds[index], newStageIds[newIndex]] = [newStageIds[newIndex], newStageIds[index]];
    
    await onReorderStages(newStageIds);
  };

  const handleClearAllStages = async () => {
    if (onClearAllStages) {
      await onClearAllStages();
      setClearAllDialogOpen(false);
    }
  };

  const isEditable = !!(onAddStage && onEditStage && onDeleteStage);

  return (
    <>
      <Card className="p-4 sm:p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-heading font-semibold text-lg">Project Stages</h3>
          {isEditable && (
            <Button size="sm" onClick={handleAddStage}>
              <Plus className="w-4 h-4 mr-1" />
              Add Stage
            </Button>
          )}
        </div>
        
        {stages.length === 0 ? (
          <div className="text-center py-8">
            <Circle className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground mb-4">This project has no stages</p>
            {isEditable && (
              <Button variant="outline" onClick={handleAddStage}>
                <Plus className="w-4 h-4 mr-2" />
                Add First Stage
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {stages.map((stage, index) => (
              <div 
                key={stage.id}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg border transition-all",
                  stage.status === 'current' && "bg-primary/5 border-primary/30",
                  stage.status === 'completed' && "bg-approved/5 border-approved/30",
                  stage.status === 'upcoming' && "bg-secondary/50 border-border"
                )}
              >
                {/* Reorder buttons */}
                {isEditable && onReorderStages && (
                  <div className="flex flex-col gap-0.5">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5"
                      disabled={index === 0}
                      onClick={() => handleMoveStage(index, 'up')}
                    >
                      <ChevronUp className="w-3 h-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5"
                      disabled={index === stages.length - 1}
                      onClick={() => handleMoveStage(index, 'down')}
                    >
                      <ChevronDown className="w-3 h-3" />
                    </Button>
                  </div>
                )}

                {/* Status Icon */}
                <div className={cn(
                  "flex-shrink-0",
                  stage.status === 'completed' && "text-approved",
                  stage.status === 'current' && "text-primary",
                  stage.status === 'upcoming' && "text-muted-foreground"
                )}>
                  {stage.status === 'completed' ? (
                    <CheckCircle2 className="w-6 h-6" />
                  ) : stage.status === 'current' ? (
                    <Play className="w-6 h-6 fill-current" />
                  ) : (
                    <Circle className="w-6 h-6" />
                  )}
                </div>

                {/* Stage Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={cn(
                      "font-medium",
                      stage.status === 'upcoming' && "text-muted-foreground"
                    )}>
                      {stage.name}
                    </p>
                    {/* Invoice Status Badge */}
                    {(() => {
                      const stageInvoice = getStageInvoice(stage.id);
                      if (stageInvoice) {
                        if (stageInvoice.status === 'paid') {
                          return (
                            <Badge variant="success" className="text-xs gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              Paid
                            </Badge>
                          );
                        }
                        return (
                          <Badge variant="secondary" className="text-xs gap-1">
                            <Receipt className="w-3 h-3" />
                            Invoiced
                          </Badge>
                        );
                      }
                      return null;
                    })()}
                  </div>
                  {stage.description && (
                    <p className="text-sm text-muted-foreground truncate">
                      {stage.description}
                    </p>
                  )}
                  {/* Billing Info */}
                  {hasBilling(stage) && (
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      <DollarSign className="w-3 h-3" />
                      Invoice: {stage.invoiceAmount 
                        ? `$${stage.invoiceAmount.toLocaleString('en-AU', { minimumFractionDigits: 2 })}`
                        : `${stage.invoicePercentage}% of quote`}
                      {stage.invoicePercentage && quote?.total && (() => {
                        const amt = getStageBillingAmount(stage);
                        return amt ? (
                          <span className="text-muted-foreground/70">
                            (${amt.toLocaleString('en-AU', { minimumFractionDigits: 2 })} ex. tax)
                          </span>
                        ) : null;
                      })()}
                    </p>
                  )}
                </div>

                {/* Edit/Delete Actions */}
                {isEditable && (
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleEditStage(stage)}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => {
                        setStageToDelete(stage.id);
                        setDeleteDialogOpen(true);
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                )}

                {/* Status Actions */}
                <div className="flex-shrink-0 flex items-center gap-2">
                  {/* Generate Invoice Button for completed stages with billing */}
                  {stage.status === 'completed' && hasBilling(stage) && !getStageInvoice(stage.id) && onGenerateStageInvoice && (
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => {
                        const amount = getStageBillingAmount(stage);
                        if (amount) onGenerateStageInvoice(stage, amount);
                      }}
                    >
                      <Receipt className="w-4 h-4 mr-1" />
                      Invoice
                    </Button>
                  )}
                  
                  {stage.status === 'current' && (
                    <Button 
                      size="sm" 
                      variant="approve"
                      onClick={() => handleMarkComplete(index)}
                    >
                      <CheckCircle2 className="w-4 h-4 mr-1" />
                      Complete
                    </Button>
                  )}
                  {stage.status === 'upcoming' && index === currentStageIndex + 1 && (
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleStartStage(index)}
                    >
                      <Play className="w-4 h-4 mr-1" />
                      Start
                    </Button>
                  )}
                  {stage.status === 'completed' && index === stages.filter(s => s.status === 'completed').length - 1 && (
                    <Button 
                      size="sm" 
                      variant="ghost"
                      onClick={() => handleRevertStage(index)}
                    >
                      <RotateCcw className="w-4 h-4 mr-1" />
                      Revert
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Clear All Stages */}
        {isEditable && stages.length > 0 && onClearAllStages && (
          <div className="mt-4 pt-4 border-t">
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-destructive"
              onClick={() => setClearAllDialogOpen(true)}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Clear All Stages
            </Button>
          </div>
        )}
      </Card>

      {/* Edit/Add Stage Modal */}
      <EditStageModal
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        stage={editingStage}
        onSave={handleSaveStage}
      />

      {/* Delete Stage Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Stage</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this stage? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteStage} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Clear All Stages Confirmation */}
      <AlertDialog open={clearAllDialogOpen} onOpenChange={setClearAllDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear All Stages</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove all stages from this project? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleClearAllStages} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Clear All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
