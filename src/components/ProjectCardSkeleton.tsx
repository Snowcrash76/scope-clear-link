import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export function ProjectCardSkeleton() {
  return (
    <Card className="hover:shadow-card transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-2 flex-1">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-5 w-16" />
          </div>
          <Skeleton className="h-2 w-full rounded-full" />
          <div className="flex items-center gap-2 pt-2">
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-8 w-8" />
            <Skeleton className="h-8 w-8" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function ProjectCardSkeletonGrid() {
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <ProjectCardSkeleton />
      <ProjectCardSkeleton />
      <ProjectCardSkeleton />
    </div>
  );
}
