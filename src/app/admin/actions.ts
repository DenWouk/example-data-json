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
  FieldKeyForSection,
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
  S extends SectionKeyForPage<P>
>(
  pageKey: P,
  sectionKey: S,
  formData: FormData
): Promise<{
  success: boolean;
  message: string;
  updatedSection?: SectionDataType; // Для ответа клиенту
}> {
  const pageAndSection = `${pageKey}/${String(sectionKey)}`;

  const sectionDataJson = formData.get("sectionDataJson") as string | null;
  if (!sectionDataJson)
    return { success: false, message: "Error: Missing section data." };

  let sectionDataFromForm: SectionDataType; // Данные из формы (текст, старые/очищенные имена img)
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
  const syncNamePairs: Array<[string, string]> = []; // Пары [старое_имя, новое_имя]
  const uploadedImageFieldKeys = formData.getAll("imageFieldKey") as string[]; // Ключи загруженных

  try {
    // 1. Получаем контент, копия, очистка имен
    const currentContent = await getContent();
    const newAppContent: AppContent = JSON.parse(
      JSON.stringify(currentContent)
    );
    cleanupPathsToBaseNames(newAppContent); // newAppContent с базовыми именами

    // 2. Цикл по ЗАГРУЖЕННЫМ файлам: готовим данные для синхронизации и сохраняем файлы
    const uploadedImageFiles = formData.getAll("imageFile") as File[];
    if (uploadedImageFiles.length !== uploadedImageFieldKeys.length) {
      return {
        success: false,
        message: "Mismatch between image files and field keys count.",
      };
    }

    for (let i = 0; i < uploadedImageFiles.length; i++) {
      const imageFile = uploadedImageFiles[i];
      const imageFieldKey = uploadedImageFieldKeys[i];

      // --- Валидация ---
      if (imageFile.size > MAX_FILE_SIZE)
        throw new Error(
          `File for '${generateLabel(imageFieldKey)}' too large.`
        );
      if (!ALLOWED_FILE_TYPES.includes(imageFile.type))
        throw new Error(
          `Invalid file type for '${generateLabel(imageFieldKey)}'.`
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

      // Получаем старое базовое имя из ОЧИЩЕННОГО newAppContent
      const currentSectionInCleanedContent =
        newAppContent[pageKey]?.[sectionKey];
      const currentBaseNameValue =
        currentSectionInCleanedContent?.[
          imageFieldKey as FieldKeyForSection<P, S>
        ];
      if (
        typeof currentBaseNameValue === "string" &&
        currentBaseNameValue.length > 0
      ) {
        originalOldFileBaseNameFromContent = currentBaseNameValue;
      }

      // --- Логика версионирования ---
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
        // Добавление
        targetBaseFilenameForContentJson = `${Date.now()}-${uploadedFileSanitizedBase}`;
        targetFullFilenameForDisk = `${targetBaseFilenameForContentJson}${uploadedFileExtension}`;
      }

      // --- Сохраняем НОВЫЙ файл ---
      const newFileSavePath = getSafeMediaFilePath(targetFullFilenameForDisk);
      await fs.mkdir(mediaBaseFolderPath, { recursive: true });
      const bytes = await imageFile.arrayBuffer();
      await fs.writeFile(newFileSavePath, Buffer.from(bytes));
      rollbackOps.push({ type: "delete", filePath: newFileSavePath });
    } // Конец цикла по загруженным файлам

    // 3. Выполняем ГЛОБАЛЬНУЮ СИНХРОНИЗАЦИЮ имен изображений
    // Этот шаг устанавливает правильные *новые* версии для ВСЕХ полей, где было старое имя.
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
    const targetSection = newAppContent[pageKey]?.[sectionKey];
    if (targetSection) {
      for (const key in sectionDataFromForm) {
        if (Object.prototype.hasOwnProperty.call(sectionDataFromForm, key)) {
          // Если это НЕ поле изображения, обновляем его значением из формы
          if (!isImageField(key)) {
            // console.log(`Applying form value for NON-IMAGE key: ${key}`);
            (targetSection as SectionDataType)[key] = sectionDataFromForm[key];
          }
          // Поля изображений на этом этапе НЕ трогаем! Их значения уже установлены синхронизацией.
        }
      }

      // 5. Обрабатываем ОЧИЩЕННЫЕ поля изображений (устанавливаем "")
      // Делаем это после применения текстовых полей и после синхронизации.
      for (const key in sectionDataFromForm) {
        if (Object.prototype.hasOwnProperty.call(sectionDataFromForm, key)) {
          // Если поле - изображение, оно пустое в форме и не было загружено новое
          if (
            isImageField(key) &&
            sectionDataFromForm[key] === "" &&
            !uploadedImageFieldKeys.includes(key)
          ) {
            console.log(`[Action Clear] Clearing field '${key}' definitively.`);
            (targetSection as SectionDataType)[key] = ""; // Устанавливаем пустую строку
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
    await writeContent(newAppContent); // Записываем финальный результат

    // 7. Ревалидация
    revalidatePath(
      pageKey === "home" || pageKey === "styles" ? "/" : `/${pageKey}`
    );
    revalidatePath("/admin");

    // Готовим данные для ответа клиенту: берем финальное состояние секции из newAppContent
    const finalSectionState = newAppContent[pageKey]?.[sectionKey];
    const updatedSectionDataForClient = finalSectionState
      ? normalizeSectionData(finalSectionState) // Нормализуем на всякий случай
      : sectionDataFromForm; // Резервный вариант - вернуть данные формы

    return {
      success: true,
      message: `Section '${generateLabel(
        String(sectionKey)
      )}' on page '${pageKey}' updated successfully.`,
      updatedSection: updatedSectionDataForClient, // Возвращаем актуальное состояние секции
    };
  } catch (error: unknown) {
    // ... (обработка ошибки и откат) ...
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[Action ERROR] Failed update for ${pageAndSection}:`, error);
    // Rollback logic...
    for (let i = rollbackOps.length - 1; i >= 0; i--) {
      /* ... */
    }
    return {
      success: false,
      message: `Failed to update section. Reason: ${errorMessage}`,
    };
  }
}

// --- Вспомогательные функции ---

// cleanupPathsToBaseNames (без изменений)
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
          objNode[key] = path.basename(value, path.extname(value));
        }
      } else if (typeof value === "object" && value !== null) {
        cleanupPathsToBaseNames(value);
      }
    });
  }
}

// syncImageBaseNameAcrossContent (без изменений)
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
      }
      if (typeof value === "object" && value !== null) {
        syncImageBaseNameAcrossContent(value, oldBaseName, newBaseName);
      }
    });
  }
}

export async function getMediaFilesList(): Promise<string[]> {
  const mediaFolderPathForList = path.join(process.cwd(), "media");
  try {
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
            return file; // Возвращаем имя файла, если это подходящий файл
          }
        }
      } catch (statError) {
        // Ошибка получения статов (например, битая ссылка), пропускаем файл
        console.warn(
          `[getMediaFilesList] Error stating file ${filePath}:`,
          statError
        );
        return null;
      }
      return null; // Не подходящий файл или папка
    });

    const resolvedImageFiles = await Promise.all(imageFilesPromises);
    // Фильтруем null значения (которые были папками, не-изображениями или ошибками)
    const filteredImageFiles = resolvedImageFiles.filter(
      (file): file is string => file !== null
    );

    return filteredImageFiles.sort(); // Сортируем для удобства
  } catch (error) {
    console.error("[getMediaFilesList] Error reading media directory:", error);
    return [];
  }
}
