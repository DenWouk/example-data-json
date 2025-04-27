// src/lib/fsUtils.ts
import fs from "fs/promises";
import path from "path";

const mediaFolderPath = path.join(process.cwd(), "media");

/**
 * Проверяет, существует ли файл в папке media.
 * @param filename Имя файла (например, "example-image.jpg")
 * @returns true, если файл существует, иначе false.
 */
export async function checkMediaFileExists(
  filename: string | null | undefined
): Promise<boolean> {
  if (!filename) {
    return false;
  }
  const filePath = path.join(mediaFolderPath, filename);
  try {
    await fs.access(filePath); // Проверяем доступность файла
    return true;
  } catch (error) {
    // Ошибка означает, что файл не найден или нет прав доступа
    // console.warn(`Media file not found or inaccessible: ${filePath}`); // Можно раскомментировать для отладки
    return false;
  }
}

/**
 * Возвращает полный путь к файлу в папке media.
 * Используется API роутом для чтения файла.
 */
export function getMediaFilePath(filename: string): string {
  // Важно: Нормализуем путь и предотвращаем выход за пределы media/
  const safeFilename = path
    .normalize(filename)
    .replace(/^(\.\.(\/|\\|$))+/, "");
  if (safeFilename.includes("..")) {
    throw new Error("Invalid filename detected."); // Безопасность
  }
  return path.join(mediaFolderPath, safeFilename);
}
