import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";

type WordListFooterProps = {
  currentPage: number;
  pageCount: number;
  pageSize: number;
  totalCount: number;
  onPageChange: (page: number) => void;
};

export function WordListFooter({
  currentPage,
  pageCount,
  pageSize,
  totalCount,
  onPageChange,
}: WordListFooterProps) {
  const firstItem = (currentPage - 1) * pageSize + 1;
  const lastItem = Math.min(currentPage * pageSize, totalCount);
  const hasMultiplePages = pageCount > 1;
  const countLabel = hasMultiplePages
    ? `${totalCount} kelimeden ${firstItem}-${lastItem}`
    : `${totalCount} kelime`;

  return (
    <footer
      className="@container flex min-h-13.25 min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t bg-muted px-3 py-2"
      data-slot="word-list-footer"
    >
      <p className="type-body shrink-0 whitespace-nowrap text-muted-foreground @max-[24rem]:w-full @max-[24rem]:text-center">
        {countLabel}
      </p>
      <nav
        aria-label="Sayfalama"
        className="flex shrink-0 items-center justify-end gap-1 @max-[24rem]:w-full @max-[24rem]:justify-center"
      >
        {hasMultiplePages && (
          <Button
            aria-label="Önceki sayfa"
            className="size-7"
            disabled={currentPage === 1}
            size="icon-sm"
            title="Önceki sayfa"
            type="button"
            variant="outline"
            onClick={() => onPageChange(currentPage - 1)}
          >
            <ChevronLeft />
          </Button>
        )}
        {getPaginationItems(currentPage, Math.max(pageCount, 1)).map(
          (item, index) =>
            item === "ellipsis" ? (
              <span
                key={`ellipsis-${index}`}
                className="flex size-7 items-center justify-center text-muted-foreground"
              >
                <MoreHorizontal aria-hidden="true" />
              </span>
            ) : (
              <Button
                key={item}
                aria-current={item === currentPage ? "page" : undefined}
                aria-label={`${item}. sayfaya git`}
                className="size-7 tabular-nums"
                size="icon-sm"
                type="button"
                variant={item === currentPage ? "secondary" : "ghost"}
                onClick={() => onPageChange(item)}
              >
                {item}
              </Button>
            ),
        )}
        {hasMultiplePages && (
          <Button
            aria-label="Sonraki sayfa"
            className="size-7"
            disabled={currentPage === pageCount}
            size="icon-sm"
            title="Sonraki sayfa"
            type="button"
            variant="outline"
            onClick={() => onPageChange(currentPage + 1)}
          >
            <ChevronRight />
          </Button>
        )}
      </nav>
    </footer>
  );
}

function getPaginationItems(currentPage: number, pageCount: number) {
  if (pageCount <= 5) {
    return Array.from({ length: pageCount }, (_, index) => index + 1);
  }

  if (currentPage <= 3) {
    return [1, 2, 3, "ellipsis", pageCount] as const;
  }

  if (currentPage >= pageCount - 2) {
    return [1, "ellipsis", pageCount - 2, pageCount - 1, pageCount] as const;
  }

  return [1, "ellipsis", currentPage, "ellipsis", pageCount] as const;
}
