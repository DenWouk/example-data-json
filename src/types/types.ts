// src/types/types.ts

// --- УДАЛЕНЫ общие типы AppContent, PageData, SectionContent ---
// --- УДАЛЕНЫ общие типы PageKey, SectionKey, FieldKey ---

// --- START OF GENERATED SpecificAppContent INTERFACE ---
/**
 * ВНИМАНИЕ: Этот интерфейс генерируется автоматически скриптом generate-specific-types.ts
 * Он отражает ТОЧНУЮ структуру вашего файла public/content/content.json.
 * ВСЕ поля считаются обязательными строками.
 * Не редактируйте этот интерфейс вручную, он будет перезаписан.
 */

// --- END OF GENERATED SpecificAppContent INTERFACE ---

// --- Тип для ключей страниц, основанный на SpecificAppContent ---
export type PageKey = keyof AppContent;

// --- Тип для ключей секций внутри КОНКРЕТНОЙ страницы ---
// Пример: SectionKeyForPage<'home'> будет 'section1' | 'section2'
export type SectionKeyForPage<P extends PageKey> = keyof AppContent[P];

// --- Тип для ключей полей внутри КОНКРЕТНОЙ секции КОНКРЕТНОЙ страницы ---
// Пример: FieldKeyForSection<'home', 'section1'> будет 'title' | 'description1' | 'image1' | 'image2'
export type FieldKeyForSection<
  P extends PageKey,
  S extends SectionKeyForPage<P>
> = keyof AppContent[P][S];

// --- Тип для данных ОДНОЙ секции (все еще полезен для формы админки) ---
// Используем Record<string, string> вместо SectionContent
export type SectionDataType = Record<string, string>;

// --- START OF GENERATED AppContent INTERFACE ---
/**
 * ВНИМАНИЕ: Этот интерфейс генерируется автоматически скриптом generate-types.ts
 * Он отражает ТОЧНУЮ структуру вашего файла public/content/content.json.
 * ВСЕ поля считаются обязательными строками.
 * Не редактируйте этот интерфейс вручную, он будет перезаписан.
 */
export interface AppContent {
  "home": {
    "section1": {
      "title": string;
      "description1": string;
      "image1": string;
      "image2": string;
      "image3": string;
    };
    "section2": {
      "title": string;
      "description1": string;
      "image1": string;
    };
  };
  "about": {
    "section1": {
      "title": string;
      "description1": string;
      "description2": string;
      "description3": string;
      "image1": string;
      "image2": string;
    };
  };
}
// --- END OF GENERATED AppContent INTERFACE ---
