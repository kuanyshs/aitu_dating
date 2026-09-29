import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import {
  cities,
  cityLabels,
  datingIntentLabels,
  datingIntents,
  interestLabels,
  interests,
  meetingFormatLabels,
  meetingFormats,
  meetingGoalLabels,
  meetingGoals,
  topicLabels,
  topics,
  type City,
  type DatingIntent,
  type Interest,
  type MeetingFormat,
  type MeetingGoal,
  type Topic,
} from '@/catalogs';
import type { SearchHit, SearchKind } from '@/contracts';
import { useSearch, useSession } from '@/data/hooks';
import { useClock } from '@/data/RepositoryProvider';
import { PlanRow } from '@/features/plan/PlanRow';
import { usePostActions } from '@/features/post/usePostActions';
import { AccessPrompt } from '@/ui/components/AccessPrompt';
import { Avatar } from '@/ui/components/Avatar';
import { AuthorRow } from '@/ui/components/AuthorRow';
import { IconAction, SecondaryButton, TextButton } from '@/ui/components/buttons';
import { Chip } from '@/ui/components/Chip';
import { FeedSkeleton } from '@/ui/components/FeedSkeleton';
import { PostRow } from '@/ui/components/PostRow';
import { RenewBanner } from '@/ui/components/RenewBanner';
import { Screen } from '@/ui/components/Screen';
import { EmptyState, ErrorState } from '@/ui/components/StateViews';
import { AppText } from '@/ui/components/Text';
import { Search as SearchIcon, X } from '@/ui/icons';
import { strings } from '@/ui/strings';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { radius, spacing, typography } from '@/ui/theme/tokens';
import { createStyles } from '@/ui/theme/useStyles';
import { useDebouncedValue } from '@/ui/useDebouncedValue';

const t = strings.search;
type Kind = SearchKind;
const kinds: Kind[] = ['people', 'posts', 'plans'];
const MAX_INTERESTS = 5;
const MAX_TOPICS = 4;

type PeopleFilters = { city?: City; interests: Interest[]; intent?: DatingIntent };
const noFilters: PeopleFilters = { interests: [] };

type PlanFilters = { city?: City; goal?: MeetingGoal; format?: MeetingFormat };

/**
 * Поиск: people (active members only), posts and plans (anyone who reads). The text
 * settles for 300 ms before a request; people without text or filters are those of one's
 * own city, plans without them are every open one.
 */
export default function SearchScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const session = useSession();
  const state = session.data?.accessState;
  const isMember = state === 'ACTIVE_MEMBER';
  // Guests and expired members start where they may search: among posts.
  const [chosen, setKind] = useState<Kind>();
  const kind: Kind = chosen ?? (isMember ? 'people' : 'posts');
  const [text, setText] = useState('');
  const [filters, setFilters] = useState<PeopleFilters>(noFilters);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [topicFilter, setTopicFilter] = useState<Topic[]>([]);
  const [planFilters, setPlanFilters] = useState<PlanFilters>({});
  const settled = useDebouncedValue(text.trim(), 300);

  const filterCount =
    kind === 'plans'
      ? Object.values(planFilters).filter(Boolean).length
      : (filters.city ? 1 : 0) + (filters.intent ? 1 : 0) + filters.interests.length;
  const pick = <K extends keyof PlanFilters>(key: K, value: PlanFilters[K]) =>
    setPlanFilters((f) => ({ ...f, [key]: f[key] === value ? undefined : value }));
  const toggle = <T,>(list: T[], item: T) =>
    list.includes(item) ? list.filter((i) => i !== item) : [...list, item];

  return (
    <Screen testID="screen-search">
      <AppText variant="display" role="heading">
        {t.title}
      </AppText>

      <View style={styles.field}>
        <SearchIcon size={18} color={colors.textMuted} aria-hidden />
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder={t.placeholder[kind]}
          placeholderTextColor={colors.textMuted}
          aria-label={t.inputLabel}
          returnKeyType="search"
          style={styles.input}
          testID="search-input"
        />
        {text ? (
          <IconAction
            icon={X}
            size={18}
            accessibilityLabel={t.clear}
            onPress={() => setText('')}
            testID="search-clear"
          />
        ) : null}
      </View>

      <View role="radiogroup" aria-label={t.kindsLabel} style={styles.row}>
        {kinds.map((k) => (
          <Chip
            key={k}
            label={t.kinds[k]}
            selected={k === kind}
            onPress={() => setKind(k)}
            testID={`search-kind-${k}`}
          />
        ))}
      </View>

      {(kind === 'people' && isMember) || kind === 'plans' ? (
        <View style={styles.filters}>
          <View style={styles.filterBar}>
            <TextButton
              label={filterCount ? t.filtersCount(filterCount) : t.filters}
              onPress={() => setFiltersOpen((open) => !open)}
              testID="search-filters"
            />
            {filterCount ? (
              <TextButton
                label={t.reset}
                onPress={() => (kind === 'plans' ? setPlanFilters({}) : setFilters(noFilters))}
                testID="search-reset"
              />
            ) : null}
          </View>
          {filtersOpen && kind === 'plans' ? (
            <View style={styles.filterPanel} testID="search-filter-panel">
              <FilterGroup title={t.city}>
                {cities.map((c) => (
                  <Chip
                    key={c}
                    label={cityLabels[c]}
                    selected={planFilters.city === c}
                    onPress={() => pick('city', c)}
                    testID={`search-plan-city-${c}`}
                  />
                ))}
              </FilterGroup>
              <FilterGroup title={t.goal}>
                {meetingGoals.map((g) => (
                  <Chip
                    key={g}
                    label={meetingGoalLabels[g]}
                    selected={planFilters.goal === g}
                    onPress={() => pick('goal', g)}
                    testID={`search-goal-${g}`}
                  />
                ))}
              </FilterGroup>
              <FilterGroup title={t.format}>
                {meetingFormats.map((f) => (
                  <Chip
                    key={f}
                    label={meetingFormatLabels[f]}
                    selected={planFilters.format === f}
                    onPress={() => pick('format', f)}
                    testID={`search-format-${f}`}
                  />
                ))}
              </FilterGroup>
            </View>
          ) : filtersOpen ? (
            <View style={styles.filterPanel} testID="search-filter-panel">
              <FilterGroup title={t.city}>
                {cities.map((c) => (
                  <Chip
                    key={c}
                    label={cityLabels[c]}
                    selected={filters.city === c}
                    onPress={() =>
                      setFilters((f) => ({ ...f, city: f.city === c ? undefined : c }))
                    }
                    testID={`search-city-${c}`}
                  />
                ))}
              </FilterGroup>
              <FilterGroup title={t.interests} hint={t.interestsHint}>
                {interests.map((i) => (
                  <Chip
                    key={i}
                    role="checkbox"
                    label={interestLabels[i]}
                    selected={filters.interests.includes(i)}
                    disabled={
                      !filters.interests.includes(i) && filters.interests.length >= MAX_INTERESTS
                    }
                    onPress={() => setFilters((f) => ({ ...f, interests: toggle(f.interests, i) }))}
                    testID={`search-interest-${i}`}
                  />
                ))}
              </FilterGroup>
              <FilterGroup title={t.intent}>
                {datingIntents.map((i) => (
                  <Chip
                    key={i}
                    label={datingIntentLabels[i]}
                    selected={filters.intent === i}
                    onPress={() =>
                      setFilters((f) => ({ ...f, intent: f.intent === i ? undefined : i }))
                    }
                    testID={`search-intent-${i}`}
                  />
                ))}
              </FilterGroup>
            </View>
          ) : null}
        </View>
      ) : null}

      {kind === 'posts' ? (
        <View style={styles.row} role="group" aria-label={t.topics}>
          {topics.map((topic) => (
            <Chip
              key={topic}
              role="checkbox"
              label={`#${topicLabels[topic]}`}
              selected={topicFilter.includes(topic)}
              disabled={!topicFilter.includes(topic) && topicFilter.length >= MAX_TOPICS}
              onPress={() => setTopicFilter((list) => toggle(list, topic))}
              testID={`search-topic-${topic}`}
            />
          ))}
        </View>
      ) : null}

      {kind === 'plans' ? (
        <PlanResults text={settled} filters={planFilters} />
      ) : kind === 'people' ? (
        isMember ? (
          <PeopleResults text={settled} filters={filters} nearby={!settled && !filterCount} />
        ) : state === 'ACTIVE_MEMBER_EXPIRED' ? (
          <View style={styles.locked} testID="search-people-locked">
            <AppText tone="textMuted">{t.peopleLocked}</AppText>
            <RenewBanner testID="search-renew" />
          </View>
        ) : state ? (
          <AccessPrompt text={t.peopleLocked} testID="search-access-prompt" />
        ) : null
      ) : (
        <PostResults text={settled} topics={topicFilter} />
      )}
    </Screen>
  );
}

function FilterGroup({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  const styles = useStyles();
  return (
    <View style={styles.group}>
      <AppText variant="bodyStrong">{title}</AppText>
      {hint ? (
        <AppText variant="caption" tone="textMuted">
          {hint}
        </AppText>
      ) : null}
      <View style={styles.row}>{children}</View>
    </View>
  );
}

type Results = ReturnType<typeof useSearch>;

/** The states every result list shares: loading, error, nothing found, «Показать ещё». */
function ResultStates({
  results,
  children,
}: {
  results: Results;
  children: (hits: SearchHit[]) => React.ReactNode;
}) {
  const hits = results.data?.pages.flatMap((p) => p.items) ?? [];
  if (results.isPending) return <FeedSkeleton rows={2} />;
  if (results.isError && hits.length === 0)
    return (
      <ErrorState
        testID="search-error"
        title={t.errorTitle}
        text={t.errorText}
        action={{ label: t.retry, onPress: () => results.refetch(), testID: 'search-retry' }}
      />
    );
  if (hits.length === 0)
    return <EmptyState testID="search-empty" title={t.emptyTitle} text={t.emptyText} />;
  return (
    <View testID="search-results">
      {children(hits)}
      {results.hasNextPage ? (
        <SecondaryButton
          label={t.more}
          loading={results.isFetchingNextPage}
          onPress={() => results.fetchNextPage()}
          testID="search-more"
        />
      ) : null}
    </View>
  );
}

function PeopleResults({
  text,
  filters,
  nearby,
}: {
  text: string;
  filters: PeopleFilters;
  nearby: boolean;
}) {
  const styles = useStyles();
  const router = useRouter();
  const results = useSearch(
    {
      kind: 'people',
      ...(text ? { text } : {}),
      ...(filters.city ? { city: filters.city } : {}),
      ...(filters.intent ? { intent: filters.intent } : {}),
      ...(filters.interests.length ? { interests: filters.interests } : {}),
    },
    true,
  );
  return (
    <View style={styles.results}>
      {nearby ? (
        <AppText variant="caption" tone="textMuted" testID="search-nearby">
          {t.nearby}
        </AppText>
      ) : null}
      <ResultStates results={results}>
        {(hits) =>
          hits.map((hit) =>
            hit.kind === 'person' && hit.person.view === 'member' ? (
              <Pressable
                key={hit.person.id}
                role="link"
                aria-label={strings.follows.openMember(hit.person.name)}
                onPress={() =>
                  router.push(`/member/${hit.person.view === 'member' ? hit.person.id : ''}`)
                }
                style={({ pressed }) => [styles.person, pressed && styles.pressed]}
                testID={`search-person-${hit.person.id}`}
              >
                <Avatar avatar={hit.person.avatar} size={40} />
                <View style={styles.grow}>
                  <AuthorRow author={hit.person} />
                  <AppText variant="caption" tone="textMuted" numberOfLines={1}>
                    {[
                      strings.follows.age(hit.person.age),
                      ...(hit.card?.interests ?? []).map((i) => interestLabels[i]),
                    ].join(' · ')}
                  </AppText>
                </View>
              </Pressable>
            ) : null,
          )
        }
      </ResultStates>
    </View>
  );
}

function PostResults({ text, topics: chosen }: { text: string; topics: Topic[] }) {
  const styles = useStyles();
  const clock = useClock();
  const { onAction, onOpen } = usePostActions();
  const ready = text.length >= 2 || chosen.length > 0;
  const results = useSearch(
    {
      kind: 'posts',
      ...(text ? { text } : {}),
      ...(chosen.length ? { topics: chosen } : {}),
    },
    ready,
  );
  if (!ready)
    return (
      <AppText tone="textMuted" testID="search-hint">
        {t.hint}
      </AppText>
    );
  return (
    <View style={[styles.results, styles.posts]}>
      <ResultStates results={results}>
        {(hits) =>
          hits.map((hit) =>
            hit.kind === 'post' ? (
              <PostRow
                key={hit.post.id}
                post={hit.post}
                clock={clock}
                onAction={onAction}
                onOpen={onOpen}
              />
            ) : null,
          )
        }
      </ResultStates>
    </View>
  );
}

function PlanResults({ text, filters }: { text: string; filters: PlanFilters }) {
  const styles = useStyles();
  const results = useSearch(
    {
      kind: 'plans',
      ...(text ? { text } : {}),
      ...(filters.city ? { city: filters.city } : {}),
      ...(filters.goal ? { goal: filters.goal } : {}),
      ...(filters.format ? { format: filters.format } : {}),
    },
    true,
  );
  return (
    <View style={styles.results}>
      <AppText variant="caption" tone="textMuted">
        {t.plansNote}
      </AppText>
      <ResultStates results={results}>
        {(hits) => (
          <View style={styles.plans}>
            {hits.map((hit) =>
              hit.kind === 'plan' ? (
                <PlanRow key={hit.plan.id} plan={hit.plan} testID={`search-plan-${hit.plan.id}`} />
              ) : null,
            )}
          </View>
        )}
      </ResultStates>
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingLeft: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.bg,
    minHeight: 48,
  },
  input: {
    ...typography.body,
    flex: 1,
    color: colors.text,
    paddingVertical: spacing.sm,
    // The field draws its own border; the browser's focus box would double it.
    outlineStyle: 'solid',
    outlineWidth: 0,
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  filters: { gap: spacing.sm },
  filterBar: { flexDirection: 'row', justifyContent: 'space-between', marginLeft: -spacing.sm },
  filterPanel: {
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
  },
  group: { gap: spacing.xs },
  locked: { gap: spacing.md },
  results: { gap: spacing.xs },
  plans: { gap: spacing.sm },
  // Post rows carry their own side padding, as in the feed: span the screen's padding.
  posts: { marginHorizontal: -spacing.lg },
  person: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  pressed: { backgroundColor: colors.surfacePressed },
  grow: { flex: 1, gap: 2 },
}));
