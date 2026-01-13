import { ProjectStage } from '@/types/project';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Circle, Play, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StageManagerProps {
  stages: ProjectStage[];
  currentStageIndex: number;
  onUpdateStage: (stageId: string, status: 'upcoming' | 'current' | 'completed') => void;
  onSetCurrentStage: (index: number) => void;
}

export function StageManager({ 
  stages, 
  currentStageIndex,
  onUpdateStage,
  onSetCurrentStage
}: StageManagerProps) {
  const handleMarkComplete = (stageIndex: number) => {
    const stage = stages[stageIndex];
    onUpdateStage(stage.id, 'completed');
    
    // If there's a next stage, make it current
    if (stageIndex + 1 < stages.length) {
      onSetCurrentStage(stageIndex + 1);
      onUpdateStage(stages[stageIndex + 1].id, 'current');
    }
  };

  const handleStartStage = (stageIndex: number) => {
    const stage = stages[stageIndex];
    onSetCurrentStage(stageIndex);
    onUpdateStage(stage.id, 'current');
  };

  const handleRevertStage = (stageIndex: number) => {
    const stage = stages[stageIndex];
    onUpdateStage(stage.id, 'upcoming');
    
    // Make previous stage current if exists
    if (stageIndex > 0) {
      onSetCurrentStage(stageIndex - 1);
      onUpdateStage(stages[stageIndex - 1].id, 'current');
    }
  };

  return (
    <Card className="p-4 sm:p-5">
      <h3 className="font-heading font-semibold text-lg mb-4">Project Stages</h3>
      
      <div className="space-y-3">
        {stages.map((stage, index) => (
          <div 
            key={stage.id}
            className={cn(
              "flex items-center gap-4 p-3 rounded-lg border transition-all",
              stage.status === 'current' && "bg-primary/5 border-primary/30",
              stage.status === 'completed' && "bg-approved/5 border-approved/30",
              stage.status === 'upcoming' && "bg-secondary/50 border-border"
            )}
          >
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
              <p className={cn(
                "font-medium",
                stage.status === 'upcoming' && "text-muted-foreground"
              )}>
                {stage.name}
              </p>
              <p className="text-sm text-muted-foreground truncate">
                {stage.description}
              </p>
            </div>

            {/* Actions */}
            <div className="flex-shrink-0">
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
    </Card>
  );
}
