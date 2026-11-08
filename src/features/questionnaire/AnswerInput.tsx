import { useState } from 'react';
import { Modal, Pressable, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  answerLabel,
  INTEREST_OTHER_MAX,
  nationalityName,
  QUESTION_MAX,
  questionLabels,
  questionnaire,
  searchNationalities,
  type ChoiceQuestionKey,
  type QuestionKey,
} from '@/catalogs';
import { SettlementField } from '@/features/settlement/SettlementPicker';
import { Chip } from '@/ui/components/Chip';
import { PrimaryButton, TextButton } from '@/ui/components/buttons';
import { AppText } from '@/ui/components/Text';
import { Check, Search } from '@/ui/icons';
import { strings } from '@/ui/strings';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { minTouch, radius, spacing, typography } from '@/ui/theme/tokens';
import { createStyles } from '@/ui/theme/useStyles';

import { toggleHabit } from './rules';

const t = strings.questionnaireEdit;

type Props = {
  question: QuestionKey;
  value: string[];
  onChange: (value: string[]) => void;
  /** The question above the answer; the onboarding pages show it, the editor too. */
  showLabel?: boolean;
  error?: string;
  testID: string;
};

/**
 * One Анкета question: chips for its options (radio for one answer, checkboxes for several),
 * a searchable list for the Национальность, the places picker for «Где ты живёшь», a text
 * for «Свой вариант».
 */
export function AnswerInput({
  question,
  value,
  onChange,
  showLabel = false,
  error,
  testID,
}: Props) {
  const styles = useStyles();
  const label = showLabel ? (
    <AppText variant="bodyStrong" testID={`${testID}-label`}>
      {questionLabels[question]}
    </AppText>
  ) : null;
  const errorText = error ? (
    <AppText variant="caption" tone="danger" role="alert" testID={`${testID}-error`}>
      {error}
    </AppText>
  ) : null;

  if (question === 'city') {
    return (
      <View style={styles.field}>
        <SettlementField
          value={value}
          onChange={onChange}
          max={QUESTION_MAX.city}
          withCountries
          label={showLabel ? questionLabels.city : undefined}
          testID={testID}
        />
        {errorText}
      </View>
    );
  }
  if (question === 'nationality') {
    return (
      <View style={styles.field} testID={testID}>
        {label}
        <NationalityField value={value} onChange={onChange} testID={testID} />
        {errorText}
      </View>
    );
  }
  if (question === 'interestOther') {
    return (
      <View style={styles.field} testID={testID}>
        {label}
        <OtherInput value={value[0] ?? ''} onChange={(text) => onChange([text])} testID={testID} />
        {errorText}
      </View>
    );
  }
  return (
    <View style={styles.field} testID={testID}>
      {label}
      <Choices question={question} value={value} onChange={onChange} testID={testID} />
      {errorText}
    </View>
  );
}

function Choices({
  question,
  value,
  onChange,
  testID,
}: {
  question: ChoiceQuestionKey;
  value: string[];
  onChange: (value: string[]) => void;
  testID: string;
}) {
  const styles = useStyles();
  const max = QUESTION_MAX[question];
  // «Нет детей» is implied by «Нет» children; asked, the number is from 1 up.
  const options = (questionnaire[question] as readonly string[]).filter(
    (o) => question !== 'childrenCount' || o !== 'none',
  );
  const single = max === 1;
  const [full, setFull] = useState(false);
  const toggle = (option: string) => {
    setFull(false);
    if (question === 'habits') return onChange(toggleHabit(value, option));
    if (value.includes(option)) return onChange(value.filter((o) => o !== option));
    if (single) return onChange([option]);
    if (value.length >= max) return setFull(true);
    onChange([...value, option]);
  };
  const hint =
    question === 'habits'
      ? t.habitsHint
      : full
        ? strings.settlement.full(max)
        : single
          ? t.one
          : max < options.length
            ? strings.settlement.limit(max)
            : t.any;
  return (
    <>
      <AppText variant="caption" tone={full ? 'danger' : 'textMuted'} testID={`${testID}-hint`}>
        {hint}
      </AppText>
      <View role={single ? 'radiogroup' : 'group'} style={styles.chips}>
        {options.map((option) => (
          <Chip
            key={option}
            role={single ? 'radio' : 'checkbox'}
            label={answerLabel(question, option)}
            selected={value.includes(option)}
            onPress={() => toggle(option)}
            testID={`${testID}-${option}`}
          />
        ))}
      </View>
    </>
  );
}

function OtherInput({
  value,
  onChange,
  testID,
}: {
  value: string;
  onChange: (text: string) => void;
  testID: string;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={t.otherPlaceholder}
        placeholderTextColor={colors.textMuted}
        maxLength={INTEREST_OTHER_MAX}
        aria-label={t.otherLabel}
        style={styles.input}
        testID={`${testID}-input`}
      />
      <AppText variant="caption" tone="textMuted">
        {`${value.length} / ${INTEREST_OTHER_MAX}`}
      </AppText>
    </>
  );
}

/**
 * Национальность from the BNS list, picked from a searchable list: one for the Анкета, any
 * number for «Кого ищу».
 */
export function NationalityField({
  value,
  onChange,
  multiple = false,
  chooseLabel = t.nationalityChoose,
  testID,
}: {
  value: string[];
  onChange: (value: string[]) => void;
  multiple?: boolean;
  chooseLabel?: string;
  testID: string;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const list = searchNationalities(query);
  return (
    <>
      {value.length ? (
        <View style={styles.chips}>
          {value.map((code) => (
            <Chip
              key={code}
              role={multiple ? 'checkbox' : 'radio'}
              selected
              label={multiple ? `${nationalityName(code)} ✕` : nationalityName(code)}
              onPress={() => (multiple ? onChange(value.filter((c) => c !== code)) : setOpen(true))}
              testID={`${testID}-chosen-${code}`}
            />
          ))}
        </View>
      ) : null}
      <TextButton
        label={value.length ? t.nationalityChange : chooseLabel}
        onPress={() => {
          setQuery('');
          setOpen(true);
        }}
        testID={`${testID}-open`}
      />
      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <SafeAreaView edges={['top', 'bottom']} style={styles.root} testID={`${testID}-picker`}>
          <View style={styles.header}>
            <TextButton
              label={t.close}
              onPress={() => setOpen(false)}
              testID={`${testID}-picker-close`}
            />
            <AppText variant="bodyStrong" role="heading" style={styles.title}>
              {t.nationalityTitle}
            </AppText>
            <View style={styles.headerSpace} />
          </View>
          <View style={styles.search}>
            <Search size={18} color={colors.textMuted} aria-hidden />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={t.nationalitySearch}
              placeholderTextColor={colors.textMuted}
              aria-label={t.nationalitySearch}
              autoCorrect={false}
              style={styles.searchInput}
              testID={`${testID}-picker-search`}
            />
          </View>
          <ScrollView contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
            {list.length === 0 ? (
              <AppText tone="textMuted">{t.nationalityNothing}</AppText>
            ) : (
              list.map((n) => {
                const selected = value.includes(n.code);
                return (
                  <Pressable
                    key={n.code}
                    role={multiple ? 'checkbox' : 'radio'}
                    aria-checked={selected}
                    aria-label={n.name}
                    onPress={() => {
                      if (!multiple) {
                        onChange([n.code]);
                        setOpen(false);
                        return;
                      }
                      onChange(selected ? value.filter((c) => c !== n.code) : [...value, n.code]);
                    }}
                    style={({ pressed }) => [styles.row, pressed && styles.pressed]}
                    testID={`${testID}-picker-option-${n.code}`}
                  >
                    <AppText style={styles.grow}>{n.name}</AppText>
                    {selected ? <Check size={20} color={colors.text} aria-hidden /> : null}
                  </Pressable>
                );
              })
            )}
          </ScrollView>
          <View style={styles.footer}>
            <PrimaryButton
              label={t.done}
              onPress={() => setOpen(false)}
              testID={`${testID}-picker-done`}
            />
          </View>
        </SafeAreaView>
      </Modal>
    </>
  );
}

const useStyles = createStyles((colors) => ({
  field: { gap: spacing.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  input: {
    ...typography.body,
    minHeight: minTouch,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    color: colors.text,
  },
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  title: { flex: 1, textAlign: 'center' },
  headerSpace: { width: 72 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    minHeight: minTouch,
  },
  searchInput: { ...typography.body, flex: 1, color: colors.text, minHeight: minTouch },
  list: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, gap: 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: minTouch,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  pressed: { backgroundColor: colors.surfacePressed },
  grow: { flex: 1 },
  footer: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
}));
