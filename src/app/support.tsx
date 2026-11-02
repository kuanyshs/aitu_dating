import { SupportForm } from '@/features/support/SupportForm';
import { Screen } from '@/ui/components/Screen';
import { SheetHeader } from '@/ui/components/SheetHeader';
import { strings } from '@/ui/strings';

/** «Поддержка» from «Безопасность»: a new Обращение and «Мои обращения». */
export default function SupportScreen() {
  return (
    <Screen testID="screen-support" withTabBar={false}>
      <SheetHeader
        title={strings.support.title}
        closeLabel={strings.support.close}
        testID="support-close"
      />
      <SupportForm />
    </Screen>
  );
}
