import { useContext } from 'react';
import { I18nContext } from './I18nContext';

export function useTranslation() {
  const context = useContext(I18nContext);

  if (!context) {
    throw new Error('useTranslation deve ser usado dentro de um I18nProvider');
  }

  return context;
}
