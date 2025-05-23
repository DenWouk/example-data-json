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
  PageKey,
  SectionKeyForPage,
  SectionDataType,
} from "@/types/types";

// ----- ACTIONS & UTILS -----
import { getAdminContent, updateSectionContent } from "./actions";
import {
  generateLabel,
  isImageField, // Эта функция остается для справки
  inferInputElement,
  createEmptySectionData, // ПРЕДПОЛАГАЕМ, ЧТО ЭТА ФУНКЦИЯ ОБНОВЛЕНА И МОЖЕТ ВОЗВРАЩАТЬ "color"
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
  const [selectedPageKey, setSelectedPageKey] = useState<PageKey | null>(null); // Инициализируем null

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
        // Не выбираем первую страницу автоматически
        const pageKeys = Object.keys(content) as PageKey[];
        if (pageKeys.length === 0) {
          setLoadError("No pages found in content.");
        }
        // setIsLoading(false) будет вызван в следующем эффекте
      })
      .catch((err) => {
        setLoadError(
          `Failed to load content: ${
            err instanceof Error ? err.message : String(err)
          }`
        );
        setAppContent(null);
        setIsLoading(false); // Завершаем с ошибкой, если контент не загружен
      });
  }, []); // Пустой массив зависимостей

  // === Эффект: Инициализация данных для редактирования при смене страницы ===
  useEffect(() => {
    console.log(
      `[Effect Init Edit Data] Triggered. Page: ${selectedPageKey}, AppContent: ${!!appContent}`
    );
    // Сбрасываем все состояния редактирования при смене страницы
    setEditingPageData(null);
    setImagePreviews({});
    setPendingFileUploads({});
    setStatusMessage("");
    setSaveError(null);

    if (appContent && selectedPageKey) {
      const pageData = appContent[selectedPageKey]; // Тип: AppContent[P]
      if (pageData) {
        const initialEditingData: EditingPageDataType = {};
        // Object.keys(pageData) возвращает string[]
        Object.keys(pageData).forEach((sectionKeyAsString) => {
          // Приводим sectionKeyAsString к конкретному типу ключа для этой страницы
          const sectionKey = sectionKeyAsString as SectionKeyForPage<
            typeof selectedPageKey
          >;

          const sectionContent = pageData[sectionKey]; // Тип: AppContent[P][S]

          // Проверяем, что sectionContent существует и не null/undefined,
          // чтобы JSON.stringify не вызвал ошибку на таких значениях
          if (
            sectionContent !== null &&
            typeof sectionContent !== "undefined"
          ) {
            try {
              // Глубокое копирование через JSON.stringify и JSON.parse
              // Это гарантированно создаст новый объект, если sectionContent является объектом.
              // Если sectionContent - это примитив (хотя не должно быть по вашей структуре),
              // то JSON.parse(JSON.stringify(primitive)) вернет этот примитив.
              const copiedSectionContent = JSON.parse(
                JSON.stringify(sectionContent)
              );

              // Дополнительная проверка, что результат копирования - это объект,
              // и он соответствует SectionDataType (Record<string, string>)
              if (
                typeof copiedSectionContent === "object" &&
                copiedSectionContent !== null &&
                !Array.isArray(copiedSectionContent)
              ) {
                initialEditingData[sectionKey] =
                  copiedSectionContent as SectionDataType;
              } else {
                // Если после копирования это не ожидаемый объект (маловероятно для вашей структуры)
                console.warn(
                  `[Effect Init Edit Data] Copied content for ${selectedPageKey}.${String(
                    sectionKey
                  )} is not a suitable object:`,
                  copiedSectionContent
                );
                initialEditingData[sectionKey] = createEmptySectionData();
              }
            } catch (error) {
              // Ошибка при JSON.parse/stringify (например, если sectionContent содержит циклические ссылки, что не ваш случай)
              console.error(
                `[Effect Init Edit Data] Error deep copying content for ${selectedPageKey}.${String(
                  sectionKey
                )}:`,
                error,
                sectionContent
              );
              initialEditingData[sectionKey] = createEmptySectionData();
            }
          } else {
            // sectionContent is null или undefined
            console.warn(
              `[Effect Init Edit Data] Content for ${selectedPageKey}.${String(
                sectionKey
              )} is null or undefined.`,
              sectionContent
            );
            initialEditingData[sectionKey] = createEmptySectionData();
          }
        });
        setEditingPageData(initialEditingData);
        console.log(
          `[Effect Init Edit Data] Initialized editing data for page: ${selectedPageKey}`,
          initialEditingData
        );
      } else {
        console.warn(
          `[Effect Init Edit Data] No page data found for key: ${selectedPageKey}`
        );
      }
    }

    // Завершаем начальную загрузку, если она еще не завершена
    if (isLoading && appContent) {
      console.log(
        "[Effect Init Edit Data] Initial loading complete. Setting isLoading to false."
      );
      setIsLoading(false);
    }
  }, [selectedPageKey, appContent, isLoading]);

  // === Обработчики ===

  // Выбор страницы
  const handlePageSelect = (pageKey: PageKey) => {
    if (isSaving || pageKey === selectedPageKey) return;
    setSelectedPageKey(pageKey);
  };

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
        const inputKey = `${sectionKey}-${fieldKey}`;
        setImagePreviews((prev) => {
          const sectionPrev = { ...(prev[sectionKey] || {}) };
          delete sectionPrev[fieldKey];
          return { ...prev, [sectionKey]: sectionPrev };
        });
        setPendingFileUploads((prev) => {
          const next = { ...prev };
          delete next[inputKey];
          return next;
        });
        if (fileInputRefs.current[inputKey])
          fileInputRefs.current[inputKey]!.value = "";
      }
    },
    []
  ); // Нет зависимостей

  // Обработчик выбора файла
  const handleFileChange = (
    sectionKey: string,
    fieldKey: string,
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    const inputKey = `${sectionKey}-${fieldKey}`;
    setSaveError(null);
    if (!file) {
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
    if (!file.type.startsWith("image/")) {
      setSaveError("Not an image.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setSaveError("Image too large.");
      return;
    }

    setPendingFileUploads((prev) => ({ ...prev, [inputKey]: file }));
    const reader = new FileReader();
    reader.onload = (e) =>
      setImagePreviews((prev) => ({
        ...prev,
        [sectionKey]: {
          ...(prev[sectionKey] || {}),
          [fieldKey]: e.target?.result as string,
        },
      }));
    reader.onerror = () => setSaveError("Failed to read preview.");
    reader.readAsDataURL(file);
  };

  // Обработчик очистки файла
  const handleClearInput = (sectionKey: string, fieldKey: string) => {
    handleFormChange(sectionKey, fieldKey, "");
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

    const originalPageData = appContent[selectedPageKey];
    const sectionsToUpdate: string[] = [];

    // 1. Определяем измененные секции
    Object.keys(editingPageData).forEach((sectionKey) => {
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

    // 2. Выполняем запросы на обновление
    const updatePromises = sectionsToUpdate.map(async (sectionKey) => {
      const sectionDataToSave = editingPageData[sectionKey];
      const formDataToSend = new FormData();
      formDataToSend.append("pageKey", selectedPageKey);
      formDataToSend.append("sectionKey", sectionKey);
      formDataToSend.append(
        "sectionDataJson",
        JSON.stringify(sectionDataToSave)
      );

      let uploadedFileFieldKey: string | null = null;
      Object.entries(pendingFileUploads).forEach(([uploadKey, file]) => {
        if (uploadKey.startsWith(`${sectionKey}-`)) {
          const fieldKey = uploadKey.split(/-(.+)/)[1]; // Исправлено получение fieldKey
          formDataToSend.append("imageFile", file);
          formDataToSend.append("imageFieldKey", fieldKey);
          uploadedFileFieldKey = fieldKey;
        }
      });

      try {
        const result = await updateSectionContent(
          selectedPageKey,
          sectionKey as SectionKeyForPage<typeof selectedPageKey>,
          formDataToSend
        );
        if (!result.success) throw new Error(result.message || "Save failed");
        return {
          sectionKey,
          updatedSection: result.updatedSection,
          uploadedFileFieldKey,
        };
      } catch (err) {
        throw new Error(
          `Section '${generateLabel(sectionKey)}': ${
            err instanceof Error ? err.message : String(err)
          }`
        );
      }
    });

    // 3. Обрабатываем результаты
    const results = await Promise.allSettled(updatePromises);
    let hasErrors = false;
    let combinedStatusMessage = "";
    const successfullySavedSections: Record<string, SectionDataType> = {};
    const clearedFileUploads: string[] = [];

    results.forEach((result) => {
      if (result.status === "fulfilled") {
        const { sectionKey, updatedSection, uploadedFileFieldKey } =
          result.value;
        if (updatedSection) {
          successfullySavedSections[sectionKey] = updatedSection;
          combinedStatusMessage += `Section '${generateLabel(
            sectionKey
          )}' saved. `;
          if (uploadedFileFieldKey)
            clearedFileUploads.push(`${sectionKey}-${uploadedFileFieldKey}`);
        }
      } else {
        hasErrors = true;
        combinedStatusMessage += `Error: ${
          result.reason?.message || "Unknown error"
        }. `;
        console.error("Save error:", result.reason);
      }
    });

    // 4. Обновляем состояния
    if (Object.keys(successfullySavedSections).length > 0) {
      setAppContent((prev) => {
        /* ... Обновление appContent ... */ return prev;
      });
      setEditingPageData((prev) => {
        /* ... Обновление editingPageData ... */ return prev;
      });
      setPendingFileUploads((prev) => {
        /* ... Очистка pendingFileUploads ... */ return prev;
      });
      setImagePreviews((prev) => {
        /* ... Очистка превью ... */ return prev;
      });
      clearedFileUploads.forEach((uploadKey) => {
        /* ... Сброс инпутов ... */
        if (fileInputRefs.current[uploadKey]) {
          fileInputRefs.current[uploadKey]!.value = "";
        }
      });
    }

    setStatusMessage(combinedStatusMessage.trim());
    if (hasErrors) setSaveError("Some sections failed to save.");
    else setSaveError(null);
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
  const isAnySectionSaving = isSaving;

  return (
    <div className="admin-container">
      <h1>Admin Panel</h1>

      {saveError && <div className="error-message">{saveError}</div>}
      {statusMessage && !saveError && (
        <div className="status-message">{statusMessage}</div>
      )}

      {/* Навигация по страницам */}
      <nav className="page-nav">
        <strong>Pages:</strong>
        {pageKeys.map((key) => (
          <button
            key={key}
            onClick={() => handlePageSelect(key)}
            disabled={isAnySectionSaving}
            style={{
              fontWeight: key === selectedPageKey ? "bold" : "normal",
              borderColor: key === selectedPageKey ? "#007bff" : "#ccc",
              backgroundColor: key === selectedPageKey ? "#e7f3ff" : "#f0f0f0",
            }}
          >
            {generateLabel(key)}
          </button>
        ))}
      </nav>

      {/* Форма для ВСЕХ секций выбранной страницы */}
      {selectedPageKey && (
        <form ref={formRef} onSubmit={handleSubmit}>
          <div className="sections-container">
            <h2>Editing Page: {generateLabel(selectedPageKey)}</h2>
            {!editingPageData && <p>Loading sections...</p>}

            {editingPageData && sectionKeys.length > 0
              ? sectionKeys.map((sectionKey) => {
                  const sectionFormData = editingPageData[sectionKey];
                  const fieldKeys = Object.keys(sectionFormData || {});

                  return (
                    // Блок для одной секции
                    <div
                      key={`${selectedPageKey}-${sectionKey}`}
                      className="section-editor"
                    >
                      <h3>{generateLabel(sectionKey)}</h3>
                      {sectionFormData ? (
                        fieldKeys.map((fieldKey) => {
                          const value = sectionFormData[fieldKey];
                          const label = generateLabel(fieldKey);
                          const inputType = inferInputElement(fieldKey); // ИСПОЛЬЗУЕМ ОБНОВЛЕННУЮ inferInputElement
                          const elementKey = `${selectedPageKey}-${sectionKey}-${fieldKey}`;
                          const previewKey = `${sectionKey}-${fieldKey}`;
                          const localPreview =
                            imagePreviews[sectionKey]?.[fieldKey];
                          const existingImageUrl =
                            isImageField(fieldKey) && value && !localPreview // isImageField все еще нужна здесь для логики URL
                              ? value
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
                                  accept="image/*"
                                  ref={(el) => {
                                    fileInputRefs.current[previewKey] = el;
                                  }}
                                  onChange={(e) =>
                                    handleFileChange(sectionKey, fieldKey, e)
                                  }
                                  disabled={isSaving}
                                />
                                {(value || localPreview) && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleClearInput(sectionKey, fieldKey)
                                    }
                                    disabled={isSaving}
                                  >
                                    Clear
                                  </button>
                                )}
                              </div>
                            );
                          } else if (inputType === "color") {
                            return (
                              <div key={elementKey} className="form-field">
                                <label htmlFor={elementKey}>{label}:</label>
                                <input
                                  type="color"
                                  id={elementKey}
                                  name={elementKey}
                                  value={value}
                                  onChange={(e) =>
                                    handleFormChange(
                                      // Используем тот же обработчик
                                      sectionKey,
                                      fieldKey,
                                      e.target.value
                                    )
                                  }
                                  disabled={isSaving}
                                  // Можно добавить немного базовых стилей для input type="color"
                                  style={{
                                    padding: 0,
                                    height: "30px",
                                    width: "50px",
                                    border: "1px solid #ccc",
                                  }}
                                />
                                {value && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleClearInput(sectionKey, fieldKey)
                                    }
                                    disabled={isSaving}
                                  >
                                    Clear
                                  </button>
                                )}
                              </div>
                            );
                          } else {
                            // textarea - это исходный fallback
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
                          // =========================================================
                          // === КОНЕЦ ЕДИНСТВЕННОГО БЛОКА ИЗМЕНЕНИЙ ДЛЯ COLOR INPUT ===
                          // =========================================================
                        }) // Конец fieldKeys.map
                      ) : (
                        <p>No fields data for this section.</p>
                      )}
                    </div> // Конец section-editor
                  );
                }) // Конец sectionKeys.map
              : editingPageData && <p>This page has no sections.</p>}
          </div>

          {/* Общая кнопка сохранения */}
          {editingPageData && (
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
      {!selectedPageKey && pageKeys.length > 0 && !isLoading && (
        <p className="placeholder-message">Select a page to start editing.</p>
      )}
    </div>
  );
}
