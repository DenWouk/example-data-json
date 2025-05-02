// src/lib/fs-utils.ts
import fs from 'fs/promises';
import path from 'path';
import { AppContent } from '@/types/types';
import { createDefaultAppContent, normalizeAppContent } from './content-utils';

const mediaFolderPath = path.join(process.cwd(), 'media');
const contentFolderPath = path.join(process.cwd(), 'public', 'content'); // Папка для JSON
const contentFilePath = path.join(contentFolderPath, 'content.json');
const exContentFilePath = path.join(contentFolderPath, 'ex-content.json'); // Путь к файлу бэкапа

// --- Функции для медиа ---

/** Получает полный, безопасный путь к файлу в папке media */
export function getMediaFilePath(filename: string): string {
    const safeFilename = path.normalize(filename).replace(/^(\.\.(\/|\\|$))+/, '');
    if (safeFilename.includes('..') || path.isAbsolute(safeFilename)) {
       throw new Error('Invalid filename detected.');
    }
   return path.join(mediaFolderPath, safeFilename);
}

/** Проверяет существование файла в папке media */
export async function checkMediaFileExists(filename: string | null | undefined): Promise<boolean> {
    if (!filename) return false;
    try {
        await fs.access(getMediaFilePath(filename));
        return true;
    } catch {
        return false;
    }
}

/** Безопасно удаляет файл из media (игнорирует ENOENT) */
export async function safeUnlink(filename: string | null | undefined) {
    if (!filename) return;
    try {
        await fs.unlink(getMediaFilePath(filename));
        console.log(`Successfully deleted file: ${filename}`);
    } catch (error: any) {
        if (error.code !== 'ENOENT') {
            console.error(`Error deleting file ${filename}:`, error);
            throw error; // Пробрасываем другие ошибки
        }
    }
}

/** Безопасно переименовывает файл в media */
export async function safeRename(
    oldFilename: string | null | undefined,
    newFilename: string | null | undefined
) {
    if (!oldFilename || !newFilename) {
        throw new Error("Old or new filename is missing for rename operation.");
    }
    const oldPath = getMediaFilePath(oldFilename);
    const newPath = getMediaFilePath(newFilename);
    try {
        await fs.rename(oldPath, newPath);
        console.log(`Successfully renamed ${oldFilename} to ${newFilename}`);
    } catch (error) {
        console.error(`Error renaming file ${oldFilename} to ${newFilename}:`, error);
        throw error; // Пробрасываем ошибку дальше
    }
}

// --- Функции для контента ---

/** Читает основной файл контента */
export async function readContentFile(): Promise<string> {
    return fs.readFile(contentFilePath, 'utf-8');
}

/** Читает файл бэкапа контента (возвращает null если нет) */
export async function readExContentFile(): Promise<string | null> {
    try {
        return await fs.readFile(exContentFilePath, 'utf-8');
    } catch (error: any) {
        if (error.code === 'ENOENT') {
            return null; // Файла бэкапа еще нет
        }
        console.error("Error reading ex-content file:", error);
        throw error; // Другие ошибки чтения пробрасываем
    }
}

/** Записывает основной файл контента */
export async function writeContentFile(data: string): Promise<void> {
    await fs.writeFile(contentFilePath, data, 'utf-8');
}

/** Записывает файл бэкапа контента */
export async function writeExContentFile(data: string): Promise<void> {
    await fs.writeFile(exContentFilePath, data, 'utf-8');
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
