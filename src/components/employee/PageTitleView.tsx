import { PageTitle as EmployeePageTitle } from "@/components/employee/PageTitle";

export function PageTitle({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <EmployeePageTitle
      title={title}
      description={description}
      action={action}
    />
  );
}
