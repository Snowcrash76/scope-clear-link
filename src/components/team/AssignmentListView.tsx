import { AssignmentList as TeamAssignmentList } from "@/components/team/AssignmentList";

import type {
  TeamBootstrap,
  PortalAssignment,
} from "../../../shared/employeePortal";

export function AssignmentList({
  team,
  remove,
  edit,
  filterJob,
}: {
  team: TeamBootstrap;
  remove: (id: string) => void;
  edit: (assignment: PortalAssignment) => void;
  filterJob?: string;
}) {
  return (
    <TeamAssignmentList
      team={team}
      remove={remove}
      edit={edit}
      filterJob={filterJob}
    />
  );
}
