// Bundled translations (synchronous, so startup never waits on them). English is the source in en.ts.
// Made by StarNet Luna (gpt-6-luna) from en.ts; i18n.test.ts checks keys and placeholders.
import type { Catalog, Lang } from './core.ts';
import es from './locales/es.json';
import fr from './locales/fr.json';
import de from './locales/de.json';
import it from './locales/it.json';
import pt from './locales/pt.json';
import nl from './locales/nl.json';
import ja from './locales/ja.json';
import ko from './locales/ko.json';
import zh from './locales/zh.json';
import hi from './locales/hi.json';
import id from './locales/id.json';
import tr from './locales/tr.json';
import pl from './locales/pl.json';

export const CATALOGS: Partial<Record<Lang, Catalog>> = { es, fr, de, it, pt, nl, ja, ko, zh, hi, id, tr, pl } as Partial<Record<Lang, Catalog>>;
