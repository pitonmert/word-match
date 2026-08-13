import type { WordResponse } from "@/features/words/api/words";

export type VerbTypeFilter = "none" | "regular" | "irregular";
export type ProgressFilter =
  "all" | "correct" | "review" | "wrong" | "notPracticed";
export type SortDirection = "asc" | "desc";
export type WordSortField = keyof WordResponse;

export type WordListFilters = {
  search: string;
  level: string;
  topic: string;
  partOfSpeech: string;
  progress: ProgressFilter;
  verbType: VerbTypeFilter;
};

const englishCollator = new Intl.Collator("en", {
  numeric: true,
  sensitivity: "base",
});
const turkishCollator = new Intl.Collator("tr", {
  numeric: true,
  sensitivity: "base",
});
const levelOrder = new Map([
  ["A1", 0],
  ["A2", 1],
  ["B1", 2],
  ["B2", 3],
]);

function matchesSearch(word: WordResponse, search: string) {
  const trimmedSearch = search.trim();
  if (!trimmedSearch) return true;

  const englishSearch = trimmedSearch.toLocaleLowerCase("en-US");
  const turkishSearch = trimmedSearch.toLocaleLowerCase("tr-TR");

  return (
    word.english.toLocaleLowerCase("en-US").includes(englishSearch) ||
    word.turkishTranslations.some((translation) =>
      translation.toLocaleLowerCase("tr-TR").includes(turkishSearch),
    ) ||
    word.pastSimple?.toLocaleLowerCase("en-US").includes(englishSearch) ||
    word.pastParticiple?.toLocaleLowerCase("en-US").includes(englishSearch) ||
    false
  );
}

function matchesProgress(word: WordResponse, progress: ProgressFilter) {
  if (progress === "all") return true;
  if (progress === "correct") return word.currentOutcome === "Correct";
  if (progress === "review") return word.currentOutcome === "Review";
  if (progress === "wrong") return word.currentOutcome === "Wrong";
  return word.currentOutcome === null;
}

function compareValues(
  first: WordResponse,
  second: WordResponse,
  sortField: WordSortField,
) {
  if (sortField === "id") return first.id - second.id;
  if (sortField === "isIrregular") {
    return Number(first.isIrregular) - Number(second.isIrregular);
  }
  if (sortField === "level") {
    return (
      (levelOrder.get(first.level) ?? Number.MAX_SAFE_INTEGER) -
      (levelOrder.get(second.level) ?? Number.MAX_SAFE_INTEGER)
    );
  }

  const firstValue =
    sortField === "turkishTranslations"
      ? first.turkishTranslations.join(", ")
      : (first[sortField] ?? "");
  const secondValue =
    sortField === "turkishTranslations"
      ? second.turkishTranslations.join(", ")
      : (second[sortField] ?? "");
  const firstIsEmpty = firstValue === "";
  const secondIsEmpty = secondValue === "";

  if (firstIsEmpty !== secondIsEmpty) {
    return firstIsEmpty ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
  }

  const collator =
    sortField === "turkishTranslations" ? turkishCollator : englishCollator;

  return collator.compare(String(firstValue), String(secondValue));
}

export function getVisibleWords(
  words: WordResponse[],
  filters: WordListFilters,
  sortField: WordSortField,
  sortDirection: SortDirection,
) {
  const direction = sortDirection === "asc" ? 1 : -1;

  return words
    .filter(
      (word) =>
        matchesSearch(word, filters.search) &&
        (filters.level === "all" || word.level === filters.level) &&
        (filters.topic === "all" || word.topic === filters.topic) &&
        matchesProgress(word, filters.progress) &&
        (filters.partOfSpeech === "all" ||
          word.partOfSpeech === filters.partOfSpeech) &&
        (filters.verbType === "none" ||
          (word.partOfSpeech === "Verb" &&
            word.isIrregular === (filters.verbType === "irregular"))),
    )
    .sort((first, second) => {
      const result = compareValues(first, second, sortField);
      if (!Number.isFinite(result)) return result;
      return result === 0 ? first.id - second.id : result * direction;
    });
}

export function getUniqueValues(
  words: WordResponse[],
  field: "level" | "topic" | "partOfSpeech",
) {
  const values = [...new Set(words.map((word) => word[field]))];

  if (field === "level") {
    return values.sort(
      (first, second) =>
        (levelOrder.get(first) ?? Number.MAX_SAFE_INTEGER) -
        (levelOrder.get(second) ?? Number.MAX_SAFE_INTEGER),
    );
  }

  return values.sort(englishCollator.compare);
}
