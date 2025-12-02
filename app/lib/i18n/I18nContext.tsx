import { createContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import ptBR from './locales/pt-BR.json';

export type Locale = 'pt-BR';

interface Translations {
  [key: string]: any;
}

interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, defaultValue?: string) => string;
  translations: Translations;
}

export const I18nContext = createContext<I18nContextType | undefined>(undefined);

const localesMap: Record<Locale, Translations> = {
  'pt-BR': ptBR,
};

function getNestedValue(obj: any, path: string): string {
  const keys = path.split('.');
  let value = obj;

  for (const key of keys) {
    if (value && typeof value === 'object' && key in value) {
      value = value[key];
    } else {
      return path;
    }
  }

  return typeof value === 'string' ? value : path;
}

interface I18nProviderProps {
  children: ReactNode;
  defaultLocale?: Locale;
}

export function I18nProvider({ children, defaultLocale = 'pt-BR' }: I18nProviderProps) {
  const [locale, setLocale] = useState<Locale>(defaultLocale);

  const value = useMemo<I18nContextType>(() => {
    const translations = localesMap[locale];

    return {
      locale,
      setLocale,
      t: (key: string, defaultValue?: string) => {
        const value = getNestedValue(translations, key);
        if (value === key && defaultValue) {
          return defaultValue;
        }
        return value;
      },
      translations,
    };
  }, [locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
