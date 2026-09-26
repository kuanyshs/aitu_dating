import { useRouter, type Href } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import {
  cityLabels,
  datingIntentLabels,
  questionKeys,
  questionLabels,
  questionnaire,
  questionOptionLabels,
  type QuestionKey,
} from '@/catalogs';
import { isRepositoryError, type PartialAnswers } from '@/contracts';
import { useCompleteOnboarding, useSaveAnswer } from '@/data/hooks';
import { StepScreen } from '@/features/access/StepScreen';
import { accessErrorText, newIdempotencyKey } from '@/features/access/steps';
import { useStepGuard } from '@/features/access/useStepGuard';
import { PrimaryButton, SecondaryButton } from '@/ui/components/buttons';
import { RadioGroup } from '@/ui/components/RadioGroup';
import { AppText } from '@/ui/components/Text';
import { strings } from '@/ui/strings';
import { useToast } from '@/ui/toast';
import { spacing } from '@/ui/theme/tokens';

function optionLabel(question: QuestionKey, option: string): string {
  if (question === 'city') return cityLabels[option as keyof typeof cityLabels];
  if (question === 'intent') return datingIntentLabels[option as keyof typeof datingIntentLabels];
  return questionOptionLabels[option] ?? option;
}

const LAST = questionKeys.length - 1;

export default function QuestionnaireStep() {
  const router = useRouter();
  const flow = useStepGuard('questionnaire');
  const saveAnswer = useSaveAnswer();
  const complete = useCompleteOnboarding();
  const toast = useToast((s) => s.show);
  const t = strings.access.questionnaire;

  // The last answer is not saved on its own: it travels with the publish request so
  // the card and its final answer are stored together or not at all.
  const [lastAnswer, setLastAnswer] = useState<string | undefined>(undefined);
  const [index, setIndex] = useState<number | undefined>(undefined);
  const [missing, setMissing] = useState<QuestionKey | undefined>(undefined);
  const [idempotencyKey] = useState(newIdempotencyKey);

  const saved = flow.data?.answers;
  const answers: PartialAnswers = useMemo(
    () => ({ ...saved, ...(lastAnswer ? { [questionKeys[LAST]!]: lastAnswer } : {}) }),
    [saved, lastAnswer],
  );

  // Until the person navigates, resume at the first unanswered question.
  const firstOpen = questionKeys.findIndex((k) => !(k in (saved ?? {})));
  const current = index ?? (firstOpen === -1 ? LAST : firstOpen);
  const question = questionKeys[current]!;
  const value = answers[question] as string | undefined;
  const answeredCount = questionKeys.filter((k) => k in answers).length;
  const isLast = current === LAST;

  const choose = (answer: string) => {
    setMissing(undefined);
    if (isLast) {
      setLastAnswer(answer);
      return;
    }
    saveAnswer.mutate(
      { question, answer },
      { onSuccess: () => setIndex(Math.min(current + 1, LAST)) },
    );
  };

  const publish = () =>
    complete.mutate(
      { answers: { [questionKeys[LAST]!]: answers[questionKeys[LAST]!] }, idempotencyKey },
      {
        onSuccess: () => {
          toast(t.created);
          router.dismissTo('/');
        },
        onError: (error) => {
          if (!isRepositoryError(error) || !error.fieldErrors) return;
          const keys = Object.keys(error.fieldErrors);
          const profileField = keys.find((k) => k.startsWith('profile.'));
          if (profileField) {
            router.replace(`/access/profile?field=${profileField.slice(8)}` as Href);
            return;
          }
          const answerKey = keys
            .map((k) => k.replace('answers.', ''))
            .find((k): k is QuestionKey => (questionKeys as string[]).includes(k));
          if (answerKey) {
            setIndex(questionKeys.indexOf(answerKey));
            setMissing(answerKey);
          }
        },
      },
    );

  const failed =
    (saveAnswer.isError ? saveAnswer.error : undefined) ??
    (complete.isError && !(isRepositoryError(complete.error) && complete.error.fieldErrors)
      ? complete.error
      : undefined);

  return (
    <StepScreen
      step="questionnaire"
      title={t.title}
      testID="access-questionnaire"
      footer={
        <>
          {failed ? (
            <AppText tone="danger" role="alert">
              {accessErrorText(failed)}
            </AppText>
          ) : null}
          {isLast ? (
            <>
              {answeredCount < questionKeys.length ? (
                <AppText variant="caption" tone="textMuted" testID="questionnaire-remaining">
                  {t.remaining(questionKeys.length - answeredCount)}
                </AppText>
              ) : null}
              <PrimaryButton
                label={t.create}
                onPress={publish}
                disabled={answeredCount < questionKeys.length}
                loading={complete.isPending}
                testID="questionnaire-create"
              />
            </>
          ) : (
            <PrimaryButton
              label={t.next}
              onPress={() => setIndex(current + 1)}
              disabled={!value || saveAnswer.isPending}
              loading={saveAnswer.isPending}
              testID="questionnaire-next"
            />
          )}
          {current > 0 ? (
            <SecondaryButton
              label={t.previous}
              onPress={() => setIndex(current - 1)}
              testID="questionnaire-previous"
            />
          ) : null}
        </>
      }
    >
      <View style={{ gap: spacing.md }}>
        <AppText variant="caption" tone="textMuted" testID="questionnaire-progress">
          {t.progress(current + 1, questionKeys.length)}
        </AppText>
        <AppText variant="title" role="heading" testID="questionnaire-question">
          {questionLabels[question]}
        </AppText>
        <RadioGroup<string>
          key={question}
          label={questionLabels[question]}
          options={questionnaire[question].map((option) => ({
            value: option,
            label: optionLabel(question, option),
          }))}
          value={value ?? ''}
          onChange={choose}
          testID={`question-${question}`}
        />
        {missing === question ? (
          <AppText variant="caption" tone="danger" role="alert">
            {t.missing}
          </AppText>
        ) : null}
      </View>
    </StepScreen>
  );
}
