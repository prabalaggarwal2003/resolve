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
import {
  DEFAULT_ORG_TIMEZONE,
  formatOrgDate,
  formatOrgDateTime,
  formatOrgDateTimeShort,
  getOrgTimezone,
  setOrgTimezone,
  subscribeOrgTimezone,
  normalizeOrgTimezone,
  orgTodayYmd,
} from '@/lib/orgTimezone';

type OrgCurrencyContextValue = {
  currency: string;
  formatMoney: (
    amount: number | null | undefined,
    currency?: string | null,
    options?: { maximumFractionDigits?: number; minimumFractionDigits?: number }
  ) => string;
  refresh: () => Promise<void>;
};

type OrgTimezoneContextValue = {
  timezone: string;
  formatDate: typeof formatOrgDate;
  formatDateTime: typeof formatOrgDateTime;
  formatDateTimeShort: typeof formatOrgDateTimeShort;
  todayYmd: () => string;
  refresh: () => Promise<void>;
};

const OrgCurrencyContext = createContext<OrgCurrencyContextValue>({
  currency: DEFAULT_ORG_CURRENCY,
  formatMoney: formatOrgMoney,
  refresh: async () => undefined,
});

const OrgTimezoneContext = createContext<OrgTimezoneContextValue>({
  timezone: DEFAULT_ORG_TIMEZONE,
  formatDate: formatOrgDate,
  formatDateTime: formatOrgDateTime,
  formatDateTimeShort: formatOrgDateTimeShort,
  todayYmd: () => orgTodayYmd(),
  refresh: async () => undefined,
});

/** Loads org currency + timezone once and keeps both in sync. */
export function OrgCurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrency] = useState<string>(() => getOrgCurrency());
  const [timezone, setTimezoneState] = useState<string>(() => getOrgTimezone());

  const refresh = async () => {
    try {
      const res = await fetch(apiUrl('/organization'), { headers: authHeaders() });
      if (!res.ok) return;
      const data = await res.json();
      const nextCurrency = setOrgCurrency(data?.organization?.currency);
      const nextTimezone = setOrgTimezone(data?.organization?.timezone);
      setCurrency(nextCurrency);
      setTimezoneState(nextTimezone);
    } catch {
      /* keep cached */
    }
  };

  useEffect(() => {
    setCurrency(getOrgCurrency());
    setTimezoneState(getOrgTimezone());
    void refresh();
    const unsubCurrency = subscribeOrgCurrency((next) =>
      setCurrency(normalizeOrgCurrency(next))
    );
    const unsubTimezone = subscribeOrgTimezone((next) =>
      setTimezoneState(normalizeOrgTimezone(next))
    );
    return () => {
      unsubCurrency();
      unsubTimezone();
    };
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
      <OrgTimezoneContext.Provider
        value={{
          timezone,
          formatDate: (value, override, options) =>
            formatOrgDate(value, override || timezone, options),
          formatDateTime: (value, override, options) =>
            formatOrgDateTime(value, override || timezone, options),
          formatDateTimeShort: (value, override) =>
            formatOrgDateTimeShort(value, override || timezone),
          todayYmd: () => orgTodayYmd(timezone),
          refresh,
        }}
      >
        {children}
      </OrgTimezoneContext.Provider>
    </OrgCurrencyContext.Provider>
  );
}

export function useOrgCurrency() {
  return useContext(OrgCurrencyContext);
}

export function useOrgTimezone() {
  return useContext(OrgTimezoneContext);
}
