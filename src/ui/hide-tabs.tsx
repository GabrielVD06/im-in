import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

const HideTabsContext = createContext<(hidden: boolean) => void>(() => {});

export function HideTabsProvider({ children }: { children: (hidden: boolean) => ReactNode }) {
  const [hidden, setHidden] = useState(false);
  return <HideTabsContext.Provider value={setHidden}>{children(hidden)}</HideTabsContext.Provider>;
}

export function useHideTabs(hidden: boolean) {
  const setHidden = useContext(HideTabsContext);
  useEffect(() => {
    setHidden(hidden);
    return () => setHidden(false);
  }, [hidden, setHidden]);
}
