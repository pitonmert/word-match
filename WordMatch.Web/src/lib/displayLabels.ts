import type {
  PracticeMode,
  PracticeOutcome,
  QuestionFormat,
} from "@/features/practice/api/practice";

const topicLabels: Record<string, string> = {
  Actions: "Eylemler",
  Animals: "Hayvanlar",
  ArtsAndEntertainment: "Sanat ve Eğlence",
  BodyAndHealth: "Vücut ve Sağlık",
  CalendarAndTime: "Takvim ve Zaman",
  Clothing: "Giyim",
  Colors: "Renkler",
  Countries: "Ülkeler",
  Days: "Günler",
  Descriptions: "Betimlemeler",
  Education: "Eğitim",
  EmotionsAndPersonality: "Duygular ve Kişilik",
  FamilyAndPeople: "Aile ve İnsanlar",
  FoodAndDrink: "Yiyecek ve İçecek",
  General: "Genel",
  HomeAndObjects: "Ev ve Eşyalar",
  JobsAndWork: "Meslekler ve İş",
  Months: "Aylar",
  NatureAndWeather: "Doğa ve Hava Durumu",
  Numbers: "Sayılar",
  Places: "Yerler",
  ShoppingAndMoney: "Alışveriş ve Para",
  SocietyAndPolitics: "Toplum ve Siyaset",
  SportsAndLeisure: "Spor ve Boş Zaman",
  TechnologyAndMedia: "Teknoloji ve Medya",
  Transportation: "Ulaşım",
  TravelAndHolidays: "Seyahat ve Tatiller",
};

const partOfSpeechLabels: Record<string, string> = {
  Adjective: "Sıfat",
  Adverb: "Zarf",
  Conjunction: "Bağlaç",
  Determiner: "Belirleyici",
  Noun: "İsim",
  Preposition: "Edat",
  Pronoun: "Zamir",
  ProperNoun: "Özel İsim",
  Verb: "Fiil",
};

export function getTopicLabel(value: string) {
  return topicLabels[value] ?? splitEnumValue(value);
}

export function getPartOfSpeechLabel(value: string) {
  return partOfSpeechLabels[value] ?? splitEnumValue(value);
}

const practiceModeLabels: Record<PracticeMode, string> = {
  TurkishToEnglish: "Türkçe → İngilizce",
  EnglishToTurkish: "İngilizce → Türkçe",
  Mixed: "Her iki yönde",
};

const practiceModeShortLabels: Record<PracticeMode, string> = {
  TurkishToEnglish: "TR → EN",
  EnglishToTurkish: "EN → TR",
  Mixed: "Her iki yönde",
};

const practiceOutcomeLabels: Record<PracticeOutcome, string> = {
  Correct: "Doğru",
  Review: "Tekrar",
  Wrong: "Yanlış",
};

export function getPracticeModeLabel(mode: PracticeMode | null | undefined) {
  return mode ? practiceModeLabels[mode] : "Çalışma";
}

export function getPracticeModeShortLabel(
  mode: PracticeMode | null | undefined,
) {
  return mode ? practiceModeShortLabels[mode] : "";
}

export function getPracticeOutcomeLabel(outcome: PracticeOutcome) {
  return practiceOutcomeLabels[outcome];
}

export function getQuestionFormatLabel(format: QuestionFormat) {
  return format === "Written" ? "Yazılı" : "Çoktan Seçmeli";
}

function splitEnumValue(value: string) {
  return value.replace(/([a-z])([A-Z])/g, "$1 $2");
}
