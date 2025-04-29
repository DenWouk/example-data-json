// src/app/admin/actions.ts
'use server';

import { revalidatePath } from 'next/cache';
import { getContent, writeContent, AppContent, PageContent } from '@/lib/content';
import fs from 'fs/promises';
import path from 'path';
import { getMediaFilePath } from '@/lib/fsUtils'; // Нам может понадобиться путь для удаления

// --- Константы и хелперы ---
const mediaFolderPath = path.join(process.cwd(), 'media');
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB - установи свой лимит
const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

// Функция для безопасного удаления файла (игнорирует ошибки "не найден")
async function safeUnlink(filePath: string | null | undefined) {
    if (!filePath) return;
    try {
        const fullPath = getMediaFilePath(path.basename(filePath)); // Убедимся, что путь внутри media
        await fs.unlink(fullPath);
        console.log(`Successfully deleted old file: ${fullPath}`);
    } catch (error: any) {
        if (error.code !== 'ENOENT') { // Игнорируем ошибку "файл не найден"
            console.error(`Error deleting file ${filePath}:`, error);
        }
    }
}

// --- Обновленная Server Action ---
export async function updateAdminContent(
    pageKey: keyof AppContent,
    // currentContent: PageContent, // Больше не нужен здесь, получим свежий
    formData: FormData
): Promise<{ success: boolean; message: string; updatedContent?: PageContent }> { // Возвращаем обновленный контент для синхронизации формы
    console.log(`Server Action: updateAdminContent called for page: ${pageKey} with FormData`);

    // --- 1. Извлечение данных из FormData ---
    const title = formData.get('title') as string | null;
    const description = formData.get('description') as string | null;
    const imageFile = formData.get('imageFile') as File | null; // Имя поля для файла
    const removeImage = formData.get('removeImage') === 'on'; // Проверка чекбокса удаления
    const currentImageFilename = formData.get('currentImage') as string | null; // Текущее имя файла из скрытого поля

    // Базовая валидация текстовых полей
    if (!title || !description) {
        return { success: false, message: 'Title and Description are required.' };
    }

    let finalImageFilename: string | null = currentImageFilename; // Начинаем с текущего
    let oldFileToDelete: string | null = null;

    try {
        // --- 2. Обработка загруженного файла ---
        if (imageFile && imageFile.size > 0) {
            console.log(`Processing uploaded file: ${imageFile.name}, size: ${imageFile.size}, type: ${imageFile.type}`);

            // Валидация размера и типа
            if (imageFile.size > MAX_FILE_SIZE) {
                return { success: false, message: `File is too large (max ${MAX_FILE_SIZE / 1024 / 1024}MB).` };
            }
            if (!ALLOWED_FILE_TYPES.includes(imageFile.type)) {
                return { success: false, message: `Invalid file type. Allowed: ${ALLOWED_FILE_TYPES.join(', ')}` };
            }

            // Генерация уникального имени файла (например, timestamp-original_name.ext)
            const fileExtension = path.extname(imageFile.name);
            const uniqueFilename = `${Date.now()}-${path.basename(imageFile.name, fileExtension).replace(/[^a-z0-9]/gi, '_').toLowerCase()}${fileExtension}`;
            const savePath = path.join(mediaFolderPath, uniqueFilename);

            // Чтение буфера файла и запись на диск
            const bytes = await imageFile.arrayBuffer();
            const buffer = Buffer.from(bytes);
            await fs.writeFile(savePath, buffer);
            console.log(`File saved successfully to: ${savePath}`);

            // Устанавливаем новое имя файла для сохранения в JSON
            finalImageFilename = uniqueFilename;
            // Если было старое изображение, помечаем его для удаления ПОСЛЕ успешного обновления JSON
            if (currentImageFilename && currentImageFilename !== uniqueFilename) {
                oldFileToDelete = currentImageFilename;
            }

        } else if (removeImage && currentImageFilename) {
            // --- 3. Обработка удаления изображения (если файл не загружен) ---
            console.log(`Request to remove image: ${currentImageFilename}`);
            finalImageFilename = null; // Очищаем имя файла в JSON
             // Помечаем старое изображение для удаления ПОСЛЕ успешного обновления JSON
            oldFileToDelete = currentImageFilename;
        }
        // Если файл не загружен и флаг удаления не стоит, finalImageFilename остается currentImageFilename

        // --- 4. Обновление content.json ---
        const currentContentJson = await getContent(); // Получаем самый свежий контент
        const updatedPageData: PageContent = {
            title: title,
            description: description,
            image: finalImageFilename, // Используем финальное имя файла
        };

        const newContent = {
            ...currentContentJson,
            [pageKey]: updatedPageData,
        };

        await writeContent(newContent); // Записываем обновленный JSON

        // --- 5. Удаление старого файла (если необходимо) ---
        // Делаем это ПОСЛЕ успешной записи JSON
        if (oldFileToDelete) {
            await safeUnlink(oldFileToDelete);
        }

        // --- 6. Ревалидация кэша ---
        if (pageKey === 'home') {
             revalidatePath('/');
             console.log('Revalidated path: /');
        }
         if (pageKey === 'about') { // Пример для другой страницы
             revalidatePath('/about');
             console.log('Revalidated path: /about');
         }
        // revalidatePath('/', 'layout');

        return {
            success: true,
            message: 'Content updated successfully!',
            updatedContent: updatedPageData // Возвращаем обновленные данные страницы
        };

    } catch (error: any) {
        console.error('Error in updateAdminContent:', error);
        // Попытка удалить загруженный файл, если произошла ошибка ПОСЛЕ его сохранения, но ДО записи JSON
        if (imageFile && imageFile.size > 0 && finalImageFilename && !oldFileToDelete) {
             console.warn("Rolling back saved file due to error during content update...");
             await safeUnlink(finalImageFilename);
        }
        return { success: false, message: `Failed to update content: ${error.message}` };
    }
}

// getAdminContent остается без изменений
export async function getAdminContent(): Promise<AppContent> {
    console.log('Server Action: getAdminContent called');
    return await getContent();
}