export interface Flashcard {
  front: string;
  back: string;
}

export interface FlashcardDeckSpec {
  title: string;
  cards: Flashcard[];
}

export interface QuizQuestion {
  prompt: string;
  choices: string[];
  answerIndex: number;
  explanation?: string;
}

export interface StudyQuizSpec {
  title: string;
  questions: QuizQuestion[];
}
