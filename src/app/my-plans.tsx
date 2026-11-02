import { useLocalSearchParams } from 'expo-router';

import { useSession } from '@/data/hooks';
import { MyPlans } from '@/features/profile/MyPlans';
import { Screen } from '@/ui/components/Screen';
import { SheetHeader } from '@/ui/components/SheetHeader';
import { strings } from '@/ui/strings';

const t = strings.profileSections;

/** «Мои планы» and «Мои отклики», opened from the own profile on the chosen tab. */
export default function MyPlansScreen() {
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  const expired = useSession().data?.accessState === 'ACTIVE_MEMBER_EXPIRED';
  const responses = tab === 'responses';
  return (
    <Screen testID="screen-my-plans" withTabBar={false}>
      <SheetHeader
        title={responses ? t.responses : t.plans}
        closeLabel={t.close}
        testID="my-plans-close"
      />
      <MyPlans canCreate={!expired} initialTab={responses ? 'responses' : 'plans'} />
    </Screen>
  );
}
