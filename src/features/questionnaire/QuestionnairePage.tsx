import { View } from 'react-native';

import { genderLabels, type Gender, type QuestionKey } from '@/catalogs';
import { AppText } from '@/ui/components/Text';
import { strings } from '@/ui/strings';
import { radius, spacing } from '@/ui/theme/tokens';
import { createStyles } from '@/ui/theme/useStyles';

import { AnswerInput } from './AnswerInput';
import { isAsked, withAnswer, type Answers } from './rules';

const t = strings.questionnaireEdit;

type Props = {
  questions: readonly QuestionKey[];
  answers: Answers;
  onChange: (answers: Answers) => void;
  /** Пол and возраст from Passport, shown first and locked. */
  passport?: { gender: Gender; age: number };
  errors?: Partial<Record<QuestionKey, string>>;
  testID: string;
};

/**
 * Questions of one Анкета page, each with its answer. A question that follows from another
 * one («Сколько детей», «Свой вариант») shows only when it is asked.
 */
export function QuestionnairePage({
  questions,
  answers,
  onChange,
  passport,
  errors,
  testID,
}: Props) {
  const styles = useStyles();
  return (
    <View style={styles.page} testID={testID}>
      {passport ? (
        <View style={styles.passport} testID={`${testID}-passport`}>
          <View style={styles.row}>
            <AppText variant="bodyStrong">{t.gender}</AppText>
            <AppText testID={`${testID}-gender`}>{genderLabels[passport.gender]}</AppText>
          </View>
          <View style={styles.row}>
            <AppText variant="bodyStrong">{t.age}</AppText>
            <AppText testID={`${testID}-age`}>{String(passport.age)}</AppText>
          </View>
          <AppText variant="caption" tone="textMuted">
            {t.fromPassport}
          </AppText>
        </View>
      ) : null}
      {questions
        .filter((q) => isAsked(q, answers))
        .map((question) => (
          <AnswerInput
            key={question}
            question={question}
            value={answers[question] ?? []}
            onChange={(value) => onChange(withAnswer(answers, question, value))}
            showLabel
            error={errors?.[question]}
            testID={`answer-${question}`}
          />
        ))}
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  page: { gap: spacing.lg },
  passport: {
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
}));
