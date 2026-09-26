import { createContext, useContext, useState, type ReactNode } from 'react';

import { anchoredClock, type Clock } from '@/clock';
import type { AituRepository } from '@/contracts';
import { createMockRepository } from '@/repository/mock';

type DataContext = { repository: AituRepository; clock: Clock };

const Context = createContext<DataContext | null>(null);

type Props = {
  children: ReactNode;
  /** Injected in tests; the app defaults to the in-app mock backend. */
  repository?: AituRepository;
  clock?: Clock;
};

export function RepositoryProvider({ children, repository, clock }: Props) {
  const [value] = useState<DataContext>(() => {
    const resolvedClock = clock ?? anchoredClock();
    return {
      clock: resolvedClock,
      repository: repository ?? createMockRepository({ clock: resolvedClock }),
    };
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

/** The app clock; UI reads time only through it. */
export function useClock(): Clock {
  return useDataContext().clock;
}
