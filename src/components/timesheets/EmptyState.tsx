import { ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState as SharedEmptyState } from "@/components/ui/empty-state";
export function EmptyState({
  title = "No time recorded this week",
  detail = "Choose another week or check back after hours are logged.",
  onJump,
}: {
  title?: string;
  detail?: string;
  onJump?: () => void;
}) {
  return (
    <SharedEmptyState
      title={title}
      description={detail}
      icon={<ClipboardCheck className="h-5 w-5" />}
      action={onJump ? <Button variant="outline" onClick={onJump}>View last recorded week</Button> : undefined}
    />
  );
}
