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
import { generateLabel, isImageField, normalizeSectionData } from "@/lib/content-utils";
import {
  getContent,
  writeContent,
  safeUnlink,
  getSafeMediaFilePath,
  safeRename,
  checkMediaFileExists,
  findActualFilenameInMedia,
} from "@/lib/fs-utils";

const mediaBaseFolderPath = path.join(process.cwd(), "media");
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_FILE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/svg+xml",
];

interface FileOperation {
  type: "rename";
  fromPath: string; // Полный путь к файлу, который был переименован (например, prev-имя.ext)
  toPath: string; // Полный путь, куда он был переименован (например, имя.ext)
  originalFromPath?: string; // Изначальное имя файла до того, как он стал prev- (для отката rename prev- back to original)
}

interface DeleteOperation {
  type: "delete";
  filePath: string; // Полный путь к файлу, который был создан и должен быть удален при откате
}

type RollbackOperation = FileOperation | DeleteOperation;

export async function getAdminContent(): Promise<AppContent> {
  return await getContent();
}

export async function updateSectionContent<P extends PageKey>(
  pageKey: P,
  sectionKey: SectionKeyForPage<P>,
  formData: FormData
): Promise<{
  success: boolean;
  message: string;
  updatedSection?: SectionDataType;
}> {
  const pageAndSection = `${pageKey}/${String(sectionKey)}`;
  // console.log(`[Action START] updateSectionContent for ${pageAndSection}`);

  const sectionDataJson = formData.get("sectionDataJson") as string | null;
  if (!sectionDataJson) {
    return { success: false, message: "Error: Missing section data." };
  }

  let sectionDataFromClient: SectionDataType;
  try {
    const parsedData = JSON.parse(sectionDataJson);
    sectionDataFromClient = normalizeSectionData(parsedData);
  } catch (e: unknown) {
    const em = e instanceof Error ? e.message : String(e);
    return { success: false, message: `Error parsing section data: ${em}` };
  }

  // `finalSectionData` будет аккумулировать все изменения в полях секции (текст и базовые имена изображений)
  // и в итоге будет использован для обновления AppContent и возвращен клиенту.
  let finalSectionData: SectionDataType = { ...sectionDataFromClient };
  const rollbackOps: RollbackOperation[] = [];

  try {
    const currentContent = await getContent(); // Содержит URL-ы вида /api/media/имя.ext
    const currentSectionFromServer = currentContent[pageKey]?.[sectionKey];

    // --- 1. Обработка ЗАГРУЖЕННЫХ файлов ---
    const uploadedImageFiles = formData.getAll("imageFile") as File[];
    const uploadedImageFieldKeys = formData.getAll("imageFieldKey") as string[];

    if (uploadedImageFiles.length !== uploadedImageFieldKeys.length) {
      return {
        success: false,
        message: "Mismatch between image files and field keys count.",
      };
    }

    for (let i = 0; i < uploadedImageFiles.length; i++) {
      const imageFile = uploadedImageFiles[i];
      const imageFieldKey = uploadedImageFieldKeys[i]; // Ключ поля, например, "image1"

      // console.log(`[Action Process Upload] Field: ${imageFieldKey}, File: ${imageFile.name}`);

      // Валидация файла
      if (imageFile.size > MAX_FILE_SIZE) {
        throw new Error(
          `File for '${generateLabel(imageFieldKey)}' too large.`
        );
      }
      if (!ALLOWED_FILE_TYPES.includes(imageFile.type)) {
        throw new Error(
          `Invalid file type for '${generateLabel(imageFieldKey)}'.`
        );
      }

      const uploadedFileExtension = path.extname(imageFile.name) || ".unknown";
      const uploadedFileSanitizedBase =
        path
          .basename(imageFile.name, uploadedFileExtension)
          .replace(/[^a-z0-9_.-]/gi, "_")
          .toLowerCase() || "image";

      let targetBaseFilenameForContentJson: string;
      let targetFullFilenameForDisk: string;

      // Определяем, было ли старое изображение для этого imageFieldKey
      let originalOldFileBaseNameFromContent: string | null = null;
      if (
        currentSectionFromServer?.[
          imageFieldKey as keyof typeof currentSectionFromServer
        ]
      ) {
        const imgPath = currentSectionFromServer[
          imageFieldKey as keyof typeof currentSectionFromServer
        ] as string;
        if (imgPath && imgPath.startsWith("/api/media/")) {
          const fullFn = imgPath.substring("/api/media/".length);
          originalOldFileBaseNameFromContent = path.basename(
            fullFn,
            path.extname(fullFn)
          );
        } else if (imgPath) {
          // Если там не URL, а просто имя (хотя getContent должен давать URL)
          originalOldFileBaseNameFromContent = path.basename(
            imgPath,
            path.extname(imgPath)
          );
        }
      }
      // console.log(`[Action Process Upload] Field ${imageFieldKey}, old base name from content: ${originalOldFileBaseNameFromContent}`);

      const actualOldFullFilename = originalOldFileBaseNameFromContent
        ? await findActualFilenameInMedia(originalOldFileBaseNameFromContent)
        : null;

      if (originalOldFileBaseNameFromContent && actualOldFullFilename) {
        // ЗАМЕНА существующего
        targetBaseFilenameForContentJson = originalOldFileBaseNameFromContent;
        targetFullFilenameForDisk = `${targetBaseFilenameForContentJson}${uploadedFileExtension}`;
        const oldFileOriginalExt = path.extname(actualOldFullFilename);
        const prevTargetNameForOldFile = `prev-${originalOldFileBaseNameFromContent}${oldFileOriginalExt}`;

        // Удаляем все предыдущие "prev-${originalOldFileBaseNameFromContent}.*"
        const filesInMedia = await fs.readdir(mediaBaseFolderPath);
        for (const fn of filesInMedia) {
          if (fn.startsWith(`prev-${originalOldFileBaseNameFromContent}.`)) {
            // console.log(`[Action Pre-delete prev] ${fn}`);
            const fullPathToDel = getSafeMediaFilePath(fn); // Нужно для safeUnlink, если он не ищет по базовому
            await safeUnlink(fn); // safeUnlink теперь ищет реальный файл по базовому имени, если нужно
          }
        }
        // console.log(`[Action Rename Old] ${actualOldFullFilename} -> ${prevTargetNameForOldFile}`);
        await safeRename(actualOldFullFilename, prevTargetNameForOldFile);
        rollbackOps.push({
          type: "rename",
          fromPath: getSafeMediaFilePath(prevTargetNameForOldFile),
          toPath: getSafeMediaFilePath(actualOldFullFilename),
        });
      } else {
        // ДОБАВЛЕНИЕ нового
        targetBaseFilenameForContentJson = `${Date.now()}-${uploadedFileSanitizedBase}-${i}`; // Добавляем индекс для уникальности
        targetFullFilenameForDisk = `${targetBaseFilenameForContentJson}${uploadedFileExtension}`;
        if (originalOldFileBaseNameFromContent && !actualOldFullFilename) {
          console.warn(
            `[Action Add] Old base name '${originalOldFileBaseNameFromContent}' for ${imageFieldKey} was in content but not found on disk.`
          );
        }
      }

      const newFileSavePath = getSafeMediaFilePath(targetFullFilenameForDisk);
      await fs.mkdir(mediaBaseFolderPath, { recursive: true });
      const bytes = await imageFile.arrayBuffer();
      await fs.writeFile(newFileSavePath, Buffer.from(bytes));
      // console.log(`[Action Save New] Saved ${imageFieldKey} as: ${targetFullFilenameForDisk}`);
      rollbackOps.push({ type: "delete", filePath: newFileSavePath });

      finalSectionData[imageFieldKey] = targetBaseFilenameForContentJson;
    } // End for loop (uploadedImageFiles)

    // --- 2. Обработка ОЧИЩЕННЫХ полей изображений ---
    // (тех, для которых не было загрузки нового файла, но в sectionDataFromClient они пустые)
    const allFieldKeysInSection = Object.keys(currentSectionFromServer || {});
    for (const fieldKey of allFieldKeysInSection) {
      if (isImageField(fieldKey) && finalSectionData[fieldKey] === "") {
        // Поле было очищено клиентом. Проверяем, не было ли для него загрузки (выше).
        const wasUploadedInThisRun = uploadedImageFieldKeys.includes(fieldKey);
        if (wasUploadedInThisRun) continue; // Уже обработано как загрузка (которая может быть поверх очистки)

        let originalOldFileBaseNameFromContent: string | null = null;
        if (
          currentSectionFromServer?.[
            fieldKey as keyof typeof currentSectionFromServer
          ]
        ) {
          const imgPath = currentSectionFromServer[
            fieldKey as keyof typeof currentSectionFromServer
          ] as string;
          if (imgPath && imgPath.startsWith("/api/media/")) {
            const fullFn = imgPath.substring("/api/media/".length);
            originalOldFileBaseNameFromContent = path.basename(
              fullFn,
              path.extname(fullFn)
            );
          } else if (imgPath) {
            originalOldFileBaseNameFromContent = path.basename(
              imgPath,
              path.extname(imgPath)
            );
          }
        }

        if (originalOldFileBaseNameFromContent) {
          const actualOldFullFilenameToClear = await findActualFilenameInMedia(
            originalOldFileBaseNameFromContent
          );
          if (actualOldFullFilenameToClear) {
            // console.log(`[Action Process Clear] Field: ${fieldKey}, Old file: ${actualOldFullFilenameToClear}`);
            const oldFileOriginalExt = path.extname(
              actualOldFullFilenameToClear
            );
            const prevTargetNameForClearedFile = `prev-${originalOldFileBaseNameFromContent}${oldFileOriginalExt}`;

            const filesInMedia = await fs.readdir(mediaBaseFolderPath);
            for (const fn of filesInMedia) {
              if (
                fn.startsWith(`prev-${originalOldFileBaseNameFromContent}.`)
              ) {
                // console.log(`[Action Pre-delete prev for clear] ${fn}`);
                await safeUnlink(fn);
              }
            }
            // console.log(`[Action Rename Cleared] ${actualOldFullFilenameToClear} -> ${prevTargetNameForClearedFile}`);
            await safeRename(
              actualOldFullFilenameToClear,
              prevTargetNameForClearedFile
            );
            rollbackOps.push({
              type: "rename",
              fromPath: getSafeMediaFilePath(prevTargetNameForClearedFile),
              toPath: getSafeMediaFilePath(actualOldFullFilenameToClear),
            });
          }
        }
        // finalSectionData[fieldKey] уже "" из sectionDataFromClient
      }
    } // End for loop (allFieldKeysInSection for clears)

    // --- 3. Обновление content.json ---
    // Создаем новый объект контента на основе currentContent, обновляя только нужную секцию с finalSectionData
    const newAppContent: AppContent = JSON.parse(
      JSON.stringify(currentContent)
    ); // Глубокая копия
    if (!newAppContent[pageKey]) newAppContent[pageKey] = {} as any;
    if (!newAppContent[pageKey][sectionKey])
      newAppContent[pageKey][sectionKey] = {} as any;

    // Обновляем поля в конкретной секции
    // currentContent уже содержит URLы, finalSectionData содержит базовые имена для картинок и тексты
    // writeContent ожидает, что ему могут прийти как URLы, так и базовые имена, и он сохранит базовые
    newAppContent[pageKey][sectionKey] = {
      ...(currentContent[pageKey]?.[sectionKey] || {}), // Берем существующие поля (с URLами)
      ...finalSectionData, // Перезаписываем измененными (тексты + базовые имена картинок)
    } as AppContent[P][SectionKeyForPage<P>];

    await writeContent(newAppContent);
    // console.log(`[Action END] Content updated for ${pageAndSection}`);

    revalidatePath(pageKey === "home" ? "/" : `/${pageKey}`);
    revalidatePath("/admin");

    return {
      success: true,
      message: `Section '${generateLabel(
        String(sectionKey)
      )}' on page '${pageKey}' updated successfully.`,
      updatedSection: finalSectionData, // Это SectionDataType с базовыми именами для картинок
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[Action ERROR] for ${pageAndSection}:`, error);

    // --- Попытка отката файловых операций ---
    // console.log(`[Action Rollback] ${rollbackOps.length} operations to revert for ${pageAndSection}.`);
    for (let i = rollbackOps.length - 1; i >= 0; i--) {
      const op = rollbackOps[i];
      try {
        if (op.type === "delete") {
          // console.log(`[Action Rollback] Deleting ${op.filePath}`);
          await fs
            .unlink(op.filePath)
            .catch((e) =>
              console.error(`Rollback unlink failed: ${e.message}`)
            );
        } else if (op.type === "rename") {
          // console.log(`[Action Rollback] Renaming ${op.fromPath} to ${op.toPath}`);
          // Убедимся, что целевой путь свободен, особенно если это было имя нового файла, который не удалился
          try {
            await fs.access(op.toPath); // Проверяем, существует ли целевой файл
            // Если существует и это не тот файл, который мы только что переименовали в op.fromPath,
            // то это проблема. Но в простом сценарии отката мы просто пытаемся переименовать.
            // console.warn(`[Action Rollback] Target path ${op.toPath} for rename exists. Overwriting.`);
          } catch {
            /* Target path does not exist, good */
          }
          await fs
            .rename(op.fromPath, op.toPath)
            .catch((e) =>
              console.error(`Rollback rename failed: ${e.message}`)
            );
        }
      } catch (rollbackError: unknown) {
        console.error(
          `[Action Rollback] Error during op ${op.type}:`,
          rollbackError
        );
      }
    }
    return {
      success: false,
      message: `Failed to update section. Reason: ${errorMessage}`,
    };
  }
}
