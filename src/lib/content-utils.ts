// src/lib/content-utils.ts
import { AppContent, SectionContent } from "@/types/types";

/**
 * Нормализует объект секции, гарантируя, что все значения являются строками.
 * null/undefined/другие типы преобразуются в пустую строку.
 */
export function normalizeSection(section: any): SectionContent {
  const normalized: SectionContent = {};
  if (typeof section === "object" && section !== null) {
    for (const key in section) {
      if (Object.prototype.hasOwnProperty.call(section, key)) {
        const value = section[key];
        // Гарантируем строку, преобразуя null/undefined в ''
        normalized[key] =
          value === null || value === undefined ? "" : String(value);
      }
    }
  }
  // Дополнительно: убедиться, что все ожидаемые ключи из интерфейса присутствуют (если нужно)
  return normalized;
}

/**
 * Нормализует весь объект AppContent.
 */
export function normalizeAppContent(content: any): AppContent {
  const normalized: AppContent = {};
  if (typeof content === "object" && content !== null) {
    for (const pageKey in content) {
      if (Object.prototype.hasOwnProperty.call(content, pageKey)) {
        const pageData = content[pageKey];
        normalized[pageKey] = {};
        if (typeof pageData === "object" && pageData !== null) {
          for (const sectionKey in pageData) {
            if (Object.prototype.hasOwnProperty.call(pageData, sectionKey)) {
              normalized[pageKey][sectionKey] = normalizeSection(
                pageData[sectionKey]
              );
            }
          }
        }
      }
    }
  }
  return normalized;
}

/**
 * Проверяет, является ли ключ поля ключом для изображения.
 */
export function isImageField(key: string): boolean {
  return key.toLowerCase().includes("image");
}

/**
 * Определяет тип HTML-элемента для рендеринга.
 */
export function inferInputElement(key: string): "file" | "textarea" {
  return isImageField(key) ? "file" : "textarea";
}

/**
 * Генерирует метку для поля формы.
 */
export function generateLabel(key: string): string {
  const spaced = key.replace(/([A-Z])/g, " $1").replace(/[_-]/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/**
 * Создает пустую структуру AppContent.
 */
export function createDefaultAppContent(): AppContent {
  return {};
}

/**
 * Создает пустой объект SectionContent. Если переданы ключи,
 * инициализирует их ПУСТЫМИ СТРОКАМИ.
 * @param existingKeys - Опциональный массив ключей.
 * @returns Объект SectionContent с пустыми строками.
 */
export function createEmptySectionContent(
  existingKeys?: string[]
): SectionContent {
  const emptySection: SectionContent = {};
  if (existingKeys && existingKeys.length > 0) {
    existingKeys.forEach((key) => {
      emptySection[key] = ""; // Инициализируем ПУСТОЙ СТРОКОЙ
    });
  }
  return emptySection;
}
