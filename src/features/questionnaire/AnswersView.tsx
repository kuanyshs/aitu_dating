import { View } from 'react-native';

import {
  answerLabel,
  partnerQuestionLabels,
  questionLabels,
  questionnairePageLabels,
  questionnairePages,
  type QuestionKey,
} from '@/catalogs';
import type { PartialAnswers } from '@/contracts';
import { AppText } from '@/ui/components/Text';
import { strings } from '@/ui/strings';
import { radius, spacing } from '@/ui/theme/tokens';
import { createStyles } from '@/ui/theme/useStyles';

import { asAnswers, isAsked, type Answers } from './rules';

/** The text of an answer; interests read «Свой вариант» as its own text. */
function answerText(question: QuestionKey, answers: Answers): string {
  const value = answers[question] ?? [];
  if (question === 'interests') {
    return value
      .map((o) => (o === 'other' ? (answers.interestOther?.[0] ?? '') : answerLabel(question, o)))
      .filter(Boolean)
      .join(', ');
  }
  return value.map((o) => answerLabel(question, o)).join(', ');
}

/**
 * The Анкета's answers, in the sections of its pages. The owner sees their own questions
 * as asked («Что ты сейчас ищешь»), with «Нет ответа» where an answer is missing; someone
 * else's profile names them in the third person and leaves out what is not shared.
 */
export function AnswersView({
  answers: given,
  own,
  testID,
}: {
  answers: PartialAnswers;
  own: boolean;
  testID: string;
}) {
  const styles = useStyles();
  const answers = asAnswers(given);
  const labels = own ? questionLabels : partnerQuestionLabels;
  return (
    <View style={styles.root} testID={testID}>
      {questionnairePages.map((page) => {
        const rows = page.questions.filter(
          (q) =>
            q !== 'interestOther' && isAsked(q, answers) && (own || (answers[q]?.length ?? 0) > 0),
        );
        if (rows.length === 0) return null;
        return (
          <View key={page.key} style={styles.page}>
            <AppText variant="caption" tone="textMuted" style={styles.pageTitle}>
              {questionnairePageLabels[page.key]}
            </AppText>
            {rows.map((question) => {
              const text = answerText(question, answers);
              return (
                <View key={question} style={styles.row}>
                  <AppText variant="caption" tone="textMuted">
                    {labels[question]}
                  </AppText>
                  <AppText tone={text ? 'text' : 'textMuted'} testID={`${testID}-${question}`}>
                    {text || strings.questionnaireEdit.notAnswered}
                  </AppText>
                </View>
              );
            })}
          </View>
        );
      })}
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  root: { gap: spacing.lg },
  page: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  pageTitle: { textTransform: 'uppercase', letterSpacing: 0.5 },
  row: { gap: 2 },
}));
