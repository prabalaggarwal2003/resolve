'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { apiUrl, authHeaders } from '@/lib/api';
import {
  DEFAULT_ORG_CURRENCY,
  formatOrgMoney,
  getOrgCurrency,
  setOrgCurrency,
  subscribeOrgCurrency,
  normalizeOrgCurrency,
} from '@/lib/orgCurrency';

type OrgCurrencyContextValue = {
  currency: string;
  formatMoney: (
    amount: number | null | undefined,
    currency?: string | null,
    options?: { maximumFractionDigits?: number; minimumFractionDigits?: number }
  ) => string;
  refresh: () => Promise<void>;
};

const OrgCurrencyContext = createContext<OrgCurrencyContextValue>({
  currency: DEFAULT_ORG_CURRENCY,
  formatMoney: formatOrgMoney,
  refresh: async () => undefined,
});

export function OrgCurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrency] = useState<string>(() => getOrgCurrency());

  const refresh = async () => {
    try {
      const res = await fetch(apiUrl('/organization'), { headers: authHeaders() });
      if (!res.ok) return;
      const data = await res.json();
      const next = setOrgCurrency(data?.organization?.currency);
      setCurrency(next);
    } catch {
      /* keep cached */
    }
  };

  useEffect(() => {
    setCurrency(getOrgCurrency());
    void refresh();
    return subscribeOrgCurrency((next) => setCurrency(normalizeOrgCurrency(next)));
  }, []);

  return (
    <OrgCurrencyContext.Provider
      value={{
        currency,
        formatMoney: (amount, override, options) =>
          formatOrgMoney(amount, override || currency, options),
        refresh,
      }}
    >
      {children}
    </OrgCurrencyContext.Provider>
  );
}

export function useOrgCurrency() {
  return useContext(OrgCurrencyContext);
}
