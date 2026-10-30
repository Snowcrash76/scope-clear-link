import { PageTitle as EmployeePageTitle } from "@/components/employee/PageTitle";

export function PageTitle({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <EmployeePageTitle
      eyebrow={eyebrow}
      title={title}
      description={description}
      action={action}
    />
  );
}
