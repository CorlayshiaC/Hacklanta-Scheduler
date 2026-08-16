import { Skeleton } from "@/components/ui/skeleton";

export default function AppGroupLoading() {
  return (
    <div className="flex flex-col gap-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <Skeleton className="h-24 w-full" key={index} />
      ))}
    </div>
  );
}
