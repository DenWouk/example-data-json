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
import {
  isImageField,
  normalizeSectionData,
  generateLabel, 
} from "@/lib/content-utils";
import {
  getContent,
  writeContent,
  safeUnlink,
  getSafeMediaFilePath,
  safeRename,
  findActualFilenameInMedia,
} from "@/lib/fs-utils";

const mediaBaseFolderPath = path.join(process.cwd(), "media");
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_FILE_TYPES = [
  "image/jpeg", // Покрывает .jpeg и .jpg
  "image/png",
  "image/webp",
  "image/gif",
  "image/svg+xml",
];

// Типы для операций отката
interface FileOperationRename {
  type: "rename";
  fromPath: string; // Полный путь к файлу, который был переименован (например, prev-имя.ext)
  toPath: string; // Полный путь, куда он должен быть переименован обратно (например, имя.ext)
}
interface FileOperationDelete {
  type: "delete";
  filePath: string; // Полный путь к файлу, который был создан и должен быть удален при откате
}
type RollbackOperation = FileOperationRename | FileOperationDelete;

export async function getAdminContent(): Promise<AppContent> {
  return await getContent();
}

export async function updateSectionContent<P extends PageKey>(
  pageKey: P,
  sectionKey: SectionKeyForPage<P>, // sectionKey теперь строго типизирован для данной страницы P
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

  const finalSectionData: SectionDataType = { ...sectionDataFromClient };
  const rollbackOps: RollbackOperation[] = [];

  try {
    const currentContent = await getContent();
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
      const imageFieldKey = uploadedImageFieldKeys[i];

      // console.log(`[Action Process Upload] Field: ${imageFieldKey}, File: ${imageFile.name}`);

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
          originalOldFileBaseNameFromContent = path.basename(
            imgPath,
            path.extname(imgPath)
          );
        }
      }

      const actualOldFullFilename = originalOldFileBaseNameFromContent
        ? await findActualFilenameInMedia(originalOldFileBaseNameFromContent)
        : null;

      if (originalOldFileBaseNameFromContent && actualOldFullFilename) {
        targetBaseFilenameForContentJson = originalOldFileBaseNameFromContent;
        targetFullFilenameForDisk = `${targetBaseFilenameForContentJson}${uploadedFileExtension}`;
        const oldFileOriginalExt = path.extname(actualOldFullFilename);
        const prevTargetNameForOldFile = `prev-${originalOldFileBaseNameFromContent}${oldFileOriginalExt}`;

        const filesInMedia = await fs.readdir(mediaBaseFolderPath);
        for (const fn of filesInMedia) {
          if (fn.startsWith(`prev-${originalOldFileBaseNameFromContent}.`)) {
            await safeUnlink(fn);
          }
        }
        await safeRename(actualOldFullFilename, prevTargetNameForOldFile);
        rollbackOps.push({
          type: "rename",
          fromPath: getSafeMediaFilePath(prevTargetNameForOldFile),
          toPath: getSafeMediaFilePath(actualOldFullFilename),
        });
      } else {
        targetBaseFilenameForContentJson = `${Date.now()}-${uploadedFileSanitizedBase}-${i}`;
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
      rollbackOps.push({ type: "delete", filePath: newFileSavePath });
      finalSectionData[imageFieldKey] = targetBaseFilenameForContentJson;
    }

    // --- 2. Обработка ОЧИЩЕННЫХ полей изображений ---
    const allFieldKeysInSection = Object.keys(currentSectionFromServer || {});
    for (const fieldKey of allFieldKeysInSection) {
      if (isImageField(fieldKey) && finalSectionData[fieldKey] === "") {
        const wasUploadedInThisRun = uploadedImageFieldKeys.includes(fieldKey);
        if (wasUploadedInThisRun) continue;

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
            const oldFileOriginalExt = path.extname(
              actualOldFullFilenameToClear
            );
            const prevTargetNameForClearedFile = `prev-${originalOldFileBaseNameFromContent}${oldFileOriginalExt}`;
            const filesInMedia = await fs.readdir(mediaBaseFolderPath);
            for (const fn of filesInMedia) {
              if (
                fn.startsWith(`prev-${originalOldFileBaseNameFromContent}.`)
              ) {
                await safeUnlink(fn);
              }
            }
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
      }
    }

    // --- 3. Обновление content.json ---
    const newAppContent: AppContent = JSON.parse(
      JSON.stringify(currentContent)
    );

    if (!newAppContent[pageKey]) {
      newAppContent[pageKey] = {} as AppContent[P];
    }
    if (!newAppContent[pageKey][sectionKey]) {
      newAppContent[pageKey][sectionKey] =
        {} as AppContent[P][SectionKeyForPage<P>];
    }

    // Обновляем поля в конкретной секции.
    // `currentContent[pageKey]?.[sectionKey]` содержит URLы или базовые имена (если writeContent уже их очистил, но getContent вернет URLы).
    // `finalSectionData` содержит базовые имена для измененных картинок и новые текстовые значения.
    // `writeContent` ожидает, что ему могут прийти как URLы, так и базовые имена, и он сохранит базовые.
    newAppContent[pageKey][sectionKey] = {
      ...newAppContent[pageKey][sectionKey], // Берем текущие поля секции (возможно, только что созданные)
      ...finalSectionData, // Перезаписываем/добавляем измененными значениями
    };
    // Тип `newAppContent[pageKey][sectionKey]` теперь AppContent[P][SectionKeyForPage<P>]
    // А `finalSectionData` это `Record<string, string>`.
    // Поскольку все поля в AppContent строковые, это присвоение должно быть безопасным.

    await writeContent(newAppContent);

    revalidatePath(pageKey === "home" ? "/" : `/${pageKey}`);
    revalidatePath("/admin");

    return {
      success: true,
      message: `Section '${generateLabel(
        String(sectionKey)
      )}' on page '${pageKey}' updated successfully.`,
      updatedSection: finalSectionData,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[Action ERROR] for ${pageAndSection}:`, error);

    for (let i = rollbackOps.length - 1; i >= 0; i--) {
      const op = rollbackOps[i];
      try {
        if (op.type === "delete") {
          await fs
            .unlink(op.filePath)
            .catch((e) =>
              console.error(
                `Rollback unlink failed for ${op.filePath}: ${e.message}`
              )
            );
        } else if (op.type === "rename") {
          // Перед переименованием обратно, убедимся, что целевой путь не занят чем-то неожиданным.
          try {
            await fs.access(op.toPath); // Проверяем, существует ли toPath
            // Если существует, это может быть файл, который должен был быть удален (newFile)
            // или что-то еще. Для простоты, пытаемся переименовать, fs.rename перезапишет.
            // console.warn(`[Action Rollback] Target path ${op.toPath} for rename exists. Attempting to overwrite.`);
          } catch {
            /* toPath не существует, хорошо */
          }
          await fs
            .rename(op.fromPath, op.toPath)
            .catch((e) =>
              console.error(
                `Rollback rename failed for ${op.fromPath} to ${op.toPath}: ${e.message}`
              )
            );
        }
      } catch (rollbackError: unknown) {
        console.error(
          `[Action Rollback] Error during op ${op.type} (${
            op.type === "delete" ? op.filePath : op.fromPath
          }):`,
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
