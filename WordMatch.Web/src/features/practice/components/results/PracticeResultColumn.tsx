import { ArrowRight } from "lucide-react";
import type { PracticeWordRecord } from "@/features/practice/api/practice";
import type { PracticeResultCategory } from "@/features/practice/components/results/types";
import { getQuestionFormatLabel } from "@/lib/displayLabels";

export type PracticeResultColumn = {
  value: PracticeResultCategory;
  label: string;
  count: number;
  words: PracticeWordRecord[];
};

export type ResultColumnProps = {
  column: PracticeResultColumn;
};

export function PracticeResultColumn({ column }: ResultColumnProps) {
  return (
    <section aria-label={`${column.label} kelimeleri`} className="min-w-0">
      {column.words.length === 0 ? (
        <p className="type-helper px-1 py-4 text-center">Yok</p>
      ) : (
        <ul>
          {column.words.map((word, index) => (
            <li
              key={`${word.wordId}-${index}`}
              className="grid grid-rows-[auto_auto] gap-1.5 overflow-hidden px-3 py-2.5 text-xs sm:px-4"
            >
              <div className="flex min-w-0 items-center justify-center gap-2 text-center">
                <span className="max-w-[70%] truncate font-medium text-foreground">
                  {word.prompt}
                </span>
                <span className="shrink-0 text-[0.6875rem] leading-none text-muted-foreground">
                  {getQuestionFormatLabel(word.format)}
                </span>
              </div>
              <div className="flex min-w-0 items-center justify-center gap-1.5">
                {column.value === "wrong" && isWrongAnswerRecord(word) ? (
                  <>
                    <span className="min-w-0 truncate text-error line-through">
                      {word.selectedAnswer}
                    </span>
                    <ArrowRight
                      aria-hidden="true"
                      className="size-3 shrink-0 text-muted-foreground"
                    />
                    <span className="min-w-0 truncate text-success">
                      {word.correctAnswer}
                    </span>
                  </>
                ) : (
                  <span className="truncate text-muted-foreground">
                    {word.correctAnswer}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function isWrongAnswerRecord(
  word: PracticeWordRecord,
): word is PracticeWordRecord & { selectedAnswer: string } {
  return typeof word.selectedAnswer === "string";
}
