import { useState } from 'react';
import { View } from 'react-native';

import {
  answerLabel,
  QUESTION_MAX,
  questionLabels,
  questionnaire,
  type ChoiceQuestionKey,
  type QuestionKey,
} from '@/catalogs';
import { SettlementField } from '@/features/settlement/SettlementPicker';
import { Chip } from '@/ui/components/Chip';
import { AppText } from '@/ui/components/Text';
import { strings } from '@/ui/strings';
import { spacing } from '@/ui/theme/tokens';

/**
 * One Анкета question: its options as chips (several where the question allows, with
 * «Выберите до N вариантов»), or the settlements picker for the Населённый пункт.
 */
export function AnswerInput({
  question,
  value,
  onChange,
  showLabel = false,
  testID,
}: {
  question: QuestionKey;
  value: string[];
  onChange: (value: string[]) => void;
  showLabel?: boolean;
  testID: string;
}) {
  const max = QUESTION_MAX[question];
  if (question === 'city') {
    return (
      <SettlementField
        value={value}
        onChange={onChange}
        max={max}
        allowNone
        label={showLabel ? questionLabels.city : undefined}
        testID={testID}
      />
    );
  }
  return (
    <Choices
      question={question}
      value={value}
      onChange={onChange}
      showLabel={showLabel}
      testID={testID}
    />
  );
}

function Choices({
  question,
  value,
  onChange,
  showLabel,
  testID,
}: {
  question: ChoiceQuestionKey;
  value: string[];
  onChange: (value: string[]) => void;
  showLabel: boolean;
  testID: string;
}) {
  const max = QUESTION_MAX[question];
  const options = questionnaire[question] as readonly string[];
  const [full, setFull] = useState(false);
  const toggle = (option: string) => {
    setFull(false);
    if (value.includes(option)) return onChange(value.filter((o) => o !== option));
    if (max === 1) return onChange([option]);
    if (value.length >= max) return setFull(true);
    onChange([...value, option]);
  };
  return (
    <View style={{ gap: spacing.xs }} testID={testID}>
      {showLabel ? <AppText variant="bodyStrong">{questionLabels[question]}</AppText> : null}
      <AppText variant="caption" tone={full ? 'danger' : 'textMuted'} testID={`${testID}-hint`}>
        {full
          ? strings.settlement.full(max)
          : max < options.length
            ? strings.settlement.limit(max)
            : strings.questionnaireEdit.any}
      </AppText>
      <View
        role={max === 1 ? 'radiogroup' : 'group'}
        style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}
      >
        {options.map((option) => (
          <Chip
            key={option}
            role={max === 1 ? 'radio' : 'checkbox'}
            label={answerLabel(question, option)}
            selected={value.includes(option)}
            onPress={() => toggle(option)}
            testID={`${testID}-${option}`}
          />
        ))}
      </View>
    </View>
  );
}
