// src/app/admin/actions.ts
"use server";

import fs from "fs/promises";
import path from "path";
import { revalidatePath } from "next/cache";
// Используем ТОЛЬКО SpecificAppContent и производные типы
import {
    AppContent,
    SpecificPageKey,
    SectionKeyForPage,
    SectionDataType // Тип для данных формы/обновленной секции
} from "@/types/types";
import { isImageField, normalizeSectionData } from "@/lib/content-utils"; // Используем normalizeSectionData
import {
  getContent, // Возвращает Promise<SpecificAppContent> или кидает ошибку
  writeContent, // Принимает SpecificAppContent
  safeUnlink,
  getSafeMediaFilePath,
} from "@/lib/fs-utils";

// --- Константы ---
const mediaBaseFolderPath = path.join(process.cwd(), "media");
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_FILE_TYPES = [
  "image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml",
];

// --- Server Action для получения контента для админки ---
// Теперь возвращает SpecificAppContent или кидает ошибку
export async function getAdminContent(): Promise<AppContent> {
  console.log("Server Action: getAdminContent called");
  // getContent уже возвращает Promise<SpecificAppContent> или ошибку
  // Обработка ошибки должна быть на клиенте (в AdminPage)
  return await getContent();
}

// --- Server Action для обновления секции ---
export async function updateSectionContent<P extends SpecificPageKey>( // Обобщаем по ключу страницы
  pageKey: P, // Принимаем конкретный ключ страницы
  sectionKey: SectionKeyForPage<P>, // Ключ секции зависит от страницы
  formData: FormData
): Promise<{
  success: boolean;
  message: string;
  updatedSection?: SectionDataType; // Возвращаем обновленную секцию как SectionDataType
}> {
  console.log(
    `Server Action: updateSectionContent called for ${pageKey}/${String(sectionKey)}` // Приводим sectionKey к строке для лога
  );

  const imageFile = formData.get("imageFile") as File | null;
  const imageFieldKey = formData.get("imageFieldKey") as string | null;
  const sectionDataJson = formData.get("sectionDataJson") as string | null;

  // ... (проверки входных данных formData) ...
   if (!sectionDataJson) return { success: false, message: "Error: Missing section data." };
   if (imageFile && !imageFieldKey) return { success: false, message: "Error: Image file provided without field key."};
   if (imageFieldKey && !isImageField(imageFieldKey)) return { success: false, message: `Error: Invalid image field key: ${imageFieldKey}`};


  let sectionDataFromClient: SectionDataType;
  try {
      const parsedData: unknown = JSON.parse(sectionDataJson);
      if (typeof parsedData !== 'object' || parsedData === null) {
         throw new Error("Parsed section data is not an object.");
      }
      // Нормализуем данные от клиента до { [key: string]: string }
      sectionDataFromClient = normalizeSectionData(parsedData);
  } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      console.error("Failed to parse or normalize sectionDataJson:", errorMessage);
      return { success: false, message: `Error: Invalid section data format. (${errorMessage})` };
  }

  let finalSectionData: SectionDataType = { ...sectionDataFromClient };
  let oldFilenameToDelete: string | null = null;
  let savedNewFilename: string | null = null;

  try {
    // Получаем текущий контент как SpecificAppContent (или ловим ошибку выше)
    const currentContent = await getContent();

    // Доступ к текущей секции теперь типобезопасен
    // Тип currentSection будет SpecificAppContent[P][S]
    const currentSection = currentContent[pageKey]?.[sectionKey]; // Доступ по ключам

    // --- Обработка файла ИЗОБРАЖЕНИЯ ---
    if (imageFile && imageFieldKey && isImageField(imageFieldKey)) {
        // ... (валидация файла) ...
        if (imageFile.size > MAX_FILE_SIZE) return { success: false, message: `File too large (max ${MAX_FILE_SIZE / 1024 / 1024}MB)` };
        if (!ALLOWED_FILE_TYPES.includes(imageFile.type)) return { success: false, message: `Invalid file type. Allowed: ${ALLOWED_FILE_TYPES.join(", ")}`};

        // ... (генерация имени и сохранение) ...
        const fileExtension = path.extname(imageFile.name) || '.unknown';
        const safeBaseName = path.basename(imageFile.name, fileExtension).replace(/[^a-z0-9_.-]/gi, "_").toLowerCase() || "image";
        const newFilename = `${Date.now()}-${safeBaseName}${fileExtension}`;
        const savePath = getSafeMediaFilePath(newFilename);
        await fs.mkdir(mediaBaseFolderPath, { recursive: true });
        const bytes = await imageFile.arrayBuffer();
        await fs.writeFile(savePath, Buffer.from(bytes));
        console.log(`File saved successfully to: ${savePath}`);

        savedNewFilename = newFilename;
        finalSectionData[imageFieldKey] = newFilename; // Обновляем данные для сохранения

        // Определяем старый файл. currentSection теперь строго типизирован
        const oldFilename = currentSection?.[imageFieldKey as keyof typeof currentSection]; // Доступ по ключу к типу секции
        if (oldFilename && typeof oldFilename === 'string' && oldFilename !== newFilename) {
            oldFilenameToDelete = oldFilename;
        }
    } else if (imageFieldKey && isImageField(imageFieldKey) && finalSectionData[imageFieldKey] === "") {
        // Случай очистки поля
        const oldFilename = currentSection?.[imageFieldKey as keyof typeof currentSection];
         if (oldFilename && typeof oldFilename === 'string') {
            oldFilenameToDelete = oldFilename;
        }
        finalSectionData[imageFieldKey] = "";
    }
     // --- Конец обработки изображения ---

    // --- Обновление content.json ---
    // Создаем новый объект контента
    const newAppContent: AppContent = {
      ...currentContent, // Берем текущий SpecificAppContent
      [pageKey]: { // Перезаписываем страницу
        ...currentContent[pageKey], // Берем существующие секции этой страницы
        [sectionKey]: { // Перезаписываем секцию
            // Важно: Мы должны преобразовать finalSectionData (Record<string, string>)
            // обратно в тип секции SpecificAppContent[P][S].
            // Простейший способ - скопировать существующую секцию и обновить поля из finalSectionData.
            // Это предполагает, что finalSectionData содержит ТОЛЬКО ключи, существующие в SpecificAppContent[P][S].
             ...(currentContent[pageKey][sectionKey]), // Берем текущие поля секции
             ...finalSectionData // Перезаписываем измененными значениями
             // ВНИМАНИЕ: Если finalSectionData содержит лишние ключи, они тоже запишутся!
             // Для строгой безопасности нужна дополнительная фильтрация ключей finalSectionData.
        } as AppContent[P][SectionKeyForPage<P>] // Type assertion для уверенности
      },
    };

    // Записываем обновленный SpecificAppContent
    await writeContent(newAppContent);

    // --- Удаление старого файла ---
    if (oldFilenameToDelete) {
      await safeUnlink(oldFilenameToDelete);
    }

    // --- Ревалидация кэша ---
    const pagePath = pageKey === "home" ? "/" : `/${pageKey}`;
    revalidatePath(pagePath);
    revalidatePath('/admin');
    console.log(`Revalidated paths: ${pagePath} and /admin`);

    // --- Успешный ответ ---
    return {
      success: true,
      message: `Section '${String(sectionKey)}' on page '${pageKey}' updated successfully!`,
      // Возвращаем finalSectionData как SectionDataType
      updatedSection: finalSectionData,
    };

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Error updating section ${pageKey}/${String(sectionKey)}:`, error);
    if (savedNewFilename) await safeUnlink(savedNewFilename); // Откат файла
    return { success: false, message: `Failed to update section '${String(sectionKey)}'. Reason: ${errorMessage}` };
  }
}