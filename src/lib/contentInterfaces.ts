// src/lib/contentInterfaces.ts

/**
 * Контент внутри одной секции.
 * Все значения - ОБЯЗАТЕЛЬНЫЕ строки.
 */
export interface SectionContent {
  [fieldKey: string]: string; // Всегда string, без undefined или null
}

/**
 * Контент одной страницы, состоящий из секций.
 * Секции и поля внутри них могут различаться.
 */
export interface PageData {
  [sectionKey: string]: SectionContent; // Ключи и структура секций динамические
}

/**
 * Весь контент приложения.
 * Ключи и структура страниц динамические.
 */
export interface AppContent {
  [pageKey: string]: PageData;
}

// --- Вспомогательные типы (остаются полезными) ---

/** Ключи страниц (home, about, ...), получаемые из AppContent */
export type PageKey = keyof AppContent;

/** Ключи секций внутри страницы */
export type SectionKey<P extends PageKey> = keyof AppContent[P];

/** Ключи полей внутри секции */
export type FieldKey<
  P extends PageKey,
  S extends SectionKey<P>
> = keyof AppContent[P][S];

// // --- Конкретные интерфейсы (ТЕПЕРЬ ТОЛЬКО ДЛЯ ПРИМЕРА/ДОКУМЕНТАЦИИ) ---
// // Логика больше не будет жестко на них опираться, а будет динамической.
// // Но они полезны для понимания структуры в content.json.

// // Пример структуры секции для home/section-1
// export interface HomeSection1Content extends SectionContent {
//   title: string;
//   "description1": string;
//   "image1": string;
//   "image2": string;
// }

// // Пример структуры секции для home/section-2
// export interface HomeSection2Content extends SectionContent {
//   title: string;
//   "description1": string;
//   "image1": string;
// }

// // Пример структуры секции для about/section-1
// export interface AboutSection1Content extends SectionContent {
//   title: string;
//   "description1": string;
//   "description2": string;
// //   "description3": string;
//   "image1": string;
// }
