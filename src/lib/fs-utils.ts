// src/lib/fs-utils.ts
import fs from "fs/promises";
import path from "path";
// Импортируем ТОЛЬКО AppContent
import { AppContent } from "@/types/types";
// Импортируем утилиту для проверки ключа изображения
import { isImageField } from "@/lib/content-utils"; // <--- Добавлен импорт

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
  if (!filename || typeof filename !== "string" || filename.trim() === "") {
    // Добавлена проверка на пустую строку и тип
    return false;
  }
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
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      // Файл не найден, это ожидаемо в некоторых случаях, просто игнорируем
    } else {
      console.error(`Error deleting file ${filePath || filename}:`, error);
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
    oldPath = getSafeMediaFilePath(oldFilename);
    newPath = getSafeMediaFilePath(newFilename);
    await fs.rename(oldPath, newPath);
    console.log(`Successfully renamed ${oldFilename} to ${newFilename}`);
  } catch (error: unknown) {
    console.error(
      `Error renaming file ${oldFilename} to ${newFilename}:`,
      error
    );
    throw error;
  }
}

// --- Функции для контента ---

/**
 * Рекурсивно обходит объект контента и обрабатывает поля изображений.
 * @param node - Текущий узел (объект или значение).
 * @param currentPath - Строка пути к текущему узлу (для логов).
 */
async function processContentNode(
  node: any,
  currentPath: string
): Promise<void> {
  // Проверяем, что это объект (и не массив, не null)
  if (typeof node !== "object" || node === null || Array.isArray(node)) {
    return; // Не объект или массив, прекращаем обработку этой ветки
  }

  // Асинхронно обрабатываем все ключи объекта
  const promises = Object.keys(node).map(async (key) => {
    const value = node[key];
    const fullPath = currentPath ? `${currentPath}.${key}` : key; // Строим полный путь ключа

    if (isImageField(key)) {
      // Это ключ для изображения
      const imageFilename = typeof value === "string" ? value.trim() : ""; // Получаем имя файла, удаляем пробелы

      if (!imageFilename) {
        // Имя файла пустое
        console.warn(
          `[getContent] Изображение не выбрано для ключа: ${fullPath}`
        );
        node[key] = ""; // Устанавливаем пустую строку
      } else {
        // Имя файла есть, проверяем существование файла
        const fileExists = await checkMediaFileExists(imageFilename);
        if (fileExists) {
          // Файл существует, формируем полный URL
          node[key] = `/api/media/${imageFilename}`;
          console.log(
            `[getContent] Image path processed for ${fullPath}: ${node[key]}`
          );
        } else {
          // Файл не найден
          console.warn(
            `[getContent] Изображение отсутствует в папке media: Файл '${imageFilename}' для ключа '${fullPath}' не найден.`
          );
          node[key] = ""; // Устанавливаем пустую строку
        }
      }
    } else if (typeof value === "object" && value !== null) {
      // Если значение - вложенный объект, рекурсивно обрабатываем его
      await processContentNode(value, fullPath);
    }
    // Если это не поле изображения и не объект, ничего не делаем (оставляем как есть)
  });

  // Дожидаемся завершения обработки всех ключей на этом уровне
  await Promise.all(promises);
}

/**
 * Читает, парсит и ОБРАБАТЫВАЕТ файл content.json.
 * Обработка включает:
 * - Преобразование путей к изображениям (ключи содержащие 'image'):
 *   - Проверка существования файла в папке 'media'.
 *   - Добавление префикса '/api/media/' к существующим файлам.
 *   - Установка пустой строки ('') и вывод предупреждения, если файл не указан или не найден.
 * Возвращает Promise<AppContent> с обработанными путями или выбрасывает ошибку при чтении/парсинге.
 */
export async function getContent(): Promise<AppContent> {
  let fileContent: string;

  try {
    fileContent = await fs.readFile(contentFilePath, "utf-8");
    // console.log(`[getContent] Successfully read ${contentFilePath}`); // Можно раскомментировать для отладки
  } catch (readError: unknown) {
    console.error(
      `[getContent] Error reading content file (${contentFilePath}):`,
      readError
    );
    throw new Error(
      `Failed to read content file. Reason: ${
        readError instanceof Error ? readError.message : String(readError)
      }`
    );
  }

  let jsonData: unknown;
  try {
    jsonData = JSON.parse(fileContent);
    // console.log(`[getContent] Successfully parsed JSON from ${contentFilePath}`); // Можно раскомментировать для отладки
  } catch (parseError: unknown) {
    console.error(
      `[getContent] Error parsing JSON from ${contentFilePath}:`,
      parseError
    );
    throw new Error(
      `Failed to parse content file as JSON. Reason: ${
        parseError instanceof Error ? parseError.message : String(parseError)
      }`
    );
  }

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

  // --- НАЧАЛО ОБРАБОТКИ КОНТЕНТА ---
  console.log("[getContent] Starting content processing (image paths)...");
  await processContentNode(jsonData, ""); // Запускаем рекурсивную обработку
  console.log("[getContent] Content processing finished.");
  // --- КОНЕЦ ОБРАБОТКИ КОНТЕНТА ---

  // Теперь jsonData содержит обработанные пути к изображениям
  // Делаем type assertion, т.к. структура та же, только значения image полей изменены
  return jsonData as AppContent;
}

/**
 * Записывает данные в файл content.json.
 * Принимает объект, соответствующий интерфейсу AppContent.
 * ВАЖНО: Перед записью УБИРАЕТ префикс '/api/media/' из путей к изображениям,
 * чтобы в content.json хранились только базовые имена файлов.
 * @param contentToWrite - Объект контента для записи.
 */
export async function writeContent(contentToWrite: AppContent): Promise<void> {
  try {
    // Создаем глубокую копию, чтобы не модифицировать оригинальный объект,
    // который может использоваться где-то еще в рантайме
    const contentCopy = JSON.parse(JSON.stringify(contentToWrite));

    // Рекурсивная функция для очистки путей перед записью
    const cleanupImagePaths = (node: any): void => {
      if (typeof node !== "object" || node === null || Array.isArray(node)) {
        return;
      }
      Object.keys(node).forEach((key) => {
        const value = node[key];
        if (
          isImageField(key) &&
          typeof value === "string" &&
          value.startsWith("/api/media/")
        ) {
          // Убираем префикс, оставляем только имя файла
          node[key] = value.substring("/api/media/".length);
          // console.log(`[writeContent] Cleaned image path for ${key}: ${node[key]}`); // Для отладки
        } else if (typeof value === "object" && value !== null) {
          cleanupImagePaths(value); // Рекурсивный вызов для вложенных объектов
        }
      });
    };

    console.log("[writeContent] Cleaning image paths before writing...");
    cleanupImagePaths(contentCopy); // Очищаем пути в копии
    console.log("[writeContent] Image paths cleaned.");

    // Записываем очищенные данные
    const dataString = JSON.stringify(contentCopy, null, 2); // Отступы в 2 пробела
    await fs.writeFile(contentFilePath, dataString, "utf-8");
    console.log(
      `[writeContent] Content file ${contentFilePath} updated successfully with cleaned image paths.`
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
