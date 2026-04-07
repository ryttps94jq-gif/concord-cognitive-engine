'use client';

import { createContext } from 'react';
import type { Locale } from './index';

export interface I18nContextValue {
  /** Current active locale */
  locale: Locale;
  /** Whether the current locale is RTL */
  isRTL: boolean;
  /** Change the active locale */
  setLocale: (locale: Locale) => Promise<void>;
  /** Whether translations have been loaded */
  ready: boolean;
}

export const I18nContext = createContext<I18nContextValue | null>(null);
