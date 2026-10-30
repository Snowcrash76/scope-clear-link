import { EmptyState } from "@/components/employee/EmptyState";

export function Empty({ title, detail }: { title: string; detail: string }) {
  return <EmptyState title={title} detail={detail} />;
}
