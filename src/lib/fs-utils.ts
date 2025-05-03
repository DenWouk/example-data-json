// src/lib/fs-utils.ts
import fs from "fs/promises";
import path from "path";
// Импортируем ТОЛЬКО SpecificAppContent
import { AppContent } from "@/types/types";

// --- Константы путей ---
const mediaFolderPath = path.join(process.cwd(), "media");
const contentFolderPath = path.join(process.cwd(), "public", "content");
const contentFilePath = path.join(contentFolderPath, "content.json");

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
      // Логируем другие ошибки
      console.error(`Error deleting file ${filePath || filename}:`, error);
      // Не бросаем ошибку дальше в этом случае
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

/**
 * Читает и парсит файл content.json.
 * Возвращает Promise<SpecificAppContent> или выбрасывает ошибку при чтении/парсинге/невалидной структуре.
 * НЕ возвращает пустой объект {} в случае ошибки.
 */
export async function getContent(): Promise<AppContent> {
  let fileContent: string;
  try {
    fileContent = await fs.readFile(contentFilePath, "utf-8");
    console.log(`[getContent] Successfully read ${contentFilePath}`);
  } catch (readError: unknown) {
    console.error(
      `[getContent] Error reading content file (${contentFilePath}):`,
      readError
    );
    // Перебрасываем ошибку, не возвращаем {}
    throw new Error(
      `Failed to read content file. Reason: ${
        readError instanceof Error ? readError.message : String(readError)
      }`
    );
  }

  let jsonData: unknown;
  try {
    jsonData = JSON.parse(fileContent);
    console.log(
      `[getContent] Successfully parsed JSON from ${contentFilePath}`
    );
  } catch (parseError: unknown) {
    console.error(
      `[getContent] Error parsing JSON from ${contentFilePath}:`,
      parseError
    );
    // Перебрасываем ошибку, не возвращаем {}
    throw new Error(
      `Failed to parse content file as JSON. Reason: ${
        parseError instanceof Error ? parseError.message : String(parseError)
      }`
    );
  }

  // Простейшая проверка, что это объект (не массив, не null)
  if (
    typeof jsonData !== "object" ||
    jsonData === null ||
    Array.isArray(jsonData)
  ) {
    const errorMsg = `[getContent] Invalid content structure in ${contentFilePath}: Root level is not an object. Found type: ${
      Array.isArray(jsonData) ? "array" : typeof jsonData
    }`;
    console.error(errorMsg);
    throw new Error("Invalid content structure: Root level must be an object.");
  }

  // Никакой валидации Zod или нормализации по запросу.
  // Просто делаем type assertion, полагаясь на то, что структура верна.
  // Если структура неверна, ошибка произойдет позже при доступе к полям.
  console.log(
    "[getContent] Assuming content structure matches SpecificAppContent based on successful read/parse."
  );
  return jsonData as AppContent;
}

/**
 * Записывает данные в файл content.json.
 * Принимает объект, соответствующий интерфейсу SpecificAppContent.
 * @param newContent - Объект контента для записи.
 */
export async function writeContent(
  newContent: AppContent
): Promise<void> {
  try {
    // Записываем как есть, форматируя JSON для читаемости
    const dataString = JSON.stringify(newContent, null, 2); // Отступы в 2 пробела
    await fs.writeFile(contentFilePath, dataString, "utf-8");
    console.log(
      `[writeContent] Content file ${contentFilePath} updated successfully.`
    );
  } catch (error: unknown) {
    console.error(
      `[writeContent] Error writing content file (${contentFilePath}):`,
      error
    );
    throw new Error(
      `Failed to update content file. Reason: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

// Функции для бэкапа (ex-content.json) не используются и убраны для чистоты
// async function readExContentFile...
// async function writeExContentFile...
