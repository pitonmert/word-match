import type { PracticeMode } from "@/features/practice/api/practice";

export const practiceModeOptions: {
  mode: PracticeMode;
  label: string;
  source?: string;
  target?: string;
}[] = [
  {
    mode: "TurkishToEnglish",
    label: "Türkçe → İngilizce",
    source: "Türkçe",
    target: "İngilizce",
  },
  {
    mode: "EnglishToTurkish",
    label: "İngilizce → Türkçe",
    source: "İngilizce",
    target: "Türkçe",
  },
  {
    mode: "Mixed",
    label: "Her iki yönde",
  },
];
export const supportedPracticeModes = new Set<PracticeMode>(
  practiceModeOptions.map((option) => option.mode),
);
