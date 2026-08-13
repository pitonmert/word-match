import { Search, X } from "lucide-react";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { cn } from "@/lib/utils";

type WordSearchProps = {
  className?: string;
  search: string;
  onSearchChange: (search: string) => void;
};

export function WordSearch({
  className,
  search,
  onSearchChange,
}: WordSearchProps) {
  return (
    <InputGroup
      className={cn(
        "rounded-md border-border bg-card shadow-none has-[[data-slot=input-group-control]:focus-visible]:border-ring has-[[data-slot=input-group-control]:focus-visible]:ring-2 has-[[data-slot=input-group-control]:focus-visible]:ring-ring/30",
        className,
      )}
    >
      <InputGroupAddon className="pl-2.5 text-muted-foreground/80">
        <Search className="size-4" />
      </InputGroupAddon>
      <InputGroupInput
        className="type-body placeholder:text-sm [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden"
        aria-label="Kelime ara"
        placeholder="Ara"
        type="search"
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
      />
      {search && (
        <InputGroupAddon align="inline-end" className="pr-1.5">
          <InputGroupButton
            aria-label="Aramayı temizle"
            className="size-5 rounded-full border-0 text-muted-foreground/70 hover:bg-muted hover:text-foreground focus-visible:ring-1"
            size="icon-xs"
            title="Aramayı temizle"
            onClick={() => onSearchChange("")}
          >
            <X className="size-3.5" />
          </InputGroupButton>
        </InputGroupAddon>
      )}
    </InputGroup>
  );
}
