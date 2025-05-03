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

// --- START OF GENERATED SpecificAppContent INTERFACE ---
/**
 * ВНИМАНИЕ: Этот интерфейс генерируется автоматически скриптом generate-specific-types.ts
 * Он отражает ТОЧНУЮ структуру вашего файла public/content/content.json.
 * ВСЕ поля считаются обязательными строками.
 * Не редактируйте этот интерфейс вручную, он будет перезаписан.
 */
export interface SpecificAppContent {
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
// --- END OF GENERATED SpecificAppContent INTERFACE ---
