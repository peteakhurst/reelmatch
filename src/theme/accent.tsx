import { createContext, ReactNode, useContext, useMemo, useState } from 'react';
import { ACCENTS, AccentName } from './tokens';

type AccentContextValue = {
  name: AccentName;
  hex: string;
  setAccent: (name: AccentName) => void;
};

const AccentContext = createContext<AccentContextValue | null>(null);

export function AccentProvider({
  children,
  initial = 'magenta',
}: {
  children: ReactNode;
  initial?: AccentName;
}) {
  const [name, setName] = useState<AccentName>(initial);
  const value = useMemo<AccentContextValue>(
    () => ({ name, hex: ACCENTS[name], setAccent: setName }),
    [name],
  );
  return <AccentContext.Provider value={value}>{children}</AccentContext.Provider>;
}

export function useAccent() {
  const ctx = useContext(AccentContext);
  if (!ctx) throw new Error('useAccent must be used inside AccentProvider');
  return ctx;
}
