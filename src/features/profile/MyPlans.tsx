import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { useMyPlans, useMyResponses } from '@/data/hooks';
import { SecondaryButton } from '@/ui/components/buttons';
import { Chip } from '@/ui/components/Chip';
import { FeedSkeleton } from '@/ui/components/FeedSkeleton';
import { PlanRow } from '@/features/plan/PlanRow';
import { EmptyState, ErrorState } from '@/ui/components/StateViews';
import { AppText } from '@/ui/components/Text';
import { strings } from '@/ui/strings';
import { spacing } from '@/ui/theme/tokens';
import { createStyles } from '@/ui/theme/useStyles';

const t = strings.myPlans;
type Tab = 'plans' | 'responses';
const tabs: Tab[] = ['plans', 'responses'];

/**
 * «Встречи» on the Profile tab: the member's own plans (upcoming first) and the plans
 * they responded to, each with its status. A row opens the plan.
 */
export function MyPlans({ canCreate }: { canCreate: boolean }) {
  const styles = useStyles();
  const [tab, setTab] = useState<Tab>('plans');
  return (
    <View style={styles.section} testID="my-plans">
      <AppText variant="title" role="heading">
        {t.title}
      </AppText>
      <View role="radiogroup" aria-label={t.tabsLabel} style={styles.tabs}>
        {tabs.map((item) => (
          <Chip
            key={item}
            label={t.tabs[item]}
            selected={item === tab}
            onPress={() => setTab(item)}
            testID={`my-plans-tab-${item}`}
          />
        ))}
      </View>
      {tab === 'plans' ? <OwnPlans canCreate={canCreate} /> : <OwnResponses />}
    </View>
  );
}

function OwnPlans({ canCreate }: { canCreate: boolean }) {
  const router = useRouter();
  const list = useMyPlans(true);
  const items = list.data?.pages.flatMap((p) => p.items) ?? [];
  return (
    <ListBody
      list={list}
      empty={
        items.length === 0 ? (
          <EmptyState
            testID="my-plans-empty"
            title={t.plansEmptyTitle}
            text={t.plansEmptyText}
            action={
              canCreate
                ? {
                    label: t.create,
                    onPress: () => router.push('/plan/new'),
                    testID: 'my-plans-create',
                  }
                : undefined
            }
          />
        ) : null
      }
    >
      {items.map((plan) => (
        <PlanRow key={plan.id} plan={plan} testID={`my-plan-${plan.id}`} />
      ))}
    </ListBody>
  );
}

function OwnResponses() {
  const list = useMyResponses(true);
  const items = list.data?.pages.flatMap((p) => p.items) ?? [];
  return (
    <ListBody
      list={list}
      empty={
        items.length === 0 ? (
          <EmptyState
            testID="my-responses-empty"
            title={t.responsesEmptyTitle}
            text={t.responsesEmptyText}
          />
        ) : null
      }
    >
      {items.map(({ response, plan }) => (
        <PlanRow
          key={response.id}
          plan={plan}
          note={t.responseStatus[response.status]}
          testID={`my-plan-${plan.id}`}
        />
      ))}
    </ListBody>
  );
}

type List = ReturnType<typeof useMyPlans> | ReturnType<typeof useMyResponses>;

function ListBody({
  list,
  empty,
  children,
}: {
  list: List;
  empty: React.ReactNode;
  children: React.ReactNode;
}) {
  const styles = useStyles();
  if (list.isPending) return <FeedSkeleton rows={1} />;
  if (list.isError && !list.data)
    return (
      <ErrorState
        testID="my-plans-error"
        title={t.errorTitle}
        text={t.errorText}
        action={{ label: t.retry, onPress: () => list.refetch(), testID: 'my-plans-retry' }}
      />
    );
  if (empty) return empty;
  return (
    <View style={styles.list}>
      {children}
      {list.hasNextPage ? (
        <SecondaryButton
          label={t.more}
          loading={list.isFetchingNextPage}
          onPress={() => list.fetchNextPage()}
          testID="my-plans-more"
        />
      ) : null}
    </View>
  );
}

const useStyles = createStyles(() => ({
  section: { gap: spacing.sm, marginTop: spacing.xl },
  tabs: { flexDirection: 'row', gap: spacing.xs },
  list: { gap: spacing.sm },
}));
