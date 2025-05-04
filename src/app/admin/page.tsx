// src/app/admin/page.tsx
"use client";

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  ChangeEvent,
  FormEvent,
} from "react";
import Image from "next/image";

// ----- ТИПЫ -----
import {
  AppContent,
  PageKey, // Переименованный SpecificPageKey
  SectionKeyForPage,
  SectionDataType,
} from "@/types/types";

// ----- ACTIONS & UTILS -----
import { getAdminContent, updateSectionContent } from "./actions";
import {
  generateLabel,
  isImageField,
  inferInputElement,
} from "@/lib/content-utils";

// Тип для данных РЕДАКТИРУЕМОЙ СТРАНИЦЫ (ключ секции -> данные секции)
type EditingPageDataType = Record<string, SectionDataType> | null;
// Тип для превью изображений (ключ секции -> ключ поля -> dataUrl)
type ImagePreviewsType = Record<string, Record<string, string | null>>;
// Тип для отслеживания ИЗМЕНЕННЫХ файлов (ключ: sectionKey-fieldKey, значение: File)
type PendingFileUploadsType = Record<string, File>;

export default function AdminPage() {
  // === Основные состояния ===
  const [appContent, setAppContent] = useState<AppContent | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // === Состояния выбора ===
  const [selectedPageKey, setSelectedPageKey] = useState<PageKey | null>(null);
  // selectedSectionKey больше не нужен для выбора, но может понадобиться для рефов/ключей

  // === Состояния формы ===
  const [editingPageData, setEditingPageData] =
    useState<EditingPageDataType>(null); // Данные ВСЕЙ редактируемой страницы
  const [imagePreviews, setImagePreviews] = useState<ImagePreviewsType>({});
  const [pendingFileUploads, setPendingFileUploads] =
    useState<PendingFileUploadsType>({}); // Отслеживаем выбранные файлы

  // === Состояния UI ===
  const [isSaving, setIsSaving] = useState<boolean>(false); // Общий статус сохранения
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [saveError, setSaveError] = useState<string | null>(null);

  // Рефы для файловых инпутов (ключ = sectionKey-fieldKey)
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const formRef = useRef<HTMLFormElement>(null); // Реф для всей формы

  // === Эффект: Загрузка начальных данных ===
  useEffect(() => {
    setIsLoading(true);
    setLoadError(null);
    getAdminContent()
      .then((content) => {
        setAppContent(content);
        const pageKeys = Object.keys(content) as PageKey[];
        if (pageKeys.length > 0) {
          setSelectedPageKey(pageKeys[0]);
        } else {
          setLoadError("No pages found in content.");
          setIsLoading(false);
        }
      })
      .catch((err) => {
        setLoadError(
          `Failed to load content: ${
            err instanceof Error ? err.message : String(err)
          }`
        );
        setAppContent(null);
        setIsLoading(false);
      });
  }, []);

  // === Эффект: Инициализация данных для редактирования при смене страницы ===
  useEffect(() => {
    setEditingPageData(null);
    setImagePreviews({});
    setPendingFileUploads({}); // Сброс выбранных файлов
    setStatusMessage("");
    setSaveError(null); // Сброс ошибки сохранения

    if (appContent && selectedPageKey) {
      const pageData = appContent[selectedPageKey];
      if (pageData) {
        const initialEditingData: EditingPageDataType = {};
        Object.keys(pageData).forEach((sectionKeyAsString) => {
          const sectionKey = sectionKeyAsString as SectionKeyForPage<
            typeof selectedPageKey
          >;
          initialEditingData[sectionKey] = { ...pageData[sectionKey] };
        });
        setEditingPageData(initialEditingData);
        console.log(`Initialized editing data for page: ${selectedPageKey}`);
      } else {
        console.warn(`No page data found for key: ${selectedPageKey}`);
      }
    }

    if (isLoading && appContent) {
      setIsLoading(false);
    }
  }, [selectedPageKey, appContent, isLoading]);

  // === Обработчики ===

  // Выбор страницы
  const handlePageSelect = (pageKey: PageKey) => {
    if (isSaving || pageKey === selectedPageKey) return;
    setSelectedPageKey(pageKey);
  };

  // Убрали handleSectionSelect

  // Обновление поля формы
  const handleFormChange = useCallback(
    (sectionKey: string, fieldKey: string, value: string) => {
      setEditingPageData((currentData) => {
        if (!currentData || !currentData[sectionKey]) return currentData;
        return {
          ...currentData,
          [sectionKey]: {
            ...currentData[sectionKey],
            [fieldKey]: value,
          },
        };
      });

      if (isImageField(fieldKey) && value === "") {
        const previewKey = `${sectionKey}-${fieldKey}`;
        // Удаляем из превью
        setImagePreviews((prev) => {
          const sectionPrev = { ...(prev[sectionKey] || {}) };
          delete sectionPrev[fieldKey];
          return { ...prev, [sectionKey]: sectionPrev };
        });
        // Удаляем из выбранных файлов
        setPendingFileUploads((prev) => {
          const next = { ...prev };
          delete next[previewKey];
          return next;
        });
        // Сбрасываем инпут
        if (fileInputRefs.current[previewKey])
          fileInputRefs.current[previewKey]!.value = "";
      }
    },
    []
  ); // Больше не зависит от uploadingImageInfo

  // Обработчик выбора файла
  const handleFileChange = (
    sectionKey: string,
    fieldKey: string,
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    const inputKey = `${sectionKey}-${fieldKey}`; // Уникальный ключ для файла/инпута

    setSaveError(null); // Сброс ошибки при попытке изменить файл

    if (!file) {
      // Отмена выбора
      // Удаляем из выбранных файлов и превью
      setPendingFileUploads((prev) => {
        const next = { ...prev };
        delete next[inputKey];
        return next;
      });
      setImagePreviews((prev) => {
        const sectionPrev = { ...(prev[sectionKey] || {}) };
        delete sectionPrev[fieldKey];
        return { ...prev, [sectionKey]: sectionPrev };
      });
      return;
    }
    // Проверки
    if (!file.type.startsWith("image/")) {
      setSaveError("Selected file is not an image.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setSaveError("Image file is too large (max 5MB).");
      return;
    }

    // Добавляем файл в список для загрузки
    setPendingFileUploads((prev) => ({ ...prev, [inputKey]: file }));

    // Обновляем превью
    const reader = new FileReader();
    reader.onload = (e) =>
      setImagePreviews((prev) => ({
        ...prev,
        [sectionKey]: {
          ...(prev[sectionKey] || {}),
          [fieldKey]: e.target?.result as string,
        },
      }));
    reader.onerror = () => setSaveError("Failed to read file preview.");
    reader.readAsDataURL(file);
  };

  // Обработчик очистки файла
  const handleClearImage = (sectionKey: string, fieldKey: string) => {
    handleFormChange(sectionKey, fieldKey, ""); // Вызовет сброс всего остального
  };

  // === Обработчик СОХРАНЕНИЯ ВСЕЙ СТРАНИЦЫ ===
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingPageData || !selectedPageKey || isSaving || !appContent) {
      setSaveError("Cannot save: Missing data or save already in progress.");
      return;
    }

    setIsSaving(true);
    setStatusMessage("Saving changes...");
    setSaveError(null);

    const originalPageData = appContent[selectedPageKey]; // Оригинальные данные для сравнения
    const sectionsToUpdate: string[] = []; // Ключи секций, которые изменились

    // 1. Определяем измененные секции
    Object.keys(editingPageData).forEach((sectionKey) => {
      // Сравниваем JSON строки для простоты (можно сравнивать объекты по полям)
      if (
        JSON.stringify(editingPageData[sectionKey]) !==
        JSON.stringify(
          originalPageData[
            sectionKey as SectionKeyForPage<typeof selectedPageKey>
          ]
        )
      ) {
        sectionsToUpdate.push(sectionKey);
      }
      // Также проверяем, есть ли ожидающий файл для этой секции (даже если текст не менялся)
      Object.keys(pendingFileUploads).forEach((uploadKey) => {
        if (
          uploadKey.startsWith(`${sectionKey}-`) &&
          !sectionsToUpdate.includes(sectionKey)
        ) {
          sectionsToUpdate.push(sectionKey);
        }
      });
    });

    if (sectionsToUpdate.length === 0) {
      setStatusMessage("No changes detected.");
      setIsSaving(false);
      return;
    }

    console.log("Sections to update:", sectionsToUpdate);

    // 2. Выполняем запросы на обновление для каждой измененной секции
    const updatePromises = sectionsToUpdate.map(async (sectionKey) => {
      const sectionDataToSave = editingPageData[sectionKey];
      const formDataToSend = new FormData();
      formDataToSend.append("pageKey", selectedPageKey);
      formDataToSend.append("sectionKey", sectionKey);
      formDataToSend.append(
        "sectionDataJson",
        JSON.stringify(sectionDataToSave)
      );

      // Ищем и добавляем файл, если он был изменен для этой секции
      let uploadedFileFieldKey: string | null = null;
      Object.entries(pendingFileUploads).forEach(([uploadKey, file]) => {
        if (uploadKey.startsWith(`${sectionKey}-`)) {
          const fieldKey = uploadKey.split("-").slice(1).join("-"); // Получаем fieldKey из uploadKey
          formDataToSend.append("imageFile", file);
          formDataToSend.append("imageFieldKey", fieldKey);
          uploadedFileFieldKey = fieldKey; // Запоминаем ключ поля
          console.log(`Adding file for ${sectionKey}-${fieldKey}`);
        }
      });

      try {
        const result = await updateSectionContent(
          selectedPageKey as PageKey, // Убеждаемся, что selectedPageKey не null
          sectionKey as SectionKeyForPage<typeof selectedPageKey>,
          formDataToSend
        );
        if (!result.success) {
          // Если ошибка, возвращаем сообщение об ошибке
          throw new Error(
            `Section '${generateLabel(sectionKey)}': ${
              result.message || "Save failed"
            }`
          );
        }
        // Возвращаем ключ секции и обновленные данные при успехе
        return {
          sectionKey,
          updatedSection: result.updatedSection,
          uploadedFileFieldKey,
        };
      } catch (err) {
        // Если ошибка сети или другая
        throw new Error(
          `Section '${generateLabel(sectionKey)}': ${
            err instanceof Error ? err.message : String(err)
          }`
        );
      }
    });

    // 3. Обрабатываем результаты всех запросов
    const results = await Promise.allSettled(updatePromises);

    let hasErrors = false;
    let combinedStatusMessage = "";
    const successfullySavedSections: Record<string, SectionDataType> = {};
    const clearedFileUploads: string[] = []; // Ключи успешно загруженных файлов

    results.forEach((result) => {
      if (result.status === "fulfilled") {
        const { sectionKey, updatedSection, uploadedFileFieldKey } =
          result.value;
        if (updatedSection) {
          successfullySavedSections[sectionKey] = updatedSection;
          combinedStatusMessage += `Section '${generateLabel(
            sectionKey
          )}' saved. `;
          // Если файл был успешно загружен для этой секции, добавляем его ключ для очистки
          if (uploadedFileFieldKey) {
            clearedFileUploads.push(`${sectionKey}-${uploadedFileFieldKey}`);
          }
        }
      } else {
        hasErrors = true;
        combinedStatusMessage += `Error saving section: ${
          result.reason?.message || "Unknown error"
        }. `;
        console.error("Save error:", result.reason);
      }
    });

    // 4. Обновляем состояния
    if (Object.keys(successfullySavedSections).length > 0) {
      // Обновляем appContent и editingPageData только успешно сохраненными секциями
      setAppContent((prev) => {
        if (!prev) return null;
        const newPageData = { ...prev[selectedPageKey!] };
        Object.entries(successfullySavedSections).forEach(([key, data]) => {
          newPageData[key as SectionKeyForPage<typeof selectedPageKey>] =
            data as AppContent[PageKey][SectionKeyForPage<PageKey>];
        });
        return { ...prev, [selectedPageKey!]: newPageData };
      });
      setEditingPageData((prev) => {
        if (!prev) return null;
        const newEditingData = { ...prev };
        Object.entries(successfullySavedSections).forEach(([key, data]) => {
          newEditingData[key] = data;
        });
        return newEditingData;
      });

      // Очищаем только успешно загруженные файлы из pending
      setPendingFileUploads((prev) => {
        const next = { ...prev };
        clearedFileUploads.forEach((key) => delete next[key]);
        return next;
      });
      // Очищаем превью для успешно сохраненных файлов
      setImagePreviews((prev) => {
        const next = { ...prev };
        clearedFileUploads.forEach((uploadKey) => {
          const [sectionKey, fieldKey] = uploadKey.split(/-(.+)/); // Разделяем ключ
          if (next[sectionKey]) {
            delete next[sectionKey][fieldKey];
          }
        });
        return next;
      });
      // Сбрасываем инпуты для загруженных файлов
      clearedFileUploads.forEach((uploadKey) => {
        if (fileInputRefs.current[uploadKey]) {
          fileInputRefs.current[uploadKey]!.value = "";
        }
      });
    }

    setStatusMessage(combinedStatusMessage.trim());
    if (hasErrors) {
      setSaveError(
        "Some sections failed to save. See details above or in console."
      );
    } else {
      setSaveError(null); // Очищаем общую ошибку, если все успешно
    }
    setIsSaving(false);
  };

  // === Рендеринг ===

  if (isLoading)
    return <div className="admin-container loading">Loading...</div>;
  if (loadError)
    return (
      <div className="admin-container error">
        <h1>Error</h1>
        <p>{loadError}</p>
      </div>
    );
  if (!appContent)
    return <div className="admin-container">No content data.</div>;

  const pageKeys = Object.keys(appContent) as PageKey[];
  const sectionsForSelectedPage = selectedPageKey
    ? appContent[selectedPageKey]
    : null;
  const sectionKeys = sectionsForSelectedPage
    ? Object.keys(sectionsForSelectedPage)
    : [];
  const isAnySectionSaving = isSaving; // Используем общий флаг

  return (
    <div className="admin-container">
      <h1>Admin Panel</h1>

      {/* Общие сообщения */}
      {saveError && <div className="error-message">{saveError}</div>}
      {statusMessage && <div className="status-message">{statusMessage}</div>}

      {/* Навигация по страницам */}
      <nav className="page-nav">
        <strong>Pages:</strong>
        {pageKeys.map((key) => (
          <button
            key={key}
            onClick={() => handlePageSelect(key)}
            disabled={isAnySectionSaving}
            className={key === selectedPageKey ? "active" : ""}
          >
            {generateLabel(key)}
          </button>
        ))}
      </nav>

      {/* Убрали навигацию по секциям */}

      {/* Форма для ВСЕХ секций выбранной страницы */}
      {selectedPageKey && (
        <form ref={formRef} onSubmit={handleSubmit}>
          {" "}
          {/* Оборачиваем все секции в одну форму */}
          <div className="sections-container">
            <h2>Editing Page: {generateLabel(selectedPageKey)}</h2>
            {!editingPageData && <p>Loading sections...</p>}

            {editingPageData && sectionKeys.length > 0
              ? sectionKeys.map((sectionKey) => {
                  const sectionFormData = editingPageData[sectionKey];
                  const fieldKeys = Object.keys(sectionFormData || {});

                  return (
                    <div
                      key={`${selectedPageKey}-${sectionKey}`}
                      className="section-editor"
                    >
                      <h3>{generateLabel(sectionKey)}</h3>
                      {sectionFormData ? (
                        fieldKeys.map((fieldKey) => {
                          const value = sectionFormData[fieldKey];
                          const label = generateLabel(fieldKey);
                          const inputType = inferInputElement(fieldKey);
                          const elementKey = `${selectedPageKey}-${sectionKey}-${fieldKey}`;
                          const previewKey = `${sectionKey}-${fieldKey}`;

                          // Превью берем из imagePreviews ИЛИ из pendingFileUploads
                          const localPreview =
                            imagePreviews[sectionKey]?.[fieldKey];
                          // const pendingFile = pendingFileUploads[previewKey]; // Если хотим показывать превью из File объекта
                          const existingImageUrl =
                            isImageField(fieldKey) &&
                            value &&
                            !localPreview /* && !pendingFile */
                              ? `/api/media/${value}`
                              : null;
                          const displayUrl = localPreview || existingImageUrl;

                          if (inputType === "file") {
                            return (
                              <div
                                key={elementKey}
                                className="form-field form-field-image"
                              >
                                <label htmlFor={elementKey}>{label}:</label>
                                <div className="image-preview-container">
                                  {displayUrl ? (
                                    <Image
                                      src={displayUrl}
                                      alt={`${label} preview`}
                                      width={100}
                                      height={100}
                                      style={{ objectFit: "contain" }}
                                    />
                                  ) : (
                                    <div className="no-image-placeholder">
                                      No Image
                                    </div>
                                  )}
                                </div>
                                <input
                                  type="file"
                                  id={elementKey}
                                  name={previewKey}
                                  /* Используем уникальный name для рефа */ accept="image/*"
                                  ref={(el) => {
                                    fileInputRefs.current[previewKey] = el;
                                  }}
                                  onChange={(e) =>
                                    handleFileChange(sectionKey, fieldKey, e)
                                  }
                                  disabled={isSaving}
                                />
                                {(value ||
                                  localPreview) /* || pendingFile */ && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleClearImage(sectionKey, fieldKey)
                                    }
                                    disabled={isSaving}
                                  >
                                    Clear
                                  </button>
                                )}
                              </div>
                            );
                          } else {
                            return (
                              <div key={elementKey} className="form-field">
                                <label htmlFor={elementKey}>{label}:</label>
                                <textarea
                                  id={elementKey}
                                  name={elementKey}
                                  value={value}
                                  onChange={(e) =>
                                    handleFormChange(
                                      sectionKey,
                                      fieldKey,
                                      e.target.value
                                    )
                                  }
                                  rows={5}
                                  disabled={isSaving}
                                />
                              </div>
                            );
                          }
                        })
                      ) : (
                        <p>No fields data for this section.</p>
                      )}
                    </div>
                  );
                })
              : editingPageData && <p>This page has no sections.</p>}
          </div>
          {/* Общая кнопка сохранения */}
          {selectedPageKey && editingPageData && (
            <>
              <hr />
              <button type="submit" disabled={isSaving || !editingPageData}>
                {isSaving ? "Saving..." : "Save All Changes on This Page"}
              </button>
            </>
          )}
        </form>
      )}

      {/* Сообщение, если страница не выбрана */}
      {!selectedPageKey && pageKeys.length > 0 && (
        <p className="placeholder-message">Select a page to start editing.</p>
      )}

      {/* Стили */}
      <style jsx global>{`
        /* ... */
      `}</style>
      <style jsx>{`
        /* ... стили из предыдущих ответов ... */
      `}</style>
    </div>
  );
}
