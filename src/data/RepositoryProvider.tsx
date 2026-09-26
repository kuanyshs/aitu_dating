import { createContext, useContext, useState, type ReactNode } from 'react';

import { anchoredClock, type Clock } from '@/clock';
import type { AituRepository } from '@/contracts';
import { demoToolsEnabled } from '@/demo/flags';
import { createMockRepository, type DemoControls } from '@/repository/mock';
import { asyncStorageStore } from '@/storage/asyncStorage';

type DataContext = {
  repository: AituRepository;
  demo?: DemoControls;
  clock: Clock;
};

const Context = createContext<DataContext | null>(null);

type Props = {
  children: ReactNode;
  clock?: Clock;
};

/** Wires the app to the in-app mock backend, persisted in device storage. */
export function RepositoryProvider({ children, clock }: Props) {
  const [value] = useState<DataContext>(() => {
    const resolvedClock = clock ?? anchoredClock();
    const mock = createMockRepository({ clock: resolvedClock, store: asyncStorageStore });
    return { clock: resolvedClock, repository: mock, demo: mock };
  });
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

function useDataContext(): DataContext {
  const value = useContext(Context);
  if (!value) throw new Error('RepositoryProvider is missing');
  return value;
}

export function useRepository(): AituRepository {
  return useDataContext().repository;
}

/** Demo switches of the mock backend; undefined when demo tools are off in this build. */
export function useDemoControls(): DemoControls | undefined {
  const { demo } = useDataContext();
  return demoToolsEnabled ? demo : undefined;
}

/** The app clock; UI reads time only through it. */
export function useClock(): Clock {
  return useDataContext().clock;
}
