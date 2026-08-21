import { en, type Strings } from './en';

const dictionaries: Partial<Record<'en' | 'fr', Strings>> = { en };

export function t(lang: 'en' | 'fr' = 'en'): Strings {
  return dictionaries[lang] ?? en;
}
