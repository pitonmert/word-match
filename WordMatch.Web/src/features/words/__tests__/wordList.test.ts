import { describe, expect, it } from "vitest";
import type { WordResponse } from "@/features/words/api/words";
import {
  getVisibleWords,
  type WordListFilters,
} from "@/features/words/wordList";

const words: WordResponse[] = [
  {
    id: 1,
    english: "apple",
    turkishTranslations: ["elma"],
    partOfSpeech: "Noun",
    pastSimple: null,
    pastParticiple: null,
    isIrregular: false,
    level: "A1",
    topic: "FoodAndDrink",
  },
  {
    id: 2,
    english: "go",
    turkishTranslations: ["gitmek"],
    partOfSpeech: "Verb",
    pastSimple: "went",
    pastParticiple: "gone",
    isIrregular: true,
    level: "A1",
    topic: "Actions",
  },
  {
    id: 3,
    english: "beautiful",
    turkishTranslations: ["güzel"],
    partOfSpeech: "Adjective",
    pastSimple: null,
    pastParticiple: null,
    isIrregular: false,
    level: "A2",
    topic: "Descriptions",
  },
];

const defaultFilters: WordListFilters = {
  search: "",
  level: "all",
  topic: "all",
  partOfSpeech: "all",
  verbType: "none",
};

describe("getVisibleWords", () => {
  it.each(["apple", "ELMA", "went", "gone"])(
    "searches English, Turkish, and verb forms with %s",
    (search) => {
      const result = getVisibleWords(
        words,
        { ...defaultFilters, search },
        "id",
        "asc",
      );

      expect(result).toHaveLength(1);
    },
  );

  it("combines metadata filters", () => {
    const result = getVisibleWords(
      words,
      {
        ...defaultFilters,
        level: "A1",
        topic: "Actions",
        partOfSpeech: "Verb",
        verbType: "irregular",
      },
      "id",
      "asc",
    );

    expect(result.map((word) => word.english)).toEqual(["go"]);
  });

  it("searches every Turkish translation in the array", () => {
    const job: WordResponse = {
      id: 4,
      english: "job",
      turkishTranslations: ["iş", "meslek"],
      partOfSpeech: "Noun",
      pastSimple: null,
      pastParticiple: null,
      isIrregular: false,
      level: "A1",
      topic: "JobsAndWork",
    };

    const result = getVisibleWords(
      [...words, job],
      { ...defaultFilters, search: "MESLEK" },
      "id",
      "asc",
    );

    expect(result.map((word) => word.english)).toEqual(["job"]);
  });

  it("filters regular and irregular verbs without including other word types", () => {
    const regularVerb: WordResponse = {
      id: 4,
      english: "walk",
      turkishTranslations: ["yürümek"],
      partOfSpeech: "Verb",
      pastSimple: "walked",
      pastParticiple: "walked",
      isIrregular: false,
      level: "A1",
      topic: "Actions",
    };
    const allWords = [...words, regularVerb];

    const regular = getVisibleWords(
      allWords,
      { ...defaultFilters, verbType: "regular" },
      "id",
      "asc",
    );
    const irregular = getVisibleWords(
      allWords,
      { ...defaultFilters, verbType: "irregular" },
      "id",
      "asc",
    );

    expect(regular.map((word) => word.english)).toEqual(["walk"]);
    expect(irregular.map((word) => word.english)).toEqual(["go"]);
  });

  it("sorts in both directions with a stable ID fallback", () => {
    const ascending = getVisibleWords(words, defaultFilters, "english", "asc");
    const descending = getVisibleWords(
      words,
      defaultFilters,
      "english",
      "desc",
    );

    expect(ascending.map((word) => word.english)).toEqual([
      "apple",
      "beautiful",
      "go",
    ]);
    expect(descending.map((word) => word.english)).toEqual([
      "go",
      "beautiful",
      "apple",
    ]);
  });

  it("keeps empty verb forms at the end in both directions", () => {
    const ascending = getVisibleWords(
      words,
      defaultFilters,
      "pastSimple",
      "asc",
    );
    const descending = getVisibleWords(
      words,
      defaultFilters,
      "pastSimple",
      "desc",
    );

    expect(ascending.map((word) => word.english)).toEqual([
      "go",
      "apple",
      "beautiful",
    ]);
    expect(descending.map((word) => word.english)).toEqual([
      "go",
      "apple",
      "beautiful",
    ]);
  });
});
