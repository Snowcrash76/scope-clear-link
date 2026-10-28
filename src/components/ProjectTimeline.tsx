import { ProjectStage } from '@/types/project';
import { cn } from '@/lib/utils';
import { Check, Circle, ChevronRight } from 'lucide-react';

interface ProjectTimelineProps {
  stages: ProjectStage[];
  currentStageIndex: number;
}

export function ProjectTimeline({ stages, currentStageIndex }: ProjectTimelineProps) {
  return (
    <div className="space-y-4">
      {stages.map((stage, index) => {
        const isCompleted = stage.status === 'completed';
        const isCurrent = stage.status === 'current';
        const isUpcoming = stage.status === 'upcoming';

        return (
          <div 
            key={stage.id}
            className={cn(
              "relative flex gap-4 p-4 rounded-lg transition-all duration-200",
              isCurrent && "bg-accent/10 ring-2 ring-accent/30",
              isCompleted && "bg-approved/5",
              isUpcoming && "opacity-60"
            )}
          >
            {/* Connector line */}
            {index < stages.length - 1 && (
              <div className={cn(
                "absolute left-[27px] top-[52px] w-0.5 h-[calc(100%-20px)]",
                isCompleted ? "bg-approved" : "bg-border"
              )} />
            )}

            {/* Status indicator */}
            <div className={cn(
              "flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-colors z-10",
              isCompleted && "bg-approved text-approved-foreground",
              isCurrent && "bg-accent text-accent-foreground animate-pulse-soft",
              isUpcoming && "bg-secondary text-muted-foreground border-2 border-border"
            )}>
              {isCompleted ? (
                <Check className="w-4 h-4" />
              ) : isCurrent ? (
                <ChevronRight className="w-4 h-4" />
              ) : (
                <Circle className="w-3 h-3" />
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <h4 className={cn(
                  "break-words [overflow-wrap:anywhere] font-heading font-semibold",
                  isCurrent && "text-accent-foreground"
                )}>
                  {stage.name}
                </h4>
                {isCurrent && (
                  <span className="text-xs font-medium text-accent bg-accent/20 px-2 py-0.5 rounded-full">
                    Current
                  </span>
                )}
              </div>
              <p className="break-words [overflow-wrap:anywhere] text-sm text-muted-foreground mt-1 leading-relaxed">
                {stage.description}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
