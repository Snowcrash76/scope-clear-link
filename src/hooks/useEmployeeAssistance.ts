import { useLocation } from 'react-router-dom';
import { assistanceMemberFromPath, employeeAssistanceHref } from '@/lib/employeeAssistance';

export function useEmployeeAssistance() {
  const { pathname } = useLocation();
  const memberId = assistanceMemberFromPath(pathname);
  return { active: memberId !== null, memberId, href: (path: string) => employeeAssistanceHref(memberId, path) };
}
