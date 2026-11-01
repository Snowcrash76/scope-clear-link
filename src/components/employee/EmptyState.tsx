import { CalendarDays } from "lucide-react";
import { EmptyState as SharedEmptyState } from "@/components/ui/empty-state";

export function EmptyState({
  title,
  detail,
}: {
  title: string;
  detail: string;
}) {
  return <SharedEmptyState title={title} description={detail} icon={<CalendarDays className="h-5 w-5" />} />;
}
