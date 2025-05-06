// src/app/admin/actions.ts
"use server";

import fs from "fs/promises";
import path from "path";
import { revalidatePath } from "next/cache";
import {
  AppContent,
  PageKey,
  SectionKeyForPage,
  SectionDataType,
} from "@/types/types";
import { isImageField, normalizeSectionData } from "@/lib/content-utils";
import {
  getContent,
  writeContent,
  safeUnlink,
  getSafeMediaFilePath, // getSafeMediaFilePath все еще нужен для создания пути для writeFile
  safeRename,
  checkMediaFileExists, // Теперь возвращает полное имя файла или null
  findActualFilenameInMedia, // Новая функция
} from "@/lib/fs-utils";

// --- Константы ---
const mediaBaseFolderPath = path.join(process.cwd(), "media");
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_FILE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/svg+xml",
];
// Список поддерживаемых расширений для findActualFilenameInMedia (если он не экспортируется оттуда)
// const SUPPORTED_IMAGE_EXTENSIONS_FOR_ACTION = [".jpeg", ".jpg", ".png", ".webp", ".gif", ".svg"];

// --- Server Action для получения контента для админки ---
export async function getAdminContent(): Promise<AppContent> {
  // console.log("Server Action: getAdminContent called");
  return await getContent(); // getContent теперь обрабатывает базовые имена
}

// --- Server Action для обновления секции ---
export async function updateSectionContent<P extends PageKey>(
  pageKey: P,
  sectionKey: SectionKeyForPage<P>,
  formData: FormData
): Promise<{
  success: boolean;
  message: string;
  updatedSection?: SectionDataType;
}> {
  // console.log(`Server Action: updateSectionContent called for ${pageKey}/${String(sectionKey)}`);

  const imageFile = formData.get("imageFile") as File | null;
  const imageFieldKey = formData.get("imageFieldKey") as string | null; // Ключ поля, например "image1"
  const sectionDataJson = formData.get("sectionDataJson") as string | null;

  if (!sectionDataJson)
    return { success: false, message: "Error: Missing section data." };
  if (imageFile && !imageFieldKey)
    return {
      success: false,
      message: "Error: Image file provided without field key.",
    };
  if (imageFieldKey && !isImageField(imageFieldKey))
    return {
      success: false,
      message: `Error: Invalid image field key: ${imageFieldKey}`,
    };

  let sectionDataFromClient: SectionDataType;
  try {
    sectionDataFromClient = normalizeSectionData(JSON.parse(sectionDataJson));
  } catch (e: unknown) {
    const em = e instanceof Error ? e.message : String(e);
    return {
      success: false,
      message: `Error: Invalid section data format. (${em})`,
    };
  }

  let finalSectionData: SectionDataType = { ...sectionDataFromClient };
  // Для отката:
  let newFileWrittenToDiskFullName: string | null = null; // Полное имя файла, который был записан на диск
  let originalOldFileBaseNameFromContent: string | null = null; // Базовое имя из content.json до изменений
  let oldFileRenamedToPrevFullName: string | null = null; // Полное имя файла prev-старый.ext

  try {
    const currentContent = await getContent(); // Получаем контент, где пути к картинкам уже /api/media/имя.ext
    const currentSection = currentContent[pageKey]?.[sectionKey];

    // Извлекаем базовое имя старого файла из данных, которые пришли от клиента (finalSectionData)
    // или, если это поле не менялось текстом, оно будет содержать старое базовое имя.
    // Однако, currentContent содержит /api/media/путь.ext. Нужно быть аккуратным.
    // Лучше взять из currentContent, если оно там есть, и извлечь базовое имя.
    if (
      imageFieldKey &&
      currentSection?.[imageFieldKey as keyof typeof currentSection]
    ) {
      const imagePathFromCurrentContent = currentSection[
        imageFieldKey as keyof typeof currentSection
      ] as string;
      if (
        imagePathFromCurrentContent &&
        imagePathFromCurrentContent.startsWith("/api/media/")
      ) {
        const fullFilename = imagePathFromCurrentContent.substring(
          "/api/media/".length
        );
        originalOldFileBaseNameFromContent = path.basename(
          fullFilename,
          path.extname(fullFilename)
        );
      } else if (imagePathFromCurrentContent) {
        // Если там не URL, а просто имя (возможно, базовое)
        originalOldFileBaseNameFromContent = path.basename(
          imagePathFromCurrentContent,
          path.extname(imagePathFromCurrentContent)
        );
      }
    }
    // console.log(`[Action] Original old base name from content: ${originalOldFileBaseNameFromContent} for key ${imageFieldKey}`);

    // --- ОБРАБОТКА ИЗОБРАЖЕНИЯ ---
    if (imageFile && imageFieldKey && isImageField(imageFieldKey)) {
      // СЦЕНАРИЙ 1: ЗАГРУЖЕН НОВЫЙ ФАЙЛ
      if (imageFile.size > MAX_FILE_SIZE)
        return { success: false, message: `File too large.` };
      if (!ALLOWED_FILE_TYPES.includes(imageFile.type))
        return { success: false, message: `Invalid file type.` };

      const uploadedFileExtension = path.extname(imageFile.name) || ".unknown";
      const uploadedFileSanitizedBase =
        path
          .basename(imageFile.name, uploadedFileExtension)
          .replace(/[^a-z0-9_.-]/gi, "_")
          .toLowerCase() || "image";

      let targetBaseFilenameForContentJson: string; // Базовое имя для записи в content.json
      let targetFullFilenameForDisk: string; // Полное имя для записи на диск

      const actualOldFullFilename = originalOldFileBaseNameFromContent
        ? await findActualFilenameInMedia(originalOldFileBaseNameFromContent)
        : null;

      if (originalOldFileBaseNameFromContent && actualOldFullFilename) {
        // ЗАМЕНА существующего (originalOldFileBaseNameFromContent существует и найден на диске)
        targetBaseFilenameForContentJson = originalOldFileBaseNameFromContent; // Базовое имя остается тем же
        targetFullFilenameForDisk = `${targetBaseFilenameForContentJson}${uploadedFileExtension}`; // Новое расширение

        const oldFileOriginalExt = path.extname(actualOldFullFilename);
        const prevTargetNameForOldFile = `prev-${originalOldFileBaseNameFromContent}${oldFileOriginalExt}`;

        // Удаляем все предыдущие "prev-${originalOldFileBaseNameFromContent}.*"
        const filesInMediaFolder = await fs.readdir(mediaBaseFolderPath);
        for (const filenameInMedia of filesInMediaFolder) {
          if (
            filenameInMedia.startsWith(
              `prev-${originalOldFileBaseNameFromContent}.`
            )
          ) {
            // console.log(`[Action Replace] Deleting pre-existing prev-file: ${filenameInMedia}`);
            await safeUnlink(filenameInMedia); // safeUnlink работает с полными именами
          }
        }
        // Переименовываем старый реальный файл (actualOldFullFilename)
        // console.log(`[Action Replace] Renaming original file ${actualOldFullFilename} to ${prevTargetNameForOldFile}`);
        await safeRename(actualOldFullFilename, prevTargetNameForOldFile); // safeRename: (oldFullName, newFullName)
        oldFileRenamedToPrevFullName = prevTargetNameForOldFile;
      } else {
        // ДОБАВЛЕНИЕ нового (старого базового имени не было или старый файл не найден на диске)
        targetBaseFilenameForContentJson = `${Date.now()}-${uploadedFileSanitizedBase}`;
        targetFullFilenameForDisk = `${targetBaseFilenameForContentJson}${uploadedFileExtension}`;
        if (originalOldFileBaseNameFromContent && !actualOldFullFilename) {
          console.warn(
            `[Action Add] Old base name '${originalOldFileBaseNameFromContent}' was in content but not found on disk. Treating as new file.`
          );
        }
      }

      // Сохраняем новый загруженный файл на диск под полным именем
      const newFileSavePath = getSafeMediaFilePath(targetFullFilenameForDisk);
      await fs.mkdir(mediaBaseFolderPath, { recursive: true });
      const bytes = await imageFile.arrayBuffer();
      await fs.writeFile(newFileSavePath, Buffer.from(bytes));
      // console.log(`[Action SaveNew] New image saved as: ${targetFullFilenameForDisk}`);
      newFileWrittenToDiskFullName = targetFullFilenameForDisk;

      // В finalSectionData (и затем в content.json) сохраняем только БАЗОВОЕ имя
      finalSectionData[imageFieldKey] = targetBaseFilenameForContentJson;
    } else if (
      !imageFile &&
      imageFieldKey &&
      isImageField(imageFieldKey) &&
      finalSectionData[imageFieldKey] === ""
    ) {
      // СЦЕНАРИЙ 2: ПОЛЕ ОЧИЩАЕТСЯ (НОВЫЙ ФАЙЛ НЕ ЗАГРУЖЕН, в finalSectionData для этого ключа пусто)
      if (originalOldFileBaseNameFromContent) {
        const actualOldFullFilenameToClear = await findActualFilenameInMedia(
          originalOldFileBaseNameFromContent
        );

        if (actualOldFullFilenameToClear) {
          const oldFileOriginalExt = path.extname(actualOldFullFilenameToClear);
          const prevTargetNameForClearedFile = `prev-${originalOldFileBaseNameFromContent}${oldFileOriginalExt}`;

          // console.log(`[Action Clear] Clearing. Old base: ${originalOldFileBaseNameFromContent}, actual: ${actualOldFullFilenameToClear}. Renaming to ${prevTargetNameForClearedFile}`);

          const filesInMediaFolder = await fs.readdir(mediaBaseFolderPath);
          for (const filenameInMedia of filesInMediaFolder) {
            if (
              filenameInMedia.startsWith(
                `prev-${originalOldFileBaseNameFromContent}.`
              )
            ) {
              // console.log(`[Action Clear] Deleting pre-existing prev-file: ${filenameInMedia}`);
              await safeUnlink(filenameInMedia);
            }
          }
          await safeRename(
            actualOldFullFilenameToClear,
            prevTargetNameForClearedFile
          );
          oldFileRenamedToPrevFullName = prevTargetNameForClearedFile;
        } else {
          // console.warn(`[Action Clear] Old base name '${originalOldFileBaseNameFromContent}' was in content but actual file not found on disk. Nothing to rename to prev-.`);
        }
      }
      finalSectionData[imageFieldKey] = ""; // Убеждаемся, что в content.json будет пусто
    }
    // --- КОНЕЦ ОБРАБОТКИ ИЗОБРАЖЕНИЯ ---

    const newAppContent: AppContent = {
      ...currentContent, // currentContent уже имеет URLы /api/media/полное_имя.ext
      [pageKey]: {
        ...currentContent[pageKey],
        [sectionKey]: {
          // Здесь мы должны обновить секцию, используя finalSectionData, где имена картинок - базовые
          // Необходимо преобразовать currentContent[pageKey][sectionKey] так, чтобы значения картинок стали базовыми,
          // а потом уже делать merge с finalSectionData. Либо writeContent должен это разрулить.
          // writeContent УЖЕ ожидает, что ему могут прийти /api/media/полное_имя.ext и он их преобразует в базовые.
          // Так что можно просто смержить.
          ...currentContent[pageKey][sectionKey], // Это содержит URLы
          ...finalSectionData, // Это содержит базовые имена для измененных полей и значения для других полей
        } as AppContent[P][SectionKeyForPage<P>],
      },
    };
    // Перед записью, writeContent преобразует все значения imageField из /api/media/имя.ext или имя.ext в имя (базовое)

    await writeContent(newAppContent);

    const pagePath = pageKey === "home" ? "/" : `/${pageKey}`;
    revalidatePath(pagePath);
    revalidatePath("/admin");

    return {
      success: true,
      message: `Section '${String(sectionKey)}' on page '${pageKey}' updated.`,
      updatedSection: finalSectionData, // Возвращаем данные с базовыми именами для картинок
    };
  } catch (error: unknown) {
    const em = error instanceof Error ? error.message : String(error);
    console.error(
      `[Action UpdateSection] Error for ${pageKey}/${String(sectionKey)}:`,
      error
    );

    // --- Откат ---
    if (newFileWrittenToDiskFullName) {
      // console.log(`[Rollback] Deleting newly written file: ${newFileWrittenToDiskFullName}`);
      await safeUnlink(newFileWrittenToDiskFullName); // safeUnlink работает с полными именами
    }

    if (oldFileRenamedToPrevFullName && originalOldFileBaseNameFromContent) {
      // oldFileRenamedToPrevFullName это "prev-базовоеимя.староерасширение"
      // originalOldFileBaseNameFromContent это "базовоеимя"
      // Цель: "базовоеимя.староерасширение"
      const originalFullTargetForRollback =
        oldFileRenamedToPrevFullName.replace(/^prev-/, "");

      // console.log(`[Rollback] Renaming ${oldFileRenamedToPrevFullName} back to ${originalFullTargetForRollback}`);
      try {
        // Перед переименованием prev- обратно, нужно убедиться, что целевое имя не занято (маловероятно)
        // Особенно если newFileWrittenToDiskFullName был таким же и его удаление не удалось.
        const conflictExists = await checkMediaFileExists(
          originalFullTargetForRollback
        );
        if (
          conflictExists &&
          conflictExists !==
            newFileWrittenToDiskFullName /* не тот же файл, что мы пытались удалить */
        ) {
          console.warn(
            `[Rollback] Conflict: target ${originalFullTargetForRollback} exists and is not the new file. Cannot rename prev- file back safely.`
          );
        } else {
          if (
            conflictExists &&
            conflictExists === newFileWrittenToDiskFullName
          ) {
            // Повторная попытка удалить, если предыдущая не удалась и это был наш новый файл
            // console.log(`[Rollback] Attempting to clear target ${originalFullTargetForRollback} again.`);
            await safeUnlink(originalFullTargetForRollback);
          }
          await safeRename(
            oldFileRenamedToPrevFullName,
            originalFullTargetForRollback
          ); // (oldFullName, newFullName)
        }
      } catch (renameBackError) {
        console.error(
          `[Rollback] Failed to rename ${oldFileRenamedToPrevFullName} back:`,
          renameBackError
        );
      }
    }
    return { success: false, message: `Failed to update. Reason: ${em}` };
  }
}
