// src/lib/content-utils.ts
import { SectionDataType } from "@/types/types";

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

/**
 * Проверяет, является ли ключ поля ключом для изображения.
 */
export function isImageField(key: string): boolean {
  // Можно сделать проверку строже, если есть четкие правила именования
  return key.toLowerCase().includes("image");
}

export function isColorField(key: string): boolean {
  return key.toLowerCase().includes("color");
}

/**
 * Определяет тип HTML-элемента для рендеринга поля формы.
 * Добавлена проверка для полей цвета.
 */
export function inferInputElement(key: string): "file" | "textarea" | "color" {
  if (isImageField(key)) {
    return "file";
  }
  if (isColorField(key)) {
    return "color";
  }
  return "textarea";
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
