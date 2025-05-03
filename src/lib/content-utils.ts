// src/lib/content-utils.ts
// Убираем импорт AppContent, SectionContent
import { SectionDataType } from "@/types/types"; // Используем новый тип

/**
 * Нормализует объект секции (Record<string, any>) до Record<string, string>.
 * null/undefined/другие типы преобразуются в пустую строку.
 */
export function normalizeSectionData(section: unknown): SectionDataType {
  const normalized: SectionDataType = {};
  // Проверяем, что это действительно объект
  if (
    typeof section === "object" &&
    section !== null &&
    !Array.isArray(section)
  ) {
    for (const key in section) {
      // Проверяем принадлежность ключа самому объекту
      if (Object.prototype.hasOwnProperty.call(section, key)) {
        // Приводим к типу unknown перед доступом по ключу
        const unknownSection = section as Record<string, unknown>;
        const value = unknownSection[key];
        // Гарантируем строку, преобразуя null/undefined в ''
        normalized[key] =
          value === null || value === undefined ? "" : String(value);
      }
    }
  }
  return normalized;
}

// Функция normalizeAppContent больше не нужна, так как нет типа AppContent

/**
 * Проверяет, является ли ключ поля ключом для изображения.
 */
export function isImageField(key: string): boolean {
  // Можно сделать проверку строже, если есть четкие правила именования
  return key.toLowerCase().includes("image");
}

/**
 * Определяет тип HTML-элемента для рендеринга поля формы.
 */
export function inferInputElement(key: string): "file" | "textarea" {
  return isImageField(key) ? "file" : "textarea";
}

/**
 * Генерирует метку для поля формы из ключа.
 */
export function generateLabel(key: string): string {
  // Простая реализация: заменяем camelCase и snake_case/kebab-case на пробелы и делаем заглавной первую букву
  const spaced = key
    .replace(/([A-Z])/g, " $1") // Добавляем пробел перед заглавными буквами
    .replace(/[_-]/g, " ") // Заменяем _ и - на пробелы
    .trim(); // Убираем лишние пробелы по краям
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

// Функция createDefaultAppContent больше не нужна

/**
 * Создает пустой объект SectionDataType. Если переданы ключи,
 * инициализирует их ПУСТЫМИ СТРОКАМИ.
 * @param existingKeys - Опциональный массив ключей для инициализации.
 * @returns Пустой объект SectionDataType или с заданными ключами и пустыми строками.
 */
export function createEmptySectionData(
  existingKeys?: string[]
): SectionDataType {
  const emptySection: SectionDataType = {};
  if (existingKeys && existingKeys.length > 0) {
    existingKeys.forEach((key) => {
      emptySection[key] = ""; // Инициализируем ПУСТОЙ СТРОКОЙ
    });
  }
  return emptySection;
}
