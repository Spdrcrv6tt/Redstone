"use client";

import { useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import type { StudyQuizSpec } from "@/types/study";

interface StudyQuizProps {
  quiz: StudyQuizSpec;
}

export function StudyQuiz({ quiz }: StudyQuizProps) {
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);

  const question = quiz.questions[index];
  const total = quiz.questions.length;

  if (!question) return null;

  const answered = selected !== null;
  const isCorrect = selected === question.answerIndex;

  const pick = (choiceIndex: number) => {
    if (answered) return;
    setSelected(choiceIndex);
    if (choiceIndex === question.answerIndex) {
      setScore((s) => s + 1);
    }
  };

  const next = () => {
    if (index + 1 >= total) {
      setFinished(true);
      return;
    }
    setIndex((i) => i + 1);
    setSelected(null);
  };

  const restart = () => {
    setIndex(0);
    setSelected(null);
    setScore(0);
    setFinished(false);
  };

  if (finished) {
    return (
      <div className="study-quiz my-4 rounded-xl border border-theme bg-surface-muted/40 p-6 text-center shadow-sm">
        <h3 className="text-lg font-semibold text-primary">{quiz.title}</h3>
        <p className="mt-2 text-3xl font-bold text-indigo-400">
          {score} / {total}
        </p>
        <p className="mt-1 text-sm text-muted">
          {score === total
            ? "Perfect score!"
            : score >= total * 0.7
              ? "Solid work — review the ones you missed."
              : "Keep practicing — try the quiz again."}
        </p>
        <button
          type="button"
          onClick={restart}
          className="mt-4 inline-flex rounded-lg border border-theme bg-surface-muted px-5 py-2 text-sm text-primary transition hover:bg-surface-hover"
        >
          Retry quiz
        </button>
      </div>
    );
  }

  return (
    <div className="study-quiz my-4 rounded-xl border border-theme bg-surface-muted/40 p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-primary">{quiz.title}</h3>
        <span className="text-xs text-muted">
          Question {index + 1} of {total}
        </span>
      </div>

      <p className="mb-4 text-base font-medium text-primary">{question.prompt}</p>

      <div className="space-y-2">
        {question.choices.map((choice, choiceIndex) => {
          let className =
            "quiz-choice w-full rounded-lg border border-theme px-4 py-3 text-left text-sm transition";
          if (!answered) {
            className += " hover:border-indigo-500/50 hover:bg-surface-hover cursor-pointer";
          } else if (choiceIndex === question.answerIndex) {
            className += " border-green-500/50 bg-green-500/10 text-green-300";
          } else if (choiceIndex === selected) {
            className += " border-red-500/50 bg-red-500/10 text-red-300";
          } else {
            className += " opacity-50";
          }

          return (
            <button
              key={choiceIndex}
              type="button"
              disabled={answered}
              onClick={() => pick(choiceIndex)}
              className={className}
            >
              <span className="flex items-center gap-2">
                {answered && choiceIndex === question.answerIndex && (
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                )}
                {answered &&
                  choiceIndex === selected &&
                  choiceIndex !== question.answerIndex && (
                    <XCircle className="h-4 w-4 shrink-0" />
                  )}
                {choice}
              </span>
            </button>
          );
        })}
      </div>

      {answered && question.explanation && (
        <p className="mt-3 rounded-lg bg-surface-muted px-3 py-2 text-sm text-secondary">
          {question.explanation}
        </p>
      )}

      {answered && (
        <button
          type="button"
          onClick={next}
          className="mt-4 inline-flex rounded-lg border border-indigo-500/40 bg-indigo-500/10 px-5 py-2 text-sm text-indigo-300 transition hover:bg-indigo-500/20"
        >
          {index + 1 >= total ? "See results" : "Next question"}
        </button>
      )}
    </div>
  );
}

export function StudyQuizPending() {
  return (
    <div className="study-quiz my-4 flex min-h-[200px] items-center justify-center rounded-xl border border-dashed border-theme bg-surface-muted/60">
      <p className="text-sm text-muted">Building practice quiz…</p>
    </div>
  );
}
