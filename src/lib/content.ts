// src/lib/content.ts
import fs from "fs/promises";
import path from "path";

// Определяем интерфейс для структуры контента для лучшей типизации
export interface PageContent {
  title: string;
  description: string;
  image?: string | null; // Путь к изображению, может отсутствовать
}

export interface AppContent {
  home: PageContent;
  about: PageContent; // Добавь другие разделы по необходимости
  [key: string]: PageContent; // Для доступа по ключу
}

const contentFilePath = path.join(
  process.cwd(),
  "public",
  "content",
  "content.json"
);

export async function getContent(): Promise<AppContent> {
  try {
    console.log(`Reading content file from: ${contentFilePath}`);
    const fileContent = await fs.readFile(contentFilePath, "utf-8");
    const data = JSON.parse(fileContent) as AppContent;
    return data;
  } catch (error) {
    console.error("Error reading content file:", error);
    // Возвращаем пустой объект или структуру по умолчанию в случае ошибки
    // чтобы приложение не падало полностью
    return {
      home: {
        title: "Error",
        description: "Could not load content.",
        image: null,
      },
    } as AppContent;
  }
}

// --- Запись контента (для админки) ---
export async function writeContent(newContent: AppContent): Promise<void> {
  try {
    const dataString = JSON.stringify(newContent, null, 2); // Форматируем для читаемости
    await fs.writeFile(contentFilePath, dataString, "utf-8");
    console.log("Content file updated successfully.");
  } catch (error) {
    console.error("Error writing content file:", error);
    throw new Error("Failed to update content file."); // Пробрасываем ошибку
  }
}
