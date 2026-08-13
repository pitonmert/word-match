import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";

export type WordFilterField =
  "progress" | "partOfSpeech" | "verbType" | "level" | "topic";

export type WordFilterValues = Record<WordFilterField, string>;

export type WordFilterSectionVisibility = Record<WordFilterField, boolean>;

export type WordFilterOption = {
  value: string;
  label: string;
};

export type WordFilterDefinition = {
  field: WordFilterField;
  label: string;
  options: WordFilterOption[];
};

type WordFilterControlsProps = {
  definitions: WordFilterDefinition[];
  sectionVisibility: WordFilterSectionVisibility;
  values: WordFilterValues;
  onSectionVisibilityChange: (
    field: WordFilterField,
    isVisible: boolean,
  ) => void;
  onValueChange: (field: WordFilterField, value: string) => void;
};

export function WordFilterControls({
  definitions,
  sectionVisibility,
  values,
  onSectionVisibilityChange,
  onValueChange,
}: WordFilterControlsProps) {
  return (
    <div className="grid gap-4" data-word-filter-controls>
      {definitions.map((definition) => (
        <WordFilterSection
          key={definition.field}
          definition={definition}
          isOpen={sectionVisibility[definition.field]}
          value={values[definition.field]}
          onOpenChange={(isOpen) =>
            onSectionVisibilityChange(definition.field, isOpen)
          }
          onValueChange={(value) => onValueChange(definition.field, value)}
        />
      ))}
    </div>
  );
}

type WordFilterSectionProps = {
  definition: WordFilterDefinition;
  isOpen: boolean;
  value: string;
  onOpenChange: (isOpen: boolean) => void;
  onValueChange: (value: string) => void;
};

function WordFilterSection({
  definition,
  isOpen,
  value,
  onOpenChange,
  onValueChange,
}: WordFilterSectionProps) {
  const contentId = `${definition.field}-options`;

  return (
    <section aria-labelledby={`${definition.field}-label`}>
      <h2>
        <Button
          aria-controls={contentId}
          aria-expanded={isOpen}
          aria-label={`${definition.label} filtresini ${isOpen ? "daralt" : "genişlet"}`}
          className="type-body mb-1 w-full justify-between px-2 font-semibold text-foreground shadow-none aria-expanded:bg-transparent"
          type="button"
          variant="ghost"
          onClick={() => onOpenChange(!isOpen)}
        >
          <span id={`${definition.field}-label`}>{definition.label}</span>
          <ChevronDown
            className={cn(
              "text-muted-foreground transition-transform",
              !isOpen && "-rotate-90",
            )}
          />
        </Button>
      </h2>
      {isOpen && (
        <div id={contentId}>
          <FilterOptionList
            definition={definition}
            value={value}
            onValueChange={onValueChange}
          />
        </div>
      )}
    </section>
  );
}

type FilterOptionListProps = {
  definition: WordFilterDefinition;
  value: string;
  onValueChange: (value: string) => void;
};

export function FilterOptionList({
  definition,
  value,
  onValueChange,
}: FilterOptionListProps) {
  return (
    <RadioGroup
      aria-label={`${definition.label} seçenekleri`}
      className="gap-0.5"
      value={value}
      onValueChange={onValueChange}
    >
      {definition.options.map((option) => (
        <FilterOption key={option.value} option={option} />
      ))}
    </RadioGroup>
  );
}

type FilterOptionProps = {
  option: WordFilterOption;
};

function FilterOption({ option }: FilterOptionProps) {
  return (
    <label className="type-body flex min-h-8 cursor-pointer items-center gap-3 rounded-md border border-transparent px-2 py-1 text-foreground transition-[background-color,border-color] hover:border-border hover:bg-muted has-data-disabled:cursor-not-allowed has-data-disabled:text-disabled-foreground">
      <RadioGroupItem value={option.value} />
      <span className="min-w-0 truncate">{option.label}</span>
    </label>
  );
}

export function isFilterValueActive(value: string) {
  return value !== "all" && value !== "none";
}
