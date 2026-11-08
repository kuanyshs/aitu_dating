import { useRouter, type Href } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { questionnairePageLabels, questionnairePages, type QuestionKey } from '@/catalogs';
import { isRepositoryError, type PartialAnswers } from '@/contracts';
import { useCompleteOnboarding, useSaveAnswers } from '@/data/hooks';
import { StepScreen } from '@/features/access/StepScreen';
import { accessErrorText, newIdempotencyKey } from '@/features/access/steps';
import { useStepGuard } from '@/features/access/useStepGuard';
import { QuestionnairePage } from '@/features/questionnaire/QuestionnairePage';
import { asAnswers, isPageReady, pageAnswers, type Answers } from '@/features/questionnaire/rules';
import { PrimaryButton, SecondaryButton } from '@/ui/components/buttons';
import { AppText } from '@/ui/components/Text';
import { strings } from '@/ui/strings';
import { useToast } from '@/ui/toast';
import { spacing } from '@/ui/theme/tokens';

const LAST = questionnairePages.length - 1;
const errorText = strings.questionnaireEdit.errors;

/**
 * The Анкета «Вопросы о тебе» in six pages by topic. Each page is saved on «Далее»; the
 * last one travels with the publish request, so the card and its final answers are stored
 * together or not at all.
 */
export default function QuestionnaireStep() {
  const router = useRouter();
  const flow = useStepGuard('questionnaire');
  const saveAnswers = useSaveAnswers();
  const complete = useCompleteOnboarding();
  const toast = useToast((s) => s.show);
  const t = strings.access.questionnaire;

  const [draft, setDraft] = useState<Answers>({});
  const [index, setIndex] = useState<number | undefined>(undefined);
  const [errors, setErrors] = useState<Partial<Record<QuestionKey, string>>>({});
  const [idempotencyKey] = useState(newIdempotencyKey);

  const saved = asAnswers(flow.data?.answers);
  const passportCity = flow.data?.candidate?.city;
  // The Passport city is the first suggestion of «Где ты живёшь».
  const answers: Answers = useMemo(
    () => ({
      ...(passportCity && !saved.city ? { city: [passportCity] } : {}),
      ...saved,
      ...draft,
    }),
    [saved, draft, passportCity],
  );

  const done = (i: number) => isPageReady(questionnairePages[i]!.questions, saved);
  // Until the person navigates, resume at the first page not saved yet.
  const firstOpen = questionnairePages.findIndex((_, i) => !done(i));
  const current = index ?? (firstOpen === -1 ? LAST : firstOpen);
  const page = questionnairePages[current]!;
  const ready = isPageReady(page.questions, answers);
  const isLast = current === LAST;
  const savedPages = questionnairePages.slice(0, LAST).filter((_, i) => done(i)).length;

  const showErrors = (fieldErrors: Record<string, string>) => {
    const next: Partial<Record<QuestionKey, string>> = {};
    for (const [key, code] of Object.entries(fieldErrors)) {
      if (key.startsWith('answers.')) next[key.slice(8) as QuestionKey] = errorText[code] ?? code;
    }
    setErrors(next);
    return next;
  };

  const next = () => {
    if (!ready) return;
    saveAnswers.mutate(
      { answers: pageAnswers(page.questions, answers) },
      {
        onSuccess: () => {
          setDraft({});
          setErrors({});
          setIndex(Math.min(current + 1, LAST));
        },
        onError: (error) => {
          if (isRepositoryError(error) && error.fieldErrors) showErrors(error.fieldErrors);
        },
      },
    );
  };

  const publish = () =>
    complete.mutate(
      { answers: pageAnswers(page.questions, answers) as PartialAnswers, idempotencyKey },
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
          const wrong = showErrors(error.fieldErrors);
          const pageOf = questionnairePages.findIndex((p) => p.questions.some((q) => q in wrong));
          if (pageOf >= 0) setIndex(pageOf);
        },
      },
    );

  const failed =
    (saveAnswers.isError && !(isRepositoryError(saveAnswers.error) && saveAnswers.error.fieldErrors)
      ? saveAnswers.error
      : undefined) ??
    (complete.isError && !(isRepositoryError(complete.error) && complete.error.fieldErrors)
      ? complete.error
      : undefined);
  const candidate = flow.data?.candidate;

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
              {savedPages < LAST ? (
                <AppText variant="caption" tone="textMuted" testID="questionnaire-remaining">
                  {t.remaining(LAST - savedPages)}
                </AppText>
              ) : null}
              <PrimaryButton
                label={t.create}
                onPress={publish}
                disabled={savedPages < LAST || !ready}
                loading={complete.isPending}
                testID="questionnaire-create"
              />
            </>
          ) : (
            <PrimaryButton
              label={t.next}
              onPress={next}
              disabled={!ready || saveAnswers.isPending}
              loading={saveAnswers.isPending}
              testID="questionnaire-next"
            />
          )}
          {current > 0 ? (
            <SecondaryButton
              label={t.previous}
              onPress={() => {
                setDraft({});
                setErrors({});
                setIndex(current - 1);
              }}
              testID="questionnaire-previous"
            />
          ) : null}
        </>
      }
    >
      <View style={{ gap: spacing.md }}>
        {current === 0 ? (
          <AppText tone="textMuted" testID="questionnaire-intro">
            {t.intro}
          </AppText>
        ) : null}
        <AppText variant="caption" tone="textMuted" testID="questionnaire-progress">
          {t.progress(current + 1, questionnairePages.length)}
        </AppText>
        <AppText variant="title" role="heading" testID="questionnaire-page">
          {questionnairePageLabels[page.key]}
        </AppText>
        <QuestionnairePage
          key={page.key}
          questions={page.questions}
          answers={answers}
          onChange={(next) => {
            setErrors({});
            setDraft((d) => ({ ...d, ...diff(answers, next) }));
          }}
          passport={
            current === 0 && candidate
              ? { gender: candidate.gender, age: candidate.age }
              : undefined
          }
          errors={errors}
          testID={`questionnaire-${page.key}`}
        />
      </View>
    </StepScreen>
  );
}

/** What changed between two sets of answers, removed answers included as undefined. */
function diff(before: Answers, after: Answers): Answers {
  const changed: Answers = {};
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]) as Set<QuestionKey>;
  for (const key of keys) {
    if (before[key] !== after[key]) changed[key] = after[key];
  }
  return changed;
}
