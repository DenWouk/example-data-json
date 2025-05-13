// src/lib/fs-utils.ts
import fs from "fs/promises";
import path from "path";
import { AppContent } from "@/types/types";
import { isImageField } from "@/lib/content-utils";

type JsonValue = string | number | boolean | null | JsonObject | JsonArray;
type JsonArray = Array<JsonValue>;

interface JsonObject {
  [key: string]: JsonValue;
}

const mediaFolderPath = path.join(process.cwd(), "media");
const contentFolderPath = path.join(process.cwd(), "public", "content");
const contentFilePath = path.join(contentFolderPath, "content.json");

// Список поддерживаемых расширений для поиска, если в content.json только базовое имя
const SUPPORTED_IMAGE_EXTENSIONS = [
  ".jpeg",
  ".jpg",
  ".png",
  ".webp",
  ".gif",
  ".svg",
];

/**
 * Находит реальное имя файла в папке media по его базовому имени.
 * Ищет файлы с поддерживаемыми расширениями.
 * @param baseFilename - Базовое имя файла (без расширения).
 * @returns Полное имя файла с расширением или null, если не найден.
 */

export async function findNextAvailableVersionedFilename(
  baseFilename: string,
  newExtension: string
): Promise<{
  nextVersionedBaseName: string;
  nextVersionedFullName: string;
} | null> {
  if (!baseFilename || !newExtension) {
    console.error(
      "[findNextAvailableVersionedFilename] Missing baseFilename or newExtension"
    );
    return null;
  }

  const versionRegex = new RegExp(
    `^${escapeRegex(baseFilename)}_v(\\d+)(\\.\\w+)$`
  );
  let maxVersion = 0;

  try {
    await fs.mkdir(mediaFolderPath, { recursive: true }); // Ensure media folder exists
    const files = await fs.readdir(mediaFolderPath);

    for (const file of files) {
      const match = file.match(versionRegex);
      if (match) {
        const versionNumber = parseInt(match[1], 10);
        if (!isNaN(versionNumber) && versionNumber > maxVersion) {
          maxVersion = versionNumber;
        }
      }
    }
  } catch (error) {
    console.error(
      "[findNextAvailableVersionedFilename] Error reading media directory:",
      error
    );
    return null; // Indicate an error occurred
  }

  const nextVersion = maxVersion + 1;
  const nextVersionedBaseName = `${baseFilename}_v${nextVersion}`;
  const nextVersionedFullName = `${nextVersionedBaseName}${newExtension}`;

  return { nextVersionedBaseName, nextVersionedFullName };
}

// Helper to escape characters for regex
function escapeRegex(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); // $& means the whole matched string
}

export async function findActualFilenameInMedia(
  baseFilename: string
): Promise<string | null> {
  if (!baseFilename || baseFilename.includes(".")) {
    // Если передано уже с расширением или пустое, считаем, что это не базовое имя для поиска
    // или некорректный ввод для этой функции.
    // Если это полный путь, getSafeMediaFilePath ниже обработает.
    // Если это базовое имя но с точкой, поиск может быть некорректным.
    // Для простоты, эта функция ожидает чистое базовое имя.
    // Если же это имя типа 'my.file' и оно без расширения, то поиск будет 'my.file.jpg' и тд.
    // Для имен файлов с точками, которые НЕ являются разделителем расширения,
    // эта логика может потребовать доработки или более строгого определения "базового имени".
    // Пока считаем, что точка в baseFilename не предполагается.
    if (baseFilename && baseFilename.includes(".")) {
      // Попытка проверить, существует ли файл как есть, если в baseFilename есть точка.
      try {
        await fs.access(getSafeMediaFilePath(baseFilename));
        return baseFilename;
      } catch {
        // Файл не найден как есть, продолжаем поиск по расширениям, если это осмысленно.
        // Но для простоты текущей реализации, если есть точка, мы не будем искать по расширениям.
        // console.warn(`[findActualFilenameInMedia] baseFilename '${baseFilename}' contains a dot, treating as full name or invalid for extension search.`);
        // return null; // или вернуть baseFilename и пусть checkMediaFileExists/safeUnlink проверят его как есть
      }
    }
  }

  try {
    const files = await fs.readdir(mediaFolderPath);
    for (const ext of SUPPORTED_IMAGE_EXTENSIONS) {
      const fullFilename = `${baseFilename}${ext}`;
      if (files.includes(fullFilename)) {
        return fullFilename;
      }
    }
    // Если есть файлы вида baseFilename-что-то.ext (например, после Date.now()),
    // этот поиск их не найдет. Он ищет точное совпадение baseFilename + ext.
  } catch (error) {
    // Если папка media не существует, fs.readdir выдаст ошибку
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      console.warn(
        `[findActualFilenameInMedia] Media folder not found at ${mediaFolderPath}`
      );
      return null;
    }
    console.error(
      "[findActualFilenameInMedia] Error reading media directory:",
      error
    );
    return null;
  }
  return null;
}

export function getSafeMediaFilePath(filename: string): string {
  const baseFilename = path.basename(filename);
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
  return path.join(mediaFolderPath, safeBasename);
}

export async function checkMediaFileExists(
  filenameOrBasename: string | null | undefined
): Promise<string | null> {
  // Возвращает полное имя файла если найден, или null
  if (
    !filenameOrBasename ||
    typeof filenameOrBasename !== "string" ||
    filenameOrBasename.trim() === ""
  ) {
    return null;
  }

  let actualFilenameToTest = filenameOrBasename;

  // Если имя не содержит точки, считаем его базовым и пытаемся найти реальный файл
  if (!filenameOrBasename.includes(".")) {
    const foundFullName = await findActualFilenameInMedia(filenameOrBasename);
    if (!foundFullName) {
      return null; // Базовое имя не найдено ни с одним расширением
    }
    actualFilenameToTest = foundFullName;
  }
  // Если имя содержало точку, или мы нашли полное имя по базовому,
  // actualFilenameToTest теперь полное имя. Проверяем его.
  try {
    await fs.access(getSafeMediaFilePath(actualFilenameToTest));
    return actualFilenameToTest; // Файл существует, возвращаем его полное имя
  } catch {
    return null; // Файл не найден
  }
}

export async function safeUnlink(
  filenameOrBasename: string | null | undefined
): Promise<void> {
  if (!filenameOrBasename) return;

  let actualFilenameToDelete = filenameOrBasename;
  if (!filenameOrBasename.includes(".")) {
    const foundFullName = await findActualFilenameInMedia(filenameOrBasename);
    if (!foundFullName) {
      // console.warn(`[safeUnlink] File with base name '${filenameOrBasename}' not found to delete.`);
      return; // Нечего удалять
    }
    actualFilenameToDelete = foundFullName;
  }

  let filePath = "";
  try {
    filePath = getSafeMediaFilePath(actualFilenameToDelete);
    await fs.unlink(filePath);
    console.log(`Successfully deleted file: ${filePath}`);
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      // Файл не найден, это ожидаемо
    } else {
      console.error(
        `Error deleting file ${filePath || actualFilenameToDelete}:`,
        error
      );
    }
  }
}

export async function safeRename(
  oldFilenameOrBasename: string, // Может быть "image" или "image.jpg"
  newFullFilename: string // Должно быть "prev-image.jpg" или "image.png"
): Promise<void> {
  if (!oldFilenameOrBasename || !newFullFilename) {
    throw new Error("Old or new filename is missing for rename operation.");
  }

  let actualOldFullFilename = oldFilenameOrBasename;
  if (!oldFilenameOrBasename.includes(".")) {
    const foundFullName = await findActualFilenameInMedia(
      oldFilenameOrBasename
    );
    if (!foundFullName) {
      throw new Error(
        `[safeRename] Old file with base name '${oldFilenameOrBasename}' not found for rename.`
      );
    }
    actualOldFullFilename = foundFullName;
  }
  // Теперь actualOldFullFilename - это полное имя старого файла

  let oldPath = "";
  let newPath = "";
  try {
    oldPath = getSafeMediaFilePath(actualOldFullFilename);
    newPath = getSafeMediaFilePath(newFullFilename); // newFullFilename всегда должен быть полным

    if (oldPath === newPath) {
      console.warn(
        `[safeRename] Old path and new path are identical: ${oldPath}. Skipping rename.`
      );
      return;
    }

    await fs.rename(oldPath, newPath);
    console.log(
      `Successfully renamed ${actualOldFullFilename} to ${newFullFilename}`
    );
  } catch (error: unknown) {
    console.error(
      `Error renaming file ${actualOldFullFilename} to ${newFullFilename}:`,
      error
    );
    throw error; // Перебрасываем ошибку, чтобы action мог ее обработать (например, для отката)
  }
}

async function processContentNode(
  node: JsonObject,
  currentPath: string
): Promise<void> {
  if (typeof node !== "object" || node === null || Array.isArray(node)) {
    return;
  }

  const promises = Object.keys(node).map(async (key) => {
    const value = node[key];
    const fullPathKey = currentPath ? `${currentPath}.${key}` : key;

    if (isImageField(key)) {
      const baseImageFilename = typeof value === "string" ? value.trim() : "";

      if (!baseImageFilename) {
        node[key] = ""; // Имя не указано
      } else if (baseImageFilename.startsWith("/api/media/")) {
        // Уже обработанный путь (например, при глубоком копировании перед записью)
        // Оставляем как есть, или можно было бы извлечь полное имя и перепроверить
        console.warn(
          `[getContent] Path ${fullPathKey} seems already processed: ${baseImageFilename}. Leaving as is.`
        );
      } else {
        // Это базовое имя, ищем реальный файл
        const actualImageFullFilename = await findActualFilenameInMedia(
          baseImageFilename
        );
        if (actualImageFullFilename) {
          node[key] = `/api/media/${actualImageFullFilename}`; // Формируем URL с полным именем
          // console.log(`[getContent] Image path processed for ${fullPathKey}: ${node[key]}`);
        } else {
          console.warn(
            `[getContent] Изображение с базовым именем '${baseImageFilename}' для ключа '${fullPathKey}' не найдено в папке media. Установлена пустая строка.`
          );
          node[key] = "";
        }
      }
    } else if (typeof value === "object" && value !== null) {
      await processContentNode(value as JsonObject, fullPathKey);
    }
  });
  await Promise.all(promises);
}

export async function getContent(): Promise<AppContent> {
  let fileContent: string;
  try {
    fileContent = await fs.readFile(contentFilePath, "utf-8");
  } catch (readError: unknown) {
    console.error(
      `[getContent] Error reading content file (${contentFilePath}):`,
      readError
    );
    throw new Error(
      `Failed to read content file. ${
        readError instanceof Error ? readError.message : String(readError)
      }`
    );
  }

  let jsonData: unknown;

  try {
    jsonData = JSON.parse(fileContent);
  } catch (parseError: unknown) {
    console.error(
      `[getContent] Error parsing JSON from ${contentFilePath}:`,
      parseError
    );
    throw new Error(
      `Failed to parse content file. ${
        parseError instanceof Error ? parseError.message : String(parseError)
      }`
    );
  }

  if (
    typeof jsonData !== "object" ||
    jsonData === null ||
    Array.isArray(jsonData)
  ) {
    console.error(
      `[getContent] Invalid content structure in ${contentFilePath}: Root is not an object.`
    );
    throw new Error("Invalid content structure: Root level must be an object.");
  }

  // console.log("[getContent] Starting content processing (image paths with base names)...");
  await processContentNode(jsonData as JsonObject, "");
  // console.log("[getContent] Content processing finished.");
  return jsonData as AppContent;
}

export async function writeContent(contentToWrite: AppContent): Promise<void> {
  try {
    const contentCopy: JsonObject = JSON.parse(JSON.stringify(contentToWrite));

    const cleanupImagePathsForWrite = (node: JsonObject): void => {
      if (typeof node !== "object" || node === null || Array.isArray(node)) {
        return;
      }
      Object.keys(node).forEach((key) => {
        const value = node[key];
        if (isImageField(key) && typeof value === "string") {
          if (value.startsWith("/api/media/")) {
            const fullFilename = value.substring("/api/media/".length);
            // Сохраняем только базовое имя без расширения
            node[key] = path.basename(fullFilename, path.extname(fullFilename));
            // console.log(`[writeContent] Cleaned image path for ${key} to base name: ${node[key]}`);
          } else if (value.includes(".")) {
            // Если значение не URL, но содержит точку (т.е. полное имя файла), также извлекаем базовое имя
            // Это может произойти, если `finalSectionData` в actions.ts передало полное имя
            // (что не должно происходить по новой логике, но для подстраховки)
            node[key] = path.basename(value, path.extname(value));
            // console.log(`[writeContent] Converted full name ${value} to base name for ${key}: ${node[key]}`);
          }
          // Если это уже базовое имя (без /api/media/ и без точки), оставляем как есть
        } else if (typeof value === "object" && value !== null) {
          cleanupImagePathsForWrite(value as JsonObject);
        }
      });
    };

    // console.log("[writeContent] Cleaning image paths to base names before writing...");
    cleanupImagePathsForWrite(contentCopy);
    // console.log("[writeContent] Image paths cleaned to base names.");

    const dataString = JSON.stringify(contentCopy, null, 2);
    await fs.writeFile(contentFilePath, dataString, "utf-8");
    // console.log(`[writeContent] Content file ${contentFilePath} updated successfully.`);
  } catch (error: unknown) {
    console.error(
      `[writeContent] Error writing content file (${contentFilePath}):`,
      error
    );
    throw new Error(
      `Failed to update content file. ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}
