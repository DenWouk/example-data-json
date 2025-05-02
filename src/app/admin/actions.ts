// src/app/admin/actions.ts
"use server";

import fs from "fs/promises";
import path from "path";
import { revalidatePath } from "next/cache";
import { AppContent, PageKey, SectionContent } from "../../types/types";
import { isImageField } from "@/lib/content-utils"; // Утилита для проверки ключа
import { getContent, getMediaFilePath, writeContent } from "@/lib/fs-utils";

// --- Константы и хелперы ---
const mediaFolderPath = path.join(process.cwd(), "media");
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB - используется при валидации файла
const ALLOWED_FILE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]; // Используется при валидации файла

// Функция безопасного удаления файла - используется
async function safeUnlink(filePath: string | null | undefined) {
  if (!filePath) return;
  try {
    // Используем basename для большей безопасности пути
    const fullPath = getMediaFilePath(path.basename(filePath));
    await fs.unlink(fullPath);
    console.log(`Successfully deleted old file: ${fullPath}`);
  } catch (error: any) {
    // Игнорируем ошибку "файл не найден", но логируем другие ошибки
    if (error.code !== "ENOENT") {
      console.error(`Error deleting file ${filePath}:`, error);
    }
  }
}

// --- Server Action для получения всего контента ---
export async function getAdminContent(): Promise<AppContent> {
  console.log("Server Action: getAdminContent called");
  // Просто вызываем функцию чтения контента
  return await getContent(); // <-- ВОССТАНОВЛЕНО ТЕЛО ФУНКЦИИ
}

// --- ОБНОВЛЕННЫЙ Server Action для обновления КОНКРЕТНОЙ СЕКЦИИ ---
export async function updateSectionContent(
  pageKey: PageKey, // Ключ страницы
  sectionKey: string, // Ключ секции
  formData: FormData // FormData содержит файл (если есть) и JSON секции
  // Возвращает обновленную секцию
): Promise<{
  success: boolean;
  message: string;
  updatedSection?: SectionContent;
}> {
  // <-- ТИП ВОЗВРАЩАЕМОГО ЗНАЧЕНИЯ
  console.log(
    `Server Action: updateSectionContent called for ${pageKey}/${sectionKey}`
  );

  // --- 1. Извлечение данных из FormData ---
  const imageFile = formData.get("imageFile") as File | null; // Загруженный файл
  const imageFieldKey = formData.get("imageFieldKey") as string | null; // Ключ поля, к которому относится файл
  const sectionDataJson = formData.get("sectionDataJson") as string | null; // Данные секции от клиента

  // Проверки наличия данных
  if (!sectionDataJson) {
    return { success: false, message: "Error: Section data JSON is missing." };
  }
  if (imageFile && !imageFieldKey) {
    return {
      success: false,
      message: "Error: Image file provided without corresponding field key.",
    };
  }
  // Проверяем, что ключ для файла - действительно ключ изображения
  if (imageFieldKey && !isImageField(imageFieldKey)) {
    return {
      success: false,
      message: `Error: Invalid image field key provided: ${imageFieldKey}`,
    };
  }

  let sectionDataFromClient: SectionContent;
  try {
    // Парсим JSON от клиента
    sectionDataFromClient = JSON.parse(sectionDataJson);
    if (
      typeof sectionDataFromClient !== "object" ||
      sectionDataFromClient === null
    ) {
      throw new Error("Parsed section data is not an object.");
    }
    // Нормализуем значения до строк (на всякий случай)
    Object.keys(sectionDataFromClient).forEach((key) => {
      sectionDataFromClient[key] = String(sectionDataFromClient[key] ?? "");
    });
  } catch (e) {
    console.error("Failed to parse or validate sectionDataJson:", e);
    return {
      success: false,
      message: "Error: Invalid section data format received.",
    };
  }

  // Копируем данные для дальнейшей модификации (особенно имени файла)
  let finalSectionData = { ...sectionDataFromClient };
  let oldFileToDelete: string | null = null; // Переменная для хранения имени старого файла

  try {
    // Получаем текущее состояние контента для сравнения
    const currentContent = await getContent(); // Данные уже нормализованы
    const currentSection = currentContent?.[pageKey]?.[sectionKey];

    // --- 2. Обработка файла ИЗОБРАЖЕНИЯ (если был загружен) ---
    if (imageFile && imageFieldKey) {
      // Валидация размера файла
      if (imageFile.size > MAX_FILE_SIZE) {
        return {
          success: false,
          message: `File is too large (max ${MAX_FILE_SIZE / 1024 / 1024}MB).`,
        };
      }
      // Валидация типа файла
      if (!ALLOWED_FILE_TYPES.includes(imageFile.type)) {
        return {
          success: false,
          message: `Invalid file type. Allowed: ${ALLOWED_FILE_TYPES.join(
            ", "
          )}`,
        };
      }

      // Генерация уникального имени и сохранение файла
      const fileExtension = path.extname(imageFile.name);
      const safeBaseName = path
        .basename(imageFile.name, fileExtension)
        .replace(/[^a-z0-9_.-]/gi, "_")
        .toLowerCase();
      const newFilename = `${Date.now()}-${safeBaseName}${fileExtension}`;
      const savePath = path.join(mediaFolderPath, newFilename);

      const bytes = await imageFile.arrayBuffer();
      const buffer = Buffer.from(bytes);
      await fs.writeFile(savePath, buffer);
      console.log(`File saved successfully to: ${savePath}`);

      // Обновляем имя файла в данных, которые будем сохранять
      finalSectionData[imageFieldKey] = newFilename;

      // Определяем, нужно ли удалять старый файл
      const oldFilename = currentSection?.[imageFieldKey];
      if (oldFilename && oldFilename !== newFilename) {
        // Был старый файл, и он не совпадает с новым
        oldFileToDelete = oldFilename;
      }
    } else if (imageFieldKey && finalSectionData[imageFieldKey] === "") {
      // Случай, когда файл не загружен, но поле картинки было очищено клиентом (стало '')
      const oldFilename = currentSection?.[imageFieldKey];
      if (oldFilename) {
        // Удаляем старый файл только если он действительно был
        console.log(
          `Image field '${imageFieldKey}' was cleared by client. Marking old file for deletion: ${oldFilename}`
        );
        oldFileToDelete = oldFilename;
      }
      // Убедимся, что в финальных данных точно пустая строка
      finalSectionData[imageFieldKey] = "";
    }
    // Если файл не загружен и поле не очищено, finalSectionData[imageFieldKey] останется таким, каким пришло от клиента.

    // --- 3. Обновление content.json ---
    // Создаем новый объект всего контента
    const newAppContent: AppContent = {
      ...currentContent, // Берем весь текущий контент
      [pageKey]: {
        // Обновляем страницу по ключу
        ...(currentContent?.[pageKey] || {}), // Берем все существующие секции этой страницы
        [sectionKey]: finalSectionData, // Перезаписываем измененную секцию новыми данными
      },
    };
    // Записываем обновленный контент в файл (с нормализацией внутри writeContent)
    await writeContent(newAppContent);

    // --- 4. Удаление старого файла (после успешной записи JSON) ---
    if (oldFileToDelete) {
      await safeUnlink(oldFileToDelete);
    }

    // --- 5. Ревалидация кэша ---
    const pagePath = pageKey === "home" ? "/" : `/${pageKey}`; // Определяем путь для ревалидации
    revalidatePath(pagePath);
    console.log(`Revalidated path: ${pagePath}`);

    // --- 6. Успешный ответ ---
    return {
      success: true,
      message: `Section '${sectionKey}' on page '${pageKey}' updated successfully!`,
      updatedSection: finalSectionData, // Возвращаем финальные данные обновленной секции
    };
  } catch (error: any) {
    // --- Обработка ошибок ---
    console.error(`Error updating section ${pageKey}/${sectionKey}:`, error);
    // Попытка отката (удаления) загруженного файла, если запись JSON не удалась
    if (
      imageFile &&
      imageFieldKey &&
      finalSectionData[imageFieldKey] &&
      !oldFileToDelete
    ) {
      // Проверяем, что имя файла было установлено в finalSectionData и не было помечено для удаления по другой причине
      console.warn(
        "Rolling back saved file due to error during content update..."
      );
      await safeUnlink(finalSectionData[imageFieldKey]);
    }
    // Возвращаем ошибку
    return {
      success: false,
      message: `Failed to update section: ${error.message}`,
    };
  }
}
