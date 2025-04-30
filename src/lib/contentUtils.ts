// src/lib/contentUtils.ts
import { AppContent, SectionContent } from "./contentInterfaces"; // Импорт интерфейсов

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
