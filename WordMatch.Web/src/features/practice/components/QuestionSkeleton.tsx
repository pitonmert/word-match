import { Skeleton } from "@/components/ui/skeleton";

export function QuestionSkeleton() {
  return (
    <div aria-label="Soru yükleniyor" className="grid h-full grid-rows-4 gap-2">
      {Array.from({ length: 4 }, (_, index) => (
        <Skeleton key={index} className="size-full" />
      ))}
    </div>
  );
}
