// src/app/admin/actions.ts
"use server";

import fs from "fs/promises";
import path from "path";
import { revalidatePath } from "next/cache";
import {
  AppContent,
  PageKey,
  SectionKeyForPage, // Если вы переименовали в ContentItemKeyForPage, используйте новое имя
  SectionDataType, // Если вы переименовали в ContentItemDataType, используйте новое имя
  FieldKeyForSection, // Если вы переименовали в FieldKeyForContentItem, используйте новое имя
} from "@/types/types";
import {
  isImageField,
  normalizeSectionData,
  generateLabel,
} from "@/lib/content-utils";
import {
  getContent,
  writeContent,
  safeUnlink, // Не используется в updateSectionContent, но может быть полезен в других actions
  getSafeMediaFilePath,
  findNextAvailableVersionedFilename,
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

// Типы
interface FileOperationDelete {
  type: "delete";
  filePath: string;
}
type RollbackOperation = FileOperationDelete;
interface JsonObject {
  [key: string]: JsonValue;
}
type JsonArray = Array<JsonValue>;
type JsonValue = string | number | boolean | null | JsonObject | JsonArray;

// --- Основные функции ---

export async function getAdminContent(): Promise<AppContent> {
  return await getContent();
}

export async function updateSectionContent<
  P extends PageKey,
  S extends SectionKeyForPage<P> // Используйте актуальное имя типа
>(
  pageKey: P,
  sectionKey: S, // Имя параметра можно оставить, оно будет ссылаться на ваш элемент контента
  formData: FormData
): Promise<{
  success: boolean;
  message: string;
  updatedSection?: SectionDataType; // Используйте актуальное имя типа
}> {
  const pageAndSection = `${pageKey}/${String(sectionKey)}`;

  const sectionDataJson = formData.get("sectionDataJson") as string | null;
  if (!sectionDataJson)
    return { success: false, message: "Error: Missing section data." };

  let sectionDataFromForm: SectionDataType; // Используйте актуальное имя типа
  try {
    sectionDataFromForm = normalizeSectionData(JSON.parse(sectionDataJson));
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(
      `[Action Error] Parsing section data failed for ${pageAndSection}:`,
      e
    );
    return {
      success: false,
      message: `Error parsing section data: ${message}`,
    };
  }

  const rollbackOps: RollbackOperation[] = [];
  const syncNamePairs: Array<[string, string]> = [];
  const uploadedImageFieldKeys = formData.getAll("imageFieldKey") as string[];

  try {
    // 1. Получаем контент, копия, очистка имен
    const currentContent = await getContent();
    const newAppContent: AppContent = JSON.parse(
      JSON.stringify(currentContent)
    );
    cleanupPathsToBaseNames(newAppContent);

    // 2. Цикл по ЗАГРУЖЕННЫМ файлам: готовим данные для синхронизации и сохраняем файлы
    const uploadedImageFiles = formData.getAll("imageFile") as File[];
    if (uploadedImageFiles.length !== uploadedImageFieldKeys.length) {
      return {
        success: false,
        message: "Mismatch between image files and field keys count.",
      };
    }

    const newImageAssignments: Record<string, string> = {};

    for (let i = 0; i < uploadedImageFiles.length; i++) {
      const imageFile = uploadedImageFiles[i];
      // Приводим тип ключа для большей безопасности
      const imageFieldKey = uploadedImageFieldKeys[i] as FieldKeyForSection<
        P,
        S
      >;

      if (!imageFile || !imageFieldKey) {
        console.warn(
          "[Action Update] Missing imageFile or imageFieldKey in uploaded files loop, skipping entry."
        );
        continue;
      }

      if (imageFile.size === 0) {
        // Пропускаем "пустые" файлы, если они как-то попали
        console.warn(
          `[Action Update] Empty file provided for field '${String(
            imageFieldKey
          )}', skipping.`
        );
        continue;
      }

      // --- Валидация ---
      if (imageFile.size > MAX_FILE_SIZE)
        throw new Error(
          `File for '${generateLabel(String(imageFieldKey))}' too large.`
        );
      if (!ALLOWED_FILE_TYPES.includes(imageFile.type))
        throw new Error(
          `Invalid file type for '${generateLabel(String(imageFieldKey))}'.`
        );

      // --- Определение имен ---
      const uploadedFileExtension = path.extname(imageFile.name) || ".unknown";
      const uploadedFileSanitizedBase =
        path
          .basename(imageFile.name, uploadedFileExtension)
          .replace(/[^a-z0-9_.-]/gi, "_")
          .toLowerCase() || "image";

      let targetBaseFilenameForContentJson: string;
      let targetFullFilenameForDisk: string;
      let originalOldFileBaseNameFromContent: string | null = null;

      const currentSectionInCleanedContent =
        newAppContent[pageKey]?.[sectionKey];

      // Убедимся, что currentSectionInCleanedContent существует и imageFieldKey является его ключом
      if (
        currentSectionInCleanedContent &&
        Object.prototype.hasOwnProperty.call(
          currentSectionInCleanedContent,
          imageFieldKey
        )
      ) {
        const currentBaseNameValue =
          currentSectionInCleanedContent[imageFieldKey];
        if (
          typeof currentBaseNameValue === "string" &&
          currentBaseNameValue.length > 0
        ) {
          originalOldFileBaseNameFromContent = currentBaseNameValue;
        }
      } else {
        console.warn(
          `[Action Update] Section or field ${pageKey}/${String(
            sectionKey
          )}/${String(imageFieldKey)} not found in cleaned content.`
        );
      }

      // --- Логика версионирования или добавления ---
      if (originalOldFileBaseNameFromContent) {
        // Замена
        const rootBaseName = originalOldFileBaseNameFromContent.replace(
          /_v\d+$/,
          ""
        );
        const versioningResult = await findNextAvailableVersionedFilename(
          rootBaseName,
          uploadedFileExtension
        );
        if (!versioningResult)
          throw new Error(
            `Failed to determine next version for ${rootBaseName}`
          );
        targetBaseFilenameForContentJson =
          versioningResult.nextVersionedBaseName;
        targetFullFilenameForDisk = versioningResult.nextVersionedFullName;

        if (
          originalOldFileBaseNameFromContent !==
          targetBaseFilenameForContentJson
        ) {
          syncNamePairs.push([
            originalOldFileBaseNameFromContent,
            targetBaseFilenameForContentJson,
          ]);
        }
      } else {
        // Добавление нового файла
        targetBaseFilenameForContentJson = `${Date.now()}-${uploadedFileSanitizedBase}`;
        targetFullFilenameForDisk = `${targetBaseFilenameForContentJson}${uploadedFileExtension}`;
        newImageAssignments[String(imageFieldKey)] =
          targetBaseFilenameForContentJson;
      }

      // --- Сохраняем НОВЫЙ файл ---
      const newFileSavePath = getSafeMediaFilePath(targetFullFilenameForDisk);
      await fs.mkdir(mediaBaseFolderPath, { recursive: true });
      const bytes = await imageFile.arrayBuffer();
      await fs.writeFile(newFileSavePath, Buffer.from(bytes));
      rollbackOps.push({ type: "delete", filePath: newFileSavePath });
    } // Конец цикла по загруженным файлам

    // Применяем новые имена изображений к newAppContent
    const targetSectionForAssignments = newAppContent[pageKey]?.[sectionKey];
    if (targetSectionForAssignments) {
      for (const fieldKeyString in newImageAssignments) {
        if (
          Object.prototype.hasOwnProperty.call(
            newImageAssignments,
            fieldKeyString
          )
        ) {
          // Убедимся, что fieldKeyString является валидным ключом для SectionDataType
          const fieldKey = fieldKeyString as keyof SectionDataType;
          console.log(
            `[Action Add Image] Assigning new image '${newImageAssignments[fieldKey]}' to field '${fieldKey}'`
          );
          (targetSectionForAssignments as SectionDataType)[fieldKey] =
            newImageAssignments[fieldKey];
        }
      }
    }

    // 3. Выполняем ГЛОБАЛЬНУЮ СИНХРОНИЗАЦИЮ имен изображений
    if (syncNamePairs.length > 0) {
      console.log(
        `[Action Sync] Starting sync for ${syncNamePairs.length} name pair(s).`
      );
      for (const [oldName, newName] of syncNamePairs) {
        console.log(
          `[Action Sync] Syncing '${oldName}' to '${newName}' globally.`
        );
        syncImageBaseNameAcrossContent(newAppContent, oldName, newName);
      }
    }

    // 4. Применяем данные из ФОРМЫ (sectionDataFromForm) к newAppContent,
    //    обновляя ТОЛЬКО поля, НЕ являющиеся изображениями.
    const targetSectionForForm = newAppContent[pageKey]?.[sectionKey];
    if (targetSectionForForm) {
      for (const key in sectionDataFromForm) {
        if (Object.prototype.hasOwnProperty.call(sectionDataFromForm, key)) {
          if (!isImageField(key)) {
            (targetSectionForForm as SectionDataType)[key] =
              sectionDataFromForm[key];
          }
        }
      }

      // 5. Обрабатываем ОЧИЩЕННЫЕ поля изображений (устанавливаем "")
      for (const key in sectionDataFromForm) {
        if (Object.prototype.hasOwnProperty.call(sectionDataFromForm, key)) {
          if (
            isImageField(key) &&
            sectionDataFromForm[key] === "" && // Пользователь очистил поле в форме
            !uploadedImageFieldKeys.includes(key) // И НЕ загрузил для него новый файл
            // newImageAssignments[key] уже не нужен здесь, т.к. uploadedImageFieldKeys покрывает это
          ) {
            console.log(
              `[Action Clear] Clearing field '${key}' as per form data (empty and no new upload).`
            );
            (targetSectionForForm as SectionDataType)[key] = "";
          }
        }
      }
    } else {
      console.warn(
        `[Action Update] Target section ${pageKey}/${String(
          sectionKey
        )} not found before applying form data.`
      );
    }

    // 6. Запись content.json
    await writeContent(newAppContent);

    // 7. Ревалидация
    revalidatePath(
      pageKey === "home" || pageKey === "styles" ? "/" : `/${pageKey}`
    );
    revalidatePath("/admin");

    const finalSectionState = newAppContent[pageKey]?.[sectionKey];
    const updatedSectionDataForClient = finalSectionState
      ? normalizeSectionData(finalSectionState)
      : sectionDataFromForm;

    return {
      success: true,
      message: `Section '${generateLabel(
        String(sectionKey)
      )}' on page '${pageKey}' updated successfully.`,
      updatedSection: updatedSectionDataForClient,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[Action ERROR] Failed update for ${pageAndSection}:`, error);

    for (let i = rollbackOps.length - 1; i >= 0; i--) {
      const op = rollbackOps[i];
      if (op.type === "delete") {
        try {
          await fs.unlink(op.filePath);
          console.log(`[Rollback] Deleted new file: ${op.filePath}`);
        } catch (rollbackError) {
          console.error(
            `[Rollback ERROR] Failed to delete file ${op.filePath}:`,
            rollbackError
          );
        }
      }
    }
    return {
      success: false,
      message: `Failed to update section. Reason: ${errorMessage}`,
    };
  }
}

// --- Вспомогательные функции ---

function cleanupPathsToBaseNames(node: unknown): void {
  if (typeof node !== "object" || node === null) return;
  if (Array.isArray(node)) {
    node.forEach((item) => cleanupPathsToBaseNames(item));
  } else {
    const objNode = node as JsonObject;
    Object.keys(objNode).forEach((key) => {
      const value = objNode[key];
      if (isImageField(key) && typeof value === "string") {
        if (value.startsWith("/api/media/")) {
          const fullFilename = value.substring("/api/media/".length);
          objNode[key] = path.basename(
            fullFilename,
            path.extname(fullFilename)
          );
        } else if (value.includes(".") && !value.startsWith("/")) {
          // Если это уже имя файла (например, "image.jpg") без префикса API,
          // также извлекаем базовое имя. Это полезно, если в content.json
          // случайно оказалось полное имя вместо базового.
          objNode[key] = path.basename(value, path.extname(value));
        }
        // Если это уже базовое имя (без точки и без префикса), оставляем как есть.
      } else if (typeof value === "object" && value !== null) {
        cleanupPathsToBaseNames(value);
      }
    });
  }
}

function syncImageBaseNameAcrossContent(
  node: unknown,
  oldBaseName: string,
  newBaseName: string
): void {
  if (typeof node !== "object" || node === null) return;
  if (Array.isArray(node)) {
    node.forEach((item) =>
      syncImageBaseNameAcrossContent(item, oldBaseName, newBaseName)
    );
  } else {
    const objNode = node as JsonObject;
    Object.keys(objNode).forEach((key) => {
      const value = objNode[key];
      if (
        isImageField(key) &&
        typeof value === "string" &&
        value === oldBaseName
      ) {
        objNode[key] = newBaseName;
        console.log(
          `[Sync Util] Updated '${oldBaseName}' to '${newBaseName}' for key '${key}'`
        );
      }
      // Рекурсивный вызов для вложенных объектов
      if (typeof value === "object" && value !== null) {
        syncImageBaseNameAcrossContent(value, oldBaseName, newBaseName);
      }
    });
  }
}

export async function getMediaFilesList(): Promise<string[]> {
  const mediaFolderPathForList = path.join(process.cwd(), "media");
  try {
    await fs.mkdir(mediaFolderPathForList, { recursive: true }); // Убедимся, что папка существует
    const files = await fs.readdir(mediaFolderPathForList);
    const imageFilesPromises = files.map(async (file) => {
      const filePath = path.join(mediaFolderPathForList, file);
      try {
        const stats = await fs.stat(filePath);
        if (stats.isFile()) {
          const ext = path.extname(file).toLowerCase();
          if (
            [".jpg", ".jpeg", ".png", ".gif", ".svg", ".webp"].includes(ext)
          ) {
            return file;
          }
        }
      } catch (statError) {
        console.warn(
          `[getMediaFilesList] Error stating file ${filePath}:`,
          statError
        );
        return null;
      }
      return null;
    });

    const resolvedImageFiles = await Promise.all(imageFilesPromises);
    const filteredImageFiles = resolvedImageFiles.filter(
      (file): file is string => file !== null
    );

    return filteredImageFiles.sort();
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code: string }).code === "ENOENT"
    ) {
      console.warn(
        `[getMediaFilesList] Media folder not found at ${mediaFolderPathForList}. Returning empty list.`
      );
      return [];
    }
    console.error("[getMediaFilesList] Error reading media directory:", error);
    return [];
  }
}
