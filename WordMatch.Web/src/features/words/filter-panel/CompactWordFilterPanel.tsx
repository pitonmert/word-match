import { useState, type ReactNode } from "react";
import { ChevronDown, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useCloseOnEscape } from "@/features/words/hooks/useCloseOnEscape";
import {
  FilterOptionList,
  isFilterValueActive,
  type WordFilterDefinition,
  type WordFilterField,
  type WordFilterValues,
} from "@/features/words/filter-panel/WordFilterControls";
import {
  filterPanelActionButtonClassName,
  filterPanelIconButtonActiveClassName,
  filterPanelIconButtonClassName,
} from "@/features/words/filter-panel/filterPanelStyles";
import { cn } from "@/lib/utils";

type CompactWordFilterPanelProps = {
  activeFilterCount: number;
  children: ReactNode;
  definitions: WordFilterDefinition[];
  isOpen: boolean;
  values: WordFilterValues;
  onClear: () => void;
  onOpenChange: (isOpen: boolean) => void;
  onValueChange: (field: WordFilterField, value: string) => void;
  trailingAction?: ReactNode;
};

export function CompactWordFilterPanel({
  activeFilterCount,
  children,
  definitions,
  isOpen,
  values,
  onClear,
  onOpenChange,
  onValueChange,
  trailingAction,
}: CompactWordFilterPanelProps) {
  const [activeField, setActiveField] = useState<WordFilterField>(
    definitions[0]?.field ?? "partOfSpeech",
  );
  const activeDefinition =
    definitions.find((definition) => definition.field === activeField) ??
    definitions[0];

  useCloseOnEscape(isOpen, () => onOpenChange(false));

  if (!activeDefinition) return <>{children}</>;

  return (
    <Collapsible
      className="mb-2 min-w-0"
      open={isOpen}
      onOpenChange={onOpenChange}
    >
      <div className="flex min-w-0 gap-2">
        {children}
        <CollapsibleTrigger
          render={
            <Button
              aria-label={
                activeFilterCount > 0
                  ? `Kelimeleri filtrele, ${activeFilterCount} etkin filtre`
                  : "Kelimeleri filtrele"
              }
              className={cn(
                "gap-1.5",
                filterPanelIconButtonClassName,
                activeFilterCount > 0 && "text-primary",
                isOpen && "rounded-b-none",
                isOpen && filterPanelIconButtonActiveClassName,
              )}
              title="Kelimeleri filtrele"
              type="button"
              variant="outline"
            >
              <Filter />
              <span>Filtreler</span>
              <ChevronDown
                className={cn("transition-transform", isOpen && "rotate-180")}
              />
            </Button>
          }
        />
        {trailingAction}
      </div>
      <CollapsibleContent
        aria-label="Filtreler"
        className="overflow-hidden transition-[height,opacity] duration-200 ease-out data-ending-style:opacity-0 data-starting-style:opacity-0"
        role="region"
      >
        <div className="mt-1 flex h-64 max-h-[calc(100svh-11rem)] flex-col overflow-hidden rounded-lg border bg-card">
          <div className="shrink-0 overflow-x-auto overscroll-none border-b bg-muted p-2">
            <div className="flex min-w-max gap-1">
              {definitions.map((definition) => {
                const isActive = definition.field === activeField;
                const isFiltered = isFilterValueActive(
                  values[definition.field],
                );

                return (
                  <Button
                    key={definition.field}
                    aria-pressed={isActive}
                    className={cn(
                      "relative border border-transparent text-muted-foreground shadow-none hover:border-border hover:bg-primary-50 hover:text-foreground",
                      isActive &&
                        "border-primary/50 bg-primary-100 text-primary-900",
                    )}
                    size="sm"
                    type="button"
                    variant="ghost"
                    onClick={() => setActiveField(definition.field)}
                  >
                    {definition.label}
                    {isFiltered && (
                      <span className="size-1.5 rounded-full bg-primary" />
                    )}
                  </Button>
                );
              })}
            </div>
          </div>
          <ScrollArea className="min-h-0 flex-1 *:data-[slot=scroll-area-viewport]:overscroll-none">
            <div className="p-3" data-word-filter-content>
              <FilterOptionList
                definition={activeDefinition}
                value={values[activeDefinition.field]}
                onValueChange={(value) =>
                  onValueChange(activeDefinition.field, value)
                }
              />
            </div>
          </ScrollArea>
          {activeFilterCount > 0 && (
            <footer className="shrink-0 border-t bg-muted p-3">
              <Button
                className={filterPanelActionButtonClassName}
                type="button"
                variant="outline"
                onClick={onClear}
              >
                Filtreleri temizle
              </Button>
            </footer>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
