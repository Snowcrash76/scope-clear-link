import { ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
export function EmptyState({ title = "No time recorded this week", detail = "Choose another week or check back after hours are logged.", onJump }: { title?: string; detail?: string; onJump?: () => void }) {
  return <div className="grid justify-items-center px-5 py-12 text-center">
    <span className="grid h-12 w-12 place-items-center rounded-2xl bg-muted text-muted-foreground"><ClipboardCheck className="h-6 w-6" /></span>
    <h3 className="mt-4 text-lg font-bold">{title}</h3><p className="mt-1 max-w-md text-sm text-muted-foreground">{detail}</p>
    {onJump && <Button variant="outline" className="mt-4" onClick={onJump}>View last recorded week</Button>}
  </div>;
}
