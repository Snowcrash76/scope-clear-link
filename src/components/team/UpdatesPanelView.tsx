import { UpdatesPanel as TeamUpdatesPanel } from "@/components/team/UpdatesPanel";

import type { TeamBootstrap } from "../../../shared/employeePortal";

export function UpdatesPanel({
  team,
  jobId,
}: {
  team: TeamBootstrap;
  jobId?: string;
}) {
  return <TeamUpdatesPanel team={team} jobId={jobId} />;
}
