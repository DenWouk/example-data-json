// src/app/admin/actions.ts
"use server";

import fs from "fs/promises";
import path from "path";
import { revalidatePath } from "next/cache";
import { AppContent, PageKey, SectionContent } from "../../types/types"; // Убедимся, что путь правильный
import { isImageField } from "@/lib/content-utils";
// Используем утилиты из fs-utils, включая безопасное удаление и получение пути
import {
  getContent,
  writeContent,
  safeUnlink, // Импортируем безопасное удаление
  getSafeMediaFilePath, // Импортируем получение безопасного пути для записи
} from "@/lib/fs-utils";

// --- Константы ---
// Папку media теперь получаем через getSafeMediaFilePath, но базовый путь нужен
const mediaBaseFolderPath = path.join(process.cwd(), "media");
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_FILE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/svg+xml", // Добавим SVG как пример
];

// Локальная функция safeUnlink удалена, используется импортированная

// --- Server Action для получения всего контента ---
export async function getAdminContent(): Promise<AppContent> {
  console.log("Server Action: getAdminContent called");
  // Просто вызываем функцию чтения контента, которая уже включает нормализацию
  return await getContent();
}

// --- ОБНОВЛЕННЫЙ Server Action для обновления КОНКРЕТНОЙ СЕКЦИИ ---
export async function updateSectionContent(
  pageKey: PageKey,
  sectionKey: string,
  formData: FormData
): Promise<{
  // Уточнили тип возвращаемого значения
  success: boolean;
  message: string;
  updatedSection?: SectionContent; // Обновленная секция возвращается при успехе
}> {
  console.log(
    `Server Action: updateSectionContent called for ${pageKey}/${sectionKey}`
  );

  // --- 1. Извлечение данных из FormData ---
  const imageFile = formData.get("imageFile") as File | null;
  const imageFieldKey = formData.get("imageFieldKey") as string | null;
  const sectionDataJson = formData.get("sectionDataJson") as string | null;

  if (!sectionDataJson) {
    return {
      success: false,
      message: "Error: Missing section data. Cannot save.",
    };
  }
  if (imageFile && !imageFieldKey) {
    return {
      success: false,
      message:
        "Error: Image file was provided, but its target field key is missing.",
    };
  }
  if (imageFieldKey && !isImageField(imageFieldKey)) {
    return {
      success: false,
      message: `Error: The field key '${imageFieldKey}' is not designated for images.`,
    };
  }

  let sectionDataFromClient: SectionContent;
  try {
    sectionDataFromClient = JSON.parse(sectionDataJson);
    if (
      typeof sectionDataFromClient !== "object" ||
      sectionDataFromClient === null
    ) {
      throw new Error("Parsed section data is not a valid object.");
    }
    // Нормализация на всякий случай (хотя клиент должен присылать строки)
    Object.keys(sectionDataFromClient).forEach((key) => {
      sectionDataFromClient[key] = String(sectionDataFromClient[key] ?? "");
    });
  } catch (e: unknown) {
    // Типизируем ошибку как unknown
    const errorMessage = e instanceof Error ? e.message : String(e);
    console.error("Failed to parse or validate sectionDataJson:", errorMessage);
    return {
      success: false,
      message: `Error: Invalid section data format received. (${errorMessage})`,
    };
  }

  // Копируем данные для модификации
  let finalSectionData: SectionContent = { ...sectionDataFromClient };
  let oldFilenameToDelete: string | null = null; // Имя старого файла для удаления
  let savedNewFilename: string | null = null; // Имя нового сохраненного файла (для отката)

  try {
    const currentContent = await getContent(); // Получаем текущий контент
    const currentSection = currentContent?.[pageKey]?.[sectionKey]; // Текущие данные секции

    // --- 2. Обработка файла ИЗОБРАЖЕНИЯ (если был загружен) ---
    if (imageFile && imageFieldKey) {
      // Валидация
      if (imageFile.size > MAX_FILE_SIZE) {
        return {
          success: false,
          message: `Image file is too large. Maximum size is ${
            MAX_FILE_SIZE / 1024 / 1024
          }MB.`,
        };
      }
      if (!ALLOWED_FILE_TYPES.includes(imageFile.type)) {
        return {
          success: false,
          message: `Invalid image file type ('${
            imageFile.type
          }'). Allowed types: ${ALLOWED_FILE_TYPES.join(", ")}`,
        };
      }

      // Генерация уникального и безопасного имени
      const fileExtension = path.extname(imageFile.name) || ".unknown"; // Расширение
      const safeBaseName =
        path
          .basename(imageFile.name, fileExtension)
          .replace(/[^a-z0-9_.-]/gi, "_") // Оставляем только безопасные символы
          .toLowerCase() || "image"; // Базовое имя файла
      const newFilename = `${Date.now()}-${safeBaseName}${fileExtension}`;

      // Получаем БЕЗОПАСНЫЙ путь для записи через утилиту
      const savePath = getSafeMediaFilePath(newFilename);
      // Убедимся, что директория существует (на случай, если media удалили)
      await fs.mkdir(mediaBaseFolderPath, { recursive: true });

      const bytes = await imageFile.arrayBuffer();
      await fs.writeFile(savePath, Buffer.from(bytes));
      console.log(`File saved successfully to: ${savePath}`);

      savedNewFilename = newFilename; // Запоминаем имя сохраненного файла для возможного отката
      finalSectionData[imageFieldKey] = newFilename; // Обновляем имя файла в данных

      // Определяем старый файл для удаления
      const oldFilename = currentSection?.[imageFieldKey];
      if (oldFilename && oldFilename !== newFilename) {
        oldFilenameToDelete = oldFilename; // Был старый файл, и он отличается от нового
        console.log(`Marking old file for deletion: ${oldFilename}`);
      }
    } else if (imageFieldKey && finalSectionData[imageFieldKey] === "") {
      // Случай: поле изображения было очищено на клиенте (файл не загружался)
      const oldFilename = currentSection?.[imageFieldKey];
      if (oldFilename) {
        oldFilenameToDelete = oldFilename; // Был старый файл, его нужно удалить
        console.log(
          `Image field '${imageFieldKey}' cleared. Marking old file for deletion: ${oldFilename}`
        );
      }
      // Убедимся, что в финальных данных точно пустая строка
      finalSectionData[imageFieldKey] = "";
    }
    // Если файл не загружался и поле не очищалось, значение imageFieldKey остается тем, что пришло от клиента.

    // --- 3. Обновление content.json ---
    const newAppContent: AppContent = {
      ...currentContent,
      [pageKey]: {
        ...(currentContent?.[pageKey] || {}),
        [sectionKey]: finalSectionData, // Обновляем конкретную секцию
      },
    };
    await writeContent(newAppContent); // Запись с нормализацией внутри

    // --- 4. Удаление старого файла (ПОСЛЕ успешной записи JSON) ---
    if (oldFilenameToDelete) {
      await safeUnlink(oldFilenameToDelete); // Используем безопасное удаление
    }

    // --- 5. Ревалидация кэша ---
    // Определяем путь страницы (для home это '/', для остальных '/имя_страницы')
    const pagePath = pageKey === "home" ? "/" : `/${String(pageKey)}`;
    revalidatePath(pagePath);
    revalidatePath("/admin"); // Ревалидируем и админку на всякий случай
    console.log(`Revalidated paths: ${pagePath} and /admin`);

    // --- 6. Успешный ответ ---
    return {
      success: true,
      message: `Section '${sectionKey}' on page '${pageKey}' updated successfully! Reload may be needed to see image changes immediately.`,
      updatedSection: finalSectionData, // Возвращаем обновленные данные
    };
  } catch (error: unknown) {
    // Типизируем ошибку
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Error updating section ${pageKey}/${sectionKey}:`, error);

    // --- Попытка отката ---
    // Если новый файл был сохранен, но произошла ошибка ПОСЛЕ этого (например, при записи JSON или удалении старого)
    if (savedNewFilename) {
      console.warn(
        `Rolling back saved file '${savedNewFilename}' due to error during content update...`
      );
      await safeUnlink(savedNewFilename); // Удаляем только что сохраненный файл
    }

    // Возвращаем ошибку
    return {
      success: false,
      message: `Failed to update section '${sectionKey}'. Reason: ${errorMessage}`,
    };
  }
}
