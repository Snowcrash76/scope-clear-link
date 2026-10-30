import { TeamLoad as TeamLoadState } from "@/components/team/TeamLoad";

export function TeamLoad({
  error,
  retry,
}: {
  error?: Error | null;
  retry: () => void;
}) {
  return <TeamLoadState error={error} retry={retry} />;
}
