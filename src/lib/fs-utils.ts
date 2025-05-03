// src/lib/fs-utils.ts
import fs from "fs/promises";
import path from "path";
import { createDefaultAppContent, normalizeAppContent } from "./content-utils";
import { AppContent } from "@/types/types";

const mediaFolderPath = path.join(process.cwd(), "media");
const contentFolderPath = path.join(process.cwd(), "public", "content"); // Папка для JSON
const contentFilePath = path.join(contentFolderPath, "content.json");
// const exContentFilePath = path.join(contentFolderPath, 'ex-content.json'); // Путь к файлу бэкапа (оставлен, но не используется в actions)

// --- Функции для медиа ---

/**
 * Получает полный, безопасный путь к файлу в папке media,
 * работая ТОЛЬКО с базовым именем файла для предотвращения Path Traversal.
 * @param filename - Имя файла (путь будет отброшен).
 * @returns Безопасный абсолютный путь к файлу в папке media.
 * @throws Error если имя файла некорректно.
 */
export function getSafeMediaFilePath(filename: string): string {
  // Извлекаем только имя файла + расширение, отбрасывая потенциальный путь
  const baseFilename = path.basename(filename);

  // Дополнительная нормализация и проверка на выход за пределы
  const safeBasename = path
    .normalize(baseFilename)
    .replace(/^(\.\.(\/|\\|$))+/, "");

  if (
    safeBasename !== baseFilename ||
    safeBasename.includes("..") ||
    path.isAbsolute(safeBasename)
  ) {
    throw new Error(
      `Invalid or potentially unsafe filename detected: ${filename}`
    );
  }
  // Собираем путь только с безопасным базовым именем файла
  return path.join(mediaFolderPath, safeBasename);
}

/** Проверяет существование файла в папке media */
export async function checkMediaFileExists(
  filename: string | null | undefined
): Promise<boolean> {
  if (!filename) return false;
  try {
    // Используем безопасную функцию для получения пути
    await fs.access(getSafeMediaFilePath(filename));
    return true;
  } catch {
    return false;
  }
}

/** Безопасно удаляет файл из media (игнорирует ENOENT) */
export async function safeUnlink(
  filename: string | null | undefined
): Promise<void> {
  if (!filename) return;
  let filePath = "";
  try {
    // Используем безопасную функцию для получения пути
    filePath = getSafeMediaFilePath(filename);
    await fs.unlink(filePath);
    console.log(`Successfully deleted file: ${filePath}`); // Лог с полным путем
  } catch (error: unknown) {
    // Проверяем тип ошибки для доступа к 'code'
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      // Файл не найден, это ожидаемо в некоторых случаях, просто игнорируем
    } else {
      // Логируем и пробрасываем другие ошибки
      console.error(`Error deleting file ${filePath || filename}:`, error);
      // Не бросаем ошибку дальше, чтобы не прерывать основной процесс, если это не критично
      // throw error; // Раскомментировать, если ошибка удаления должна прервать операцию
    }
  }
}

/** Безопасно переименовывает файл в media */
export async function safeRename(
  oldFilename: string | null | undefined,
  newFilename: string | null | undefined
): Promise<void> {
  if (!oldFilename || !newFilename) {
    throw new Error("Old or new filename is missing for rename operation.");
  }
  let oldPath = "";
  let newPath = "";
  try {
    // Используем безопасную функцию для обоих путей
    oldPath = getSafeMediaFilePath(oldFilename);
    newPath = getSafeMediaFilePath(newFilename);
    await fs.rename(oldPath, newPath);
    console.log(`Successfully renamed ${oldFilename} to ${newFilename}`);
  } catch (error: unknown) {
    console.error(
      `Error renaming file ${oldFilename} to ${newFilename}:`,
      error
    );
    throw error; // Пробрасываем ошибку дальше
  }
}

// --- Функции для контента ---

/** Читает основной файл контента */
export async function readContentFile(): Promise<string> {
  return fs.readFile(contentFilePath, "utf-8");
}

/** Читает файл бэкапа контента (возвращает null если нет) */
/* // Функция оставлена, но не используется в текущей логике actions.ts
export async function readExContentFile(): Promise<string | null> {
    try {
        return await fs.readFile(exContentFilePath, 'utf-8');
    } catch (error: unknown) {
        if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT') {
            return null; // Файла бэкапа еще нет
        }
        console.error("Error reading ex-content file:", error);
        throw error; // Другие ошибки чтения пробрасываем
    }
} */

/** Записывает основной файл контента */
export async function writeContentFile(data: string): Promise<void> {
  await fs.writeFile(contentFilePath, data, "utf-8");
}

/** Записывает файл бэкапа контента */
/* // Функция оставлена, но не используется в текущей логике actions.ts
export async function writeExContentFile(data: string): Promise<void> {
    await fs.writeFile(exContentFilePath, data, 'utf-8');
} */

// --- Чтение контента ---
export async function getContent(): Promise<AppContent> {
  try {
    const fileContent = await fs.readFile(contentFilePath, "utf-8");
    const data = JSON.parse(fileContent);
    // Добавим более строгую проверку, что это объект, а не массив или null
    if (typeof data !== "object" || data === null || Array.isArray(data)) {
      throw new Error(
        "Invalid content structure: Root level must be an object."
      );
    }
    return normalizeAppContent(data); // Нормализуем при чтении
  } catch (error: unknown) {
    console.error("Error reading or parsing content file:", error);
    console.warn("Returning empty content structure due to error.");
    // Возвращаем пустой объект, чтобы приложение не падало полностью
    return createDefaultAppContent();
  }
}

// --- Запись контента ---
export async function writeContent(newContent: AppContent): Promise<void> {
  try {
    // Нормализуем перед записью (на всякий случай, если пришли ненормализованные данные)
    const normalizedContent = normalizeAppContent(newContent);
    const dataString = JSON.stringify(normalizedContent, null, 2); // Форматирование с отступами
    // TODO: Рассмотреть создание бэкапа перед записью основного файла
    // await writeExContentFile(await readContentFile()); // Пример: сохранить старый перед записью нового
    await writeContentFile(dataString);
    console.log("Content file updated successfully.");
  } catch (error: unknown) {
    console.error("Error writing content file:", error);
    // Оборачиваем в новый объект Error для лучшего стектрейса
    throw new Error(
      `Failed to update content file. Reason: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}
