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

// Импорты типов
import {
  AppContent,
  SpecificPageKey,
  SectionKeyForPage,
  SectionDataType,
} from "@/types/types"; // Путь к вашим типам

// Импорты утилит и экшенов
import { getAdminContent, updateSectionContent } from "./actions"; // Путь к вашим экшенам
import {
  generateLabel,
  isImageField,
  inferInputElement,
} from "@/lib/content-utils"; // Путь к вашим утилитам

export default function AdminPage() {
  // === Основные состояния ===
  const [appContent, setAppContent] = useState<AppContent | null>(null); // Весь контент
  const [isLoading, setIsLoading] = useState<boolean>(true); // Статус загрузки контента
  const [error, setError] = useState<string | null>(null); // Ошибки загрузки/сохранения

  // === Состояния выбора ===
  const [selectedPageKey, setSelectedPageKey] =
    useState<SpecificPageKey | null>(null);
  const [selectedSectionKey, setSelectedSectionKey] = useState<string | null>(
    null
  ); // Ключ секции - строка

  // === Состояния формы ===
  const [formData, setFormData] = useState<SectionDataType | null>(null); // Данные ТЕКУЩЕЙ формы
  const [imagePreviews, setImagePreviews] = useState<
    Record<string, string | null>
  >({}); // Локальные превью
  const [uploadingImageField, setUploadingImageField] = useState<string | null>(
    null
  ); // Поле файла для загрузки

  // === Состояния UI ===
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>("");

  // Рефы
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // === Эффект: Загрузка начальных данных ===
  useEffect(() => {
    setIsLoading(true);
    setError(null);
    getAdminContent()
      .then((content) => {
        setAppContent(content);
        // Автоматически выбираем первую страницу, если она есть
        const pageKeys = Object.keys(content) as SpecificPageKey[];
        if (pageKeys.length > 0) {
          setSelectedPageKey(pageKeys[0]);
        } else {
          setError("No pages found in content.");
          setIsLoading(false);
        }
      })
      .catch((err) => {
        setError(
          `Failed to load content: ${
            err instanceof Error ? err.message : String(err)
          }`
        );
        setAppContent(null);
        setIsLoading(false);
      });
  }, []); // Запускается один раз при монтировании

  // === Эффект: Обновление данных формы при смене страницы или секции ===
  useEffect(() => {
    // Сбрасываем форму и превью при любой смене выбора
    setFormData(null);
    setImagePreviews({});
    setUploadingImageField(null);
    setStatusMessage(""); // Сброс статуса
    // setError(null); // НЕ сбрасываем ошибку загрузки

    if (appContent && selectedPageKey && selectedSectionKey) {
      const sectionData =
        appContent[selectedPageKey]?.[
          selectedSectionKey as SectionKeyForPage<typeof selectedPageKey>
        ];
      if (sectionData) {
        // Устанавливаем данные формы (это копия!)
        setFormData({ ...sectionData } as SectionDataType);
        console.log(
          `Loaded form data for ${selectedPageKey}/${selectedSectionKey}`
        );
      } else {
        console.warn(
          `No data found for section ${selectedPageKey}/${selectedSectionKey}`
        );
        // Оставляем formData null, чтобы показать сообщение
      }
    }
    // Завершаем начальную загрузку, если она еще не завершена
    if (isLoading && appContent) {
      setIsLoading(false);
    }
  }, [selectedPageKey, selectedSectionKey, appContent]); // Зависит от выбора и загруженного контента

  // === Обработчики выбора ===
  const handlePageSelect = (pageKey: SpecificPageKey) => {
    if (isSaving || pageKey === selectedPageKey) return;
    setSelectedPageKey(pageKey);
    setSelectedSectionKey(null); // Сбрасываем секцию при смене страницы
  };

  const handleSectionSelect = (sectionKey: string) => {
    if (isSaving || sectionKey === selectedSectionKey) return;
    setSelectedSectionKey(sectionKey);
  };

  // === Обработчики формы ===

  // Универсальный обработчик для полей формы (кроме file)
  const handleFormChange = useCallback(
    (fieldName: string, value: string) => {
      setFormData((currentData) => {
        if (!currentData) return null; // Не должно произойти, но на всякий случай
        console.log(`Form field changed: ${fieldName} = "${value}"`);
        return { ...currentData, [fieldName]: value };
      });
      // Если очистили поле image вручную
      if (isImageField(fieldName) && value === "") {
        setImagePreviews((prev) => ({ ...prev, [fieldName]: null }));
        if (fileInputRefs.current[fieldName])
          fileInputRefs.current[fieldName]!.value = "";
        if (uploadingImageField === fieldName) setUploadingImageField(null);
      }
    },
    [uploadingImageField]
  );

  // Обработчик выбора файла
  const handleFileChange = (
    fieldName: string,
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) {
      // Отмена выбора
      if (uploadingImageField === fieldName) setUploadingImageField(null);
      setImagePreviews((prev) => ({ ...prev, [fieldName]: null }));
      return;
    }
    // Проверки
    if (!file.type.startsWith("image/")) {
      setError("Selected file is not an image.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Image file is too large (max 5MB).");
      return;
    }

    setError(null); // Сброс ошибки
    setUploadingImageField(fieldName); // Указываем, какое поле меняем
    const reader = new FileReader();
    reader.onload = (e) =>
      setImagePreviews((prev) => ({
        ...prev,
        [fieldName]: e.target?.result as string,
      }));
    reader.onerror = () => setError("Failed to read file preview.");
    reader.readAsDataURL(file);
  };

  // Обработчик очистки файла
  const handleClearImage = (fieldName: string) => {
    handleFormChange(fieldName, ""); // Вызываем основной обработчик с пустой строкой
  };

  // === Обработчик сохранения ===
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!formData || !selectedPageKey || !selectedSectionKey || isSaving)
      return;

    setIsSaving(true);
    setStatusMessage("Saving...");
    setError(null);

    const dataToSend = new FormData();
    dataToSend.append("pageKey", selectedPageKey);
    dataToSend.append("sectionKey", selectedSectionKey);
    dataToSend.append("sectionDataJson", JSON.stringify(formData)); // Отправляем текущее состояние формы

    if (
      uploadingImageField &&
      fileInputRefs.current[uploadingImageField]?.files?.[0]
    ) {
      dataToSend.append(
        "imageFile",
        fileInputRefs.current[uploadingImageField]!.files![0]
      );
      dataToSend.append("imageFieldKey", uploadingImageField);
    }

    try {
      const result = await updateSectionContent(
        selectedPageKey,
        selectedSectionKey as SectionKeyForPage<typeof selectedPageKey>,
        dataToSend
      );

      if (result.success) {
        setStatusMessage(result.message || "Saved successfully!");
        if (result.updatedSection) {
          // Обновляем основное состояние контента
          setAppContent((prevContent) => {
            if (!prevContent) return null;
            return {
              ...prevContent,
              [selectedPageKey]: {
                ...prevContent[selectedPageKey],
                [selectedSectionKey!]:
                  result.updatedSection as AppContent[SpecificPageKey][SectionKeyForPage<SpecificPageKey>],
              },
            };
          });
          // Обновляем форму данными с сервера
          setFormData(result.updatedSection);
          // Сбрасываем состояние загрузки
          if (
            uploadingImageField &&
            fileInputRefs.current[uploadingImageField]
          ) {
            fileInputRefs.current[uploadingImageField]!.value = "";
          }
          setUploadingImageField(null);
          setImagePreviews({}); // Очищаем все превью
        }
      } else {
        setError(result.message || "Failed to save data.");
      }
    } catch (err) {
      setError(
        `Submission error: ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      setIsSaving(false);
    }
  };

  // === Рендеринг ===

  // Состояние загрузки
  if (isLoading) {
    return (
      <div className="admin-container loading">Loading Content Editor...</div>
    );
  }

  // Состояние критической ошибки (контент не загружен)
  if (error && !appContent) {
    return (
      <div className="admin-container error">
        <h1>Error Loading Content</h1>
        <p>{error}</p>
      </div>
    );
  }

  // Контент не загружен (не должно произойти, но на всякий случай)
  if (!appContent) {
    return <div className="admin-container">Could not load content data.</div>;
  }

  // Получаем ключи из актуального состояния appContent
  const pageKeys = Object.keys(appContent) as SpecificPageKey[];
  const sectionKeys = selectedPageKey
    ? Object.keys(appContent[selectedPageKey] || {})
    : [];

  return (
    <div className="admin-container">
      <h1>Admin Panel</h1>

      {/* Сообщения об ошибках и статусе */}
      {error && (
        <div className="error-message">
          <strong>Error:</strong> {error}
        </div>
      )}
      {statusMessage && !error && (
        <div className="status-message">{statusMessage}</div>
      )}

      {/* Навигация по страницам */}
      <nav className="page-nav">
        <strong>Pages:</strong>
        {pageKeys.length > 0 ? (
          pageKeys.map((key) => (
            <button
              key={key}
              onClick={() => handlePageSelect(key)}
              disabled={isSaving}
              className={key === selectedPageKey ? "active" : ""}
            >
              {generateLabel(key)}
            </button>
          ))
        ) : (
          <span>No pages.</span>
        )}
      </nav>

      {/* Навигация по секциям */}
      {selectedPageKey && (
        <nav className="section-nav">
          <strong>Sections in '{generateLabel(selectedPageKey)}':</strong>
          {sectionKeys.length > 0 ? (
            sectionKeys.map((key) => (
              <button
                key={key}
                onClick={() => handleSectionSelect(key)}
                disabled={isSaving}
                className={key === selectedSectionKey ? "active" : ""}
              >
                {generateLabel(key)}
              </button>
            ))
          ) : (
            <span>No sections.</span>
          )}
        </nav>
      )}

      {/* Форма редактирования */}
      {selectedPageKey && selectedSectionKey && (
        <div className="edit-form">
          <h2>Edit Section: {generateLabel(selectedSectionKey)}</h2>
          {formData ? ( // Показываем форму только если formData загружены
            <form onSubmit={handleSubmit}>
              {Object.keys(formData).map((key) => {
                // Рендерим поля на основе ключей formData
                const value = formData[key];
                const label = generateLabel(key);
                const inputType = inferInputElement(key);
                const elementKey = `${selectedPageKey}-${selectedSectionKey}-${key}`;
                const localPreview = imagePreviews[key];
                const existingImageUrl =
                  isImageField(key) && value && !localPreview
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
                          <div className="no-image-placeholder">No Image</div>
                        )}
                      </div>
                      <input
                        type="file"
                        id={elementKey}
                        name={key}
                        accept="image/*"
                        ref={(el) => {
                          fileInputRefs.current[key] = el;
                        }}
                        onChange={(e) => handleFileChange(key, e)}
                        disabled={isSaving}
                      />
                      {(value || localPreview) && (
                        <button
                          type="button"
                          onClick={() => handleClearImage(key)}
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
                        name={key}
                        value={value}
                        onChange={(e) => handleFormChange(key, e.target.value)}
                        rows={5}
                        disabled={isSaving}
                      />
                    </div>
                  );
                }
              })}
              <hr />
              <button type="submit" disabled={isSaving}>
                {isSaving ? "Saving..." : "Save Changes"}
              </button>
            </form>
          ) : (
            // Показываем, если секция выбрана, но formData еще null (загрузка или пустая секция)
            <p>Loading fields or section is empty...</p>
          )}
        </div>
      )}

      {/* Сообщение-подсказка, если не выбрана страница или секция */}
      {!selectedPageKey && !isLoading && (
        <p className="placeholder-message">Select a page to begin.</p>
      )}
      {selectedPageKey && !selectedSectionKey && (
        <p className="placeholder-message">Select a section to edit.</p>
      )}

      {/* Стили (оставляем как в предыдущем примере) */}
      <style jsx global>{`
        /* ... Стили из предыдущего ответа ... */
        body {
          font-family: sans-serif;
        }
        .admin-container {
          padding: 20px;
          max-width: 900px;
          margin: 0 auto;
        }
        .loading,
        .error {
          text-align: center;
          padding: 40px;
        }
        .error-message {
          color: red;
          border: 1px solid red;
          padding: 10px;
          margin-bottom: 15px;
          border-radius: 4px;
        }
        .status-message {
          color: green;
          border: 1px solid green;
          padding: 10px;
          margin-bottom: 15px;
          border-radius: 4px;
        }
        nav {
          margin-bottom: 20px;
          padding-bottom: 10px;
          border-bottom: 1px solid #ccc;
        }
        nav strong {
          margin-right: 10px;
        }
        nav button {
          margin: 0 5px;
          padding: 5px 10px;
          cursor: pointer;
          border: 1px solid #ccc;
          background: #f0f0f0;
          border-radius: 4px;
        }
        nav button.active {
          font-weight: bold;
          border-color: #007bff;
          background: #e7f3ff;
        }
        nav button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        hr {
          margin: 25px 0;
          border: none;
          border-top: 1px solid #eee;
        }
        .edit-form button[type="submit"] {
          padding: 10px 15px;
          background-color: #28a745;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 1em;
        }
        .edit-form button[type="submit"]:disabled {
          background-color: #aaa;
        }
        .placeholder-message {
          color: #888;
          font-style: italic;
          margin-top: 20px;
        }
        /* Стили для полей формы */
        .form-field {
          margin-bottom: 15px;
        }
        .form-field label {
          display: block;
          margin-bottom: 5px;
          font-weight: bold;
        }
        .form-field textarea {
          width: 100%;
          padding: 8px;
          border: 1px solid #ccc;
          border-radius: 4px;
          min-height: 80px;
          font-size: 1em;
        }
        .form-field-image {
          border: 1px solid #eee;
          padding: 15px;
          margin-bottom: 15px;
          border-radius: 4px;
        }
        .image-preview-container {
          min-height: 110px;
          margin-bottom: 10px;
          border: 1px dashed #ccc;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #f9f9f9;
          position: relative;
        }
        .no-image-placeholder {
          color: #888;
          font-style: italic;
        }
        .form-field-image input[type="file"] {
          display: block;
          margin-bottom: 8px;
        }
        .form-field-image button[type="button"] {
          background: #dc3545;
          color: white;
          border: none;
          padding: 4px 8px;
          font-size: 0.9em;
          border-radius: 3px;
          cursor: pointer;
        }
        .form-field-image button:disabled {
          background: #aaa;
        }
      `}</style>
    </div>
  );
}
