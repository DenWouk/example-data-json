export interface SectionContent {
  [fieldKey: string]: string;
}

export interface PageData {
  [sectionKey: string]: SectionContent; // Ключи и структура секций динамические
}

export interface AppContent {
  [pageKey: string]: PageData;
}

/** Ключи страниц (home, about, ...), получаемые из AppContent */
export type PageKey = keyof AppContent;

/** Ключи секций внутри страницы */
export type SectionKey<P extends PageKey> = keyof AppContent[P];

/** Ключи полей внутри секции */
export type FieldKey<
  P extends PageKey,
  S extends SectionKey<P>
> = keyof AppContent[P][S];
