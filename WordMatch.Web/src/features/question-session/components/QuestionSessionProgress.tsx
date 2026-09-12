import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function QuestionSessionProgress({
  answeredCount,
  className,
  totalCount,
}: {
  answeredCount: number;
  className?: string;
  totalCount: number;
}) {
  const hasTotal = totalCount > 0;
  const progressValue = hasTotal
    ? Math.min(answeredCount, totalCount)
    : answeredCount;
  const progressPercentage = hasTotal ? (progressValue / totalCount) * 100 : 0;

  return (
    <div
      className={cn(
        "h-1.5 w-full overflow-hidden rounded-full bg-disabled",
        className,
      )}
    >
      {hasTotal ? (
        <div
          aria-label="Çalışma ilerlemesi"
          aria-valuemax={totalCount}
          aria-valuemin={0}
          aria-valuenow={progressValue}
          aria-valuetext={`${totalCount} sorudan ${progressValue} tanesi cevaplandı.`}
          className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out"
          role="progressbar"
          style={{ width: `${progressPercentage}%` }}
        />
      ) : (
        <Skeleton aria-hidden="true" className="size-full" />
      )}
    </div>
  );
}
