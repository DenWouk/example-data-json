// src/lib/content.ts
import fs from "fs/promises";
import path from "path";
import { createDefaultAppContent } from "./contentUtils";
import { AppContent, SectionContent } from "./contentInterfaces";

export * from "./contentInterfaces";

const contentFilePath = path.join(
  process.cwd(),
  "public",
  "content",
  "content.json"
);

/**
 * Нормализует объект секции, гарантируя, что все значения являются строками.
 * null/undefined/другие типы преобразуются в пустую строку.
 */
function normalizeSection(section: any): SectionContent {
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
function normalizeAppContent(content: any): AppContent {
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

// --- Чтение контента ---
export async function getContent(): Promise<AppContent> {
  try {
    const fileContent = await fs.readFile(contentFilePath, "utf-8");
    const data = JSON.parse(fileContent);
    if (typeof data !== "object" || data === null) {
      throw new Error("Invalid content structure.");
    }
    return normalizeAppContent(data); // Нормализуем при чтении
  } catch (error) {
    console.error("Error reading or parsing content file:", error);
    console.warn("Returning empty content structure due to error.");
    return createDefaultAppContent();
  }
}

// --- Запись контента ---
export async function writeContent(newContent: AppContent): Promise<void> {
  try {
    // Нормализуем перед записью
    const normalizedContent = normalizeAppContent(newContent);
    const dataString = JSON.stringify(normalizedContent, null, 2);
    await fs.writeFile(contentFilePath, dataString, "utf-8");
    console.log("Content file updated successfully.");
  } catch (error) {
    console.error("Error writing content file:", error);
    throw new Error("Failed to update content file.");
  }
}
