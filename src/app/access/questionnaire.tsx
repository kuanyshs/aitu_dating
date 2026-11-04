import { useRouter, type Href } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { questionKeys, questionLabels, type QuestionKey } from '@/catalogs';
import { isRepositoryError, type PartialAnswers } from '@/contracts';
import { useCompleteOnboarding, useSaveAnswer } from '@/data/hooks';
import { StepScreen } from '@/features/access/StepScreen';
import { accessErrorText, newIdempotencyKey } from '@/features/access/steps';
import { useStepGuard } from '@/features/access/useStepGuard';
import { AnswerInput } from '@/features/questionnaire/AnswerInput';
import { PrimaryButton, SecondaryButton } from '@/ui/components/buttons';
import { AppText } from '@/ui/components/Text';
import { strings } from '@/ui/strings';
import { useToast } from '@/ui/toast';
import { spacing } from '@/ui/theme/tokens';

const LAST = questionKeys.length - 1;

export default function QuestionnaireStep() {
  const router = useRouter();
  const flow = useStepGuard('questionnaire');
  const saveAnswer = useSaveAnswer();
  const complete = useCompleteOnboarding();
  const toast = useToast((s) => s.show);
  const t = strings.access.questionnaire;

  // The answer being chosen. It is saved on «Далее»; the last one travels with the publish
  // request so the card and its final answer are stored together or not at all.
  const [draft, setDraft] = useState<{ question: QuestionKey; value: string[] }>();
  const [index, setIndex] = useState<number | undefined>(undefined);
  const [missing, setMissing] = useState<QuestionKey | undefined>(undefined);
  const [idempotencyKey] = useState(newIdempotencyKey);

  const saved = flow.data?.answers;
  const answers: PartialAnswers = useMemo(
    () => ({ ...saved, ...(draft ? { [draft.question]: draft.value } : {}) }),
    [saved, draft],
  );

  // Until the person navigates, resume at the first unanswered question.
  const firstOpen = questionKeys.findIndex((k) => !(k in (saved ?? {})));
  const current = index ?? (firstOpen === -1 ? LAST : firstOpen);
  const question = questionKeys[current]!;
  // The Населённый пункт starts from the Passport city; it may be left out.
  const passportCity = flow.data?.candidate?.city;
  const value: string[] =
    (answers[question] as string[] | undefined) ??
    (question === 'city' && passportCity ? [passportCity] : []);
  // The questions before the last one that are already saved.
  const answeredCount = questionKeys.slice(0, LAST).filter((k) => k in (saved ?? {})).length;
  const isLast = current === LAST;
  // Every question but the Населённый пункт needs at least one option.
  const ready = question === 'city' || value.length > 0;

  const choose = (next: string[]) => {
    setMissing(undefined);
    setDraft({ question, value: next });
  };

  const next = () => {
    if (!ready) return;
    saveAnswer.mutate(
      { question, answer: value },
      {
        onSuccess: () => {
          setDraft(undefined);
          setIndex(Math.min(current + 1, LAST));
        },
      },
    );
  };

  const publish = () =>
    complete.mutate(
      { answers: { [questionKeys[LAST]!]: value }, idempotencyKey },
      {
        onSuccess: () => {
          toast(t.created);
          router.replace('/access/welcome');
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
              {answeredCount < LAST ? (
                <AppText variant="caption" tone="textMuted" testID="questionnaire-remaining">
                  {t.remaining(LAST - answeredCount)}
                </AppText>
              ) : null}
              <PrimaryButton
                label={t.create}
                onPress={publish}
                disabled={answeredCount < LAST || !ready}
                loading={complete.isPending}
                testID="questionnaire-create"
              />
            </>
          ) : (
            <PrimaryButton
              label={t.next}
              onPress={next}
              disabled={!ready || saveAnswer.isPending}
              loading={saveAnswer.isPending}
              testID="questionnaire-next"
            />
          )}
          {current > 0 ? (
            <SecondaryButton
              label={t.previous}
              onPress={() => {
                setDraft(undefined);
                setIndex(current - 1);
              }}
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
        <AnswerInput
          key={question}
          question={question}
          value={value}
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
