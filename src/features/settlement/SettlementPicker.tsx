import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  districtsOf,
  regions,
  searchSettlements,
  settlementByCode,
  settlementsOf,
  type Settlement,
} from '@/catalogs';
import { Chip } from '@/ui/components/Chip';
import { IconAction, PrimaryButton, TextButton } from '@/ui/components/buttons';
import { AppText } from '@/ui/components/Text';
import { Check, ChevronLeft, ChevronRight, Search } from '@/ui/icons';
import { strings } from '@/ui/strings';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { minTouch, radius, spacing, typography } from '@/ui/theme/tokens';
import { createStyles } from '@/ui/theme/useStyles';

const t = strings.settlement;

/** «село, Абайский район, область Абай». */
export function settlementPlace(s: Settlement): string {
  return t.place(t.kind[s.kind], s.district?.name, s.region.name);
}

type Props = {
  value: string[];
  onChange: (codes: string[]) => void;
  /** How many may be chosen; one replaces the previous choice. */
  max: number;
  /** Offers «Не указывать», which clears the choice. */
  allowNone?: boolean;
  label?: string;
  testID: string;
};

/**
 * A Населённый пункт from the KATO directory: the chosen ones as chips, and a full-screen
 * picker with search by name and a region → district → settlement browser. There is no
 * flat list of all 9 789 places.
 */
export function SettlementField({ value, onChange, max, allowNone, label, testID }: Props) {
  const styles = useStyles();
  const [open, setOpen] = useState(false);
  const chosen = value.map((code) => settlementByCode(code)).filter((s) => !!s) as Settlement[];
  return (
    <View style={styles.field} testID={testID}>
      {label ? <AppText variant="bodyStrong">{label}</AppText> : null}
      {max > 1 ? (
        <AppText variant="caption" tone="textMuted">
          {t.limit(max)}
        </AppText>
      ) : null}
      {chosen.length ? (
        <View style={styles.chips}>
          {chosen.map((s) => (
            <Chip
              key={s.code}
              role="checkbox"
              selected
              label={`${s.name} ✕`}
              onPress={() => onChange(value.filter((c) => c !== s.code))}
              testID={`${testID}-chosen-${s.code}`}
            />
          ))}
        </View>
      ) : allowNone ? (
        <AppText tone="textMuted" testID={`${testID}-none`}>
          {t.noneChosen}
        </AppText>
      ) : null}
      <TextButton
        label={chosen.length ? t.change : t.choose}
        onPress={() => setOpen(true)}
        testID={`${testID}-open`}
      />
      <SettlementPicker
        visible={open}
        value={value}
        max={max}
        allowNone={allowNone}
        onClose={() => setOpen(false)}
        onDone={(codes) => {
          onChange(codes);
          setOpen(false);
        }}
        testID={`${testID}-picker`}
      />
    </View>
  );
}

function SettlementPicker({
  visible,
  value,
  max,
  allowNone,
  onClose,
  onDone,
  testID,
}: {
  visible: boolean;
  value: string[];
  max: number;
  allowNone?: boolean;
  onClose: () => void;
  onDone: (codes: string[]) => void;
  testID: string;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [draft, setDraft] = useState<string[]>(value);
  const [query, setQuery] = useState('');
  const [region, setRegion] = useState<string>();
  const [district, setDistrict] = useState<string>();
  const [warning, setWarning] = useState(false);

  // Each opening starts from what is chosen now.
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      setDraft(value);
      setQuery('');
      setRegion(undefined);
      setDistrict(undefined);
      setWarning(false);
    }
  }

  const results = useMemo(() => searchSettlements(query), [query]);
  const searching = query.trim().length >= 2;
  const regionItem = regions.find((r) => r.code === region);
  const districtList = useMemo(() => (region ? districtsOf(region) : []), [region]);
  const browse = useMemo(
    () =>
      district
        ? settlementsOf({ district })
        : region && districtList.length === 0
          ? settlementsOf({ region })
          : [],
    [district, region, districtList.length],
  );

  const toggle = (code: string) => {
    setWarning(false);
    if (draft.includes(code)) return setDraft(draft.filter((c) => c !== code));
    if (max === 1) return setDraft([code]);
    if (draft.length >= max) return setWarning(true);
    setDraft([...draft, code]);
  };

  const back = () => (district ? setDistrict(undefined) : setRegion(undefined));

  const row = (s: Settlement) => {
    const selected = draft.includes(s.code);
    return (
      <Pressable
        key={s.code}
        role={max === 1 ? 'radio' : 'checkbox'}
        aria-checked={selected}
        aria-label={`${s.name}, ${settlementPlace(s)}`}
        onPress={() => toggle(s.code)}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
        testID={`${testID}-option-${s.code}`}
      >
        <View style={styles.grow}>
          <AppText variant="bodyStrong">{s.name}</AppText>
          <AppText variant="caption" tone="textMuted">
            {settlementPlace(s)}
          </AppText>
        </View>
        {selected ? <Check size={20} color={colors.text} aria-hidden /> : null}
      </Pressable>
    );
  };

  const nav = (key: string, title: string, onPress: () => void) => (
    <Pressable
      key={key}
      role="button"
      aria-label={title}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      testID={`${testID}-browse-${key}`}
    >
      <AppText style={styles.grow}>{title}</AppText>
      <ChevronRight size={18} color={colors.textMuted} aria-hidden />
    </Pressable>
  );

  let body: React.ReactNode;
  if (searching) {
    body = results.length ? (
      results.map(row)
    ) : (
      <AppText tone="textMuted" testID={`${testID}-nothing`}>
        {t.nothing}
      </AppText>
    );
  } else if (!region) {
    body = (
      <>
        <AppText variant="caption" tone="textMuted">
          {t.regions}
        </AppText>
        {regions.map((r) => nav(r.code, r.name, () => setRegion(r.code)))}
      </>
    );
  } else if (!district && districtList.length) {
    body = districtList.map((d) => nav(d.code, d.name, () => setDistrict(d.code)));
  } else {
    body = browse.map(row);
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView edges={['top', 'bottom']} style={styles.root} testID={testID}>
        <View style={styles.header}>
          <TextButton label={t.close} onPress={onClose} testID={`${testID}-close`} />
          <AppText variant="bodyStrong" role="heading" style={styles.title}>
            {t.title}
          </AppText>
          <View style={styles.headerSpace} />
        </View>
        <View style={styles.search}>
          <Search size={18} color={colors.textMuted} aria-hidden />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t.searchPlaceholder}
            placeholderTextColor={colors.textMuted}
            aria-label={t.searchLabel}
            autoCorrect={false}
            style={styles.input}
            testID={`${testID}-search`}
          />
        </View>
        {max > 1 ? (
          <AppText variant="caption" tone={warning ? 'danger' : 'textMuted'} style={styles.hint}>
            {warning ? t.full(max) : t.limit(max)}
          </AppText>
        ) : null}
        {!searching && region ? (
          <View style={styles.crumbs}>
            <IconAction
              icon={ChevronLeft}
              accessibilityLabel={t.back}
              onPress={back}
              testID={`${testID}-back`}
            />
            <AppText variant="bodyStrong" style={styles.grow}>
              {district ? districtList.find((d) => d.code === district)?.name : regionItem?.name}
            </AppText>
          </View>
        ) : null}
        <ScrollView contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
          {allowNone && !searching && !region ? (
            <Pressable
              role="radio"
              aria-checked={draft.length === 0}
              onPress={() => setDraft([])}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              testID={`${testID}-none`}
            >
              <AppText style={styles.grow}>{t.none}</AppText>
              {draft.length === 0 ? <Check size={20} color={colors.text} aria-hidden /> : null}
            </Pressable>
          ) : null}
          {body}
        </ScrollView>
        <View style={styles.footer}>
          <PrimaryButton label={t.done} onPress={() => onDone(draft)} testID={`${testID}-done`} />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const useStyles = createStyles((colors) => ({
  field: { gap: spacing.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
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
  input: { ...typography.body, flex: 1, color: colors.text, minHeight: minTouch },
  hint: { marginHorizontal: spacing.lg, marginTop: spacing.xs },
  crumbs: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    marginTop: spacing.xs,
  },
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
