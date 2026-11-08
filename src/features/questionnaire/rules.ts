import { habitOf, type QuestionKey } from '@/catalogs';
import type { PartialAnswers } from '@/contracts';

export type Answers = { [K in QuestionKey]?: string[] };

/**
 * One answer changed, with the answers that follow from it:
 * - «Нет» children is «Нет детей»; choosing children again asks for their number;
 * - leaving «Свой вариант» drops its text, choosing it asks for one.
 */
export function withAnswer(answers: Answers, question: QuestionKey, value: string[]): Answers {
  const next: Answers = { ...answers, [question]: value };
  if (question === 'children') {
    if (value[0] === 'no') next.childrenCount = ['none'];
    else if (answers.childrenCount?.[0] === 'none' || !answers.childrenCount) {
      delete next.childrenCount;
    }
  }
  if (question === 'interests' && !value.includes('other')) next.interestOther = [];
  if (question === 'interests' && value.includes('other') && !answers.interestOther?.length) {
    delete next.interestOther;
  }
  return next;
}

/** Choosing a habit drops the other answer about the same habit. */
export function toggleHabit(value: readonly string[], option: string): string[] {
  if (value.includes(option)) return value.filter((o) => o !== option);
  return [...value.filter((o) => habitOf(o) !== habitOf(option)), option];
}

/** Whether a question is asked, given the answers so far. */
export function isAsked(question: QuestionKey, answers: Answers): boolean {
  if (question === 'childrenCount')
    return !!answers.children?.length && answers.children[0] !== 'no';
  if (question === 'interestOther') return !!answers.interests?.includes('other');
  return true;
}

/**
 * The answers of a page as they are saved: an unasked question gets its implied answer
 * («Нет детей», no text of «Свой вариант»), and the habits may stay empty.
 */
export function pageAnswers(questions: readonly QuestionKey[], answers: Answers): Answers {
  const result: Answers = {};
  for (const question of questions) {
    const value = answers[question];
    if (question === 'childrenCount' && answers.children?.[0] === 'no') result[question] = ['none'];
    else if (question === 'interestOther' && !answers.interests?.includes('other')) {
      result[question] = [];
    } else if (question === 'habits') result[question] = value ?? [];
    else if (value) result[question] = value;
  }
  return result;
}

/** A page is ready when every question asked on it has an answer. */
export function isPageReady(questions: readonly QuestionKey[], answers: Answers): boolean {
  const page = pageAnswers(questions, answers);
  return questions.every(
    (q) => q === 'habits' || !isAsked(q, answers) || (page[q]?.length ?? 0) > 0,
  );
}

export const asAnswers = (answers: PartialAnswers | undefined): Answers =>
  (answers ?? {}) as Answers;
