import { describe, expect, it } from "vitest";
import {
  initialWordColumnOrder,
  reorderColumnSubset,
} from "@/features/words/filter-panel/wordColumns";

describe("reorderColumnSubset", () => {
  it("reorders visible columns while preserving hidden column positions", () => {
    const visibleColumns = [
      "rowNumber",
      "english",
      "turkishTranslations",
      "partOfSpeech",
      "level",
      "topic",
    ] as const;

    expect(
      reorderColumnSubset(
        initialWordColumnOrder,
        visibleColumns,
        visibleColumns.indexOf("english"),
        visibleColumns.indexOf("topic"),
      ),
    ).toEqual([
      "rowNumber",
      "turkishTranslations",
      "partOfSpeech",
      "level",
      "pastSimple",
      "pastParticiple",
      "isIrregular",
      "topic",
      "english",
    ]);
  });

  it("does not change the order for invalid or identical positions", () => {
    expect(
      reorderColumnSubset(initialWordColumnOrder, initialWordColumnOrder, 2, 2),
    ).toEqual(initialWordColumnOrder);
    expect(
      reorderColumnSubset(
        initialWordColumnOrder,
        initialWordColumnOrder,
        -1,
        2,
      ),
    ).toEqual(initialWordColumnOrder);
  });
});
