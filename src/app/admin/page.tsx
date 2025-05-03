// src/app/admin/page.tsx
"use client";

import {
  useState,
  useEffect,
  FormEvent,
  useRef,
  ChangeEvent,
  useCallback, // Оставляем только для handleInputChange, т.к. он в зависимостях
} from "react";
import Image from "next/image";
import { AppContent, PageKey, SectionContent } from "../../types/types"; // Убедимся, что путь правильный
import { getAdminContent, updateSectionContent } from "./actions";
import {
  generateLabel,
  isImageField,
  inferInputElement,
  createEmptySectionContent,
} from "@/lib/content-utils";

// Тип для данных формы - SectionContent или null
type CurrentFormDataType = SectionContent | null;

// Можно вынести рендеринг полей в отдельный компонент для чистоты,
// но пока оставим здесь для простоты примера.
/*
interface SectionFormFieldProps {
  fieldKey: string;
  value: string; // Всегда строка
  label: string;
  isSaving: boolean;
  localPreviewUrl?: string | null;
  onInputChange: (key: string, value: string) => void;
  onFileChange: (fieldKey: string, e: ChangeEvent<HTMLInputElement>) => void;
  onClearImage: (fieldKey: string) => void;
  fileInputRef: (el: HTMLInputElement | null) => void;
}

const SectionFormField: React.FC<SectionFormFieldProps> = ({ ... }) => { ... }
*/

export default function AdminPage() {
  // === Состояния ===
  const [appContent, setAppContent] = useState<AppContent | null>(null);
  const [pageKeys, setPageKeys] = useState<PageKey[]>([]);
  const [selectedPageKey, setSelectedPageKey] = useState<PageKey | null>(null);
  const [sectionKeys, setSectionKeys] = useState<string[]>([]);
  const [selectedSectionKey, setSelectedSectionKey] = useState<string | null>(
    null
  );
  const [currentFormData, setCurrentFormData] =
    useState<CurrentFormDataType>(null);
  const [localImagePreviews, setLocalImagePreviews] = useState<{
    [key: string]: string | null;
  }>({});
  const [uploadingImageField, setUploadingImageField] = useState<string | null>(
    null
  );

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const fileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});
  const formRef = useRef<HTMLFormElement>(null);

  // === Эффекты ===

  // 1. Загрузка начальных данных
  useEffect(() => {
    async function loadInitialContent() {
      setIsLoading(true);
      setError(null);
      setAppContent(null);
      setPageKeys([]);
      setSelectedPageKey(null);
      // Сбрасываем все зависимые состояния
      setSectionKeys([]);
      setSelectedSectionKey(null);
      setCurrentFormData(null);
      setLocalImagePreviews({});
      setUploadingImageField(null);
      setStatusMessage("");

      try {
        const fetchedContent = await getAdminContent();
        setAppContent(fetchedContent);
        const keys = Object.keys(fetchedContent || {}) as PageKey[];
        setPageKeys(keys);
        // Выбираем первую страницу, если она есть
        if (keys.length > 0) {
          setSelectedPageKey(keys[0]);
        } else {
          console.warn("No pages found in content.");
          setIsLoading(false); // Загрузка завершена, если страниц нет
        }
      } catch (err: unknown) {
        // Типизируем ошибку
        const message = err instanceof Error ? err.message : String(err);
        console.error("Failed to load content for admin:", err);
        setError(`Failed to load content: ${message}`);
        setIsLoading(false); // Загрузка завершена с ошибкой
      }
      // setIsLoading(false) будет вызван в useEffect[selectedSectionKey] после установки данных формы
    }
    loadInitialContent();
  }, []); // Только при монтировании

  // 2. Обновление секций при смене страницы
  useEffect(() => {
    let keys: string[] = [];
    if (selectedPageKey && appContent) {
      keys = Object.keys(appContent[selectedPageKey] || {});
    }
    setSectionKeys(keys);
    setSelectedSectionKey(keys.length > 0 ? keys[0] : null);
    // Очищаем форму и превью, они загрузятся в следующем эффекте
    setCurrentFormData(null);
    setLocalImagePreviews({});
    setUploadingImageField(null);
    setStatusMessage("");
    setError(null); // Сброс ошибок при смене страницы
  }, [selectedPageKey, appContent]);

  // 3. Обновление данных формы при смене секции
  useEffect(() => {
    let sectionData: SectionContent | null = null;
    if (appContent && selectedPageKey && selectedSectionKey) {
      // Получаем данные секции ИЛИ null, если ключи есть, а данных нет
      sectionData = appContent[selectedPageKey]?.[selectedSectionKey] ?? null;
    }

    // Если ключ секции выбран, но данных нет (новая секция?), создаем пустую структуру
    const formDataToSet =
      sectionData ?? (selectedSectionKey ? createEmptySectionContent() : null);
    setCurrentFormData(formDataToSet);

    // Сбрасываем локальные превью и статус загрузки файла при смене секции
    setLocalImagePreviews({});
    setUploadingImageField(null);

    // Завершаем индикатор загрузки, если он был активен и данные (или null) установлены
    if (isLoading) setIsLoading(false);

    // Сброс сообщений
    setStatusMessage("");
    setError(null);
  }, [selectedSectionKey, selectedPageKey, appContent]); // Убрали isLoading из зависимостей

  // === Обработчики ===
  const handlePageNavClick = (pageKey: PageKey) => {
    if (pageKey !== selectedPageKey && !isSaving) {
      setSelectedPageKey(pageKey);
    }
  };
  const handleSectionNavClick = (sectionKey: string) => {
    if (sectionKey !== selectedSectionKey && !isSaving) {
      setSelectedSectionKey(sectionKey);
    }
  };

  // useCallback нужен здесь, так как handleInputChange может быть использована
  // в других useCallback или useEffect как зависимость (хотя сейчас не используется).
  // Оставляем для потенциальной будущей оптимизации.
  const handleInputChange = useCallback(
    (key: string, value: string) => {
      setCurrentFormData((prevData) => {
        const baseData =
          prevData ?? createEmptySectionContent(Object.keys(prevData ?? {}));
        return { ...baseData, [key]: value }; // value всегда строка
      });
      // Сбрасываем локальное превью для поля image, если его значение очистили вручную
      if (isImageField(key) && value === "") {
        setLocalImagePreviews((prev) => ({ ...prev, [key]: null }));
        // Также сбрасываем input[type=file], если он был связан с этим полем
        if (fileInputRefs.current[key]) {
          fileInputRefs.current[key]!.value = "";
        }
        // Если это поле было выбрано для загрузки, сбрасываем флаг
        if (uploadingImageField === key) {
          setUploadingImageField(null);
        }
      }
    },
    [uploadingImageField]
  ); // Добавили uploadingImageField в зависимости

  // Для этих обработчиков useCallback не обязателен, т.к. они не передаются в мемоизированные компоненты
  const handleTextareaChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    handleInputChange(e.target.name, e.target.value);
  };

  const handleFileChange = (
    fieldKey: string,
    e: ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      // Простая валидация типа на клиенте (серверная важнее)
      if (!file.type.startsWith("image/")) {
        setError(`File selected for '${fieldKey}' is not an image.`);
        e.target.value = ""; // Сброс инпута
        return;
      }
      // Простая валидация размера на клиенте
      if (file.size > 5 * 1024 * 1024) {
        // ~5MB
        setError(`Image for '${fieldKey}' is too large (max 5MB).`);
        e.target.value = ""; // Сброс инпута
        return;
      }

      setUploadingImageField(fieldKey); // Запоминаем, ДЛЯ КАКОГО ПОЛЯ выбран файл
      setError(null); // Сброс ошибки
      setStatusMessage(""); // Сброс статуса
      const reader = new FileReader();
      reader.onload = (loadEvent) => {
        // Сохраняем локальное превью (Data URL)
        setLocalImagePreviews((prev) => ({
          ...prev,
          [fieldKey]: loadEvent.target?.result as string,
        }));
      };
      reader.onerror = () => {
        setError(`Failed to read file for preview: ${file.name}`);
        setUploadingImageField(null);
        setLocalImagePreviews((prev) => ({ ...prev, [fieldKey]: null }));
      };
      reader.readAsDataURL(file);
    } else {
      // Пользователь отменил выбор файла
      setUploadingImageField(null);
      setLocalImagePreviews((prev) => ({ ...prev, [fieldKey]: null }));
      // Не нужно вызывать handleInputChange, т.к. данные не изменились
    }
  };

  const handleClearImage = (fieldKey: string) => {
    handleInputChange(fieldKey, ""); // Устанавливаем пустую строку в данных формы
    // Остальное сбрасывается внутри handleInputChange (превью, file input, uploading flag)
  };

  // === Отправка формы ===
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (
      !formRef.current ||
      !currentFormData ||
      !selectedPageKey ||
      !selectedSectionKey
    ) {
      setError(
        "Cannot save: critical information missing (page, section, or form data). Please select a section."
      );
      return;
    }

    setIsSaving(true);
    setStatusMessage("Saving...");
    setError(null);
    const formDataToSend = new FormData();

    // 1. Ключи страницы и секции (уже проверены на null выше)
    formDataToSend.append("pageKey", String(selectedPageKey)); // PageKey уже строка или будет приведена
    formDataToSend.append("sectionKey", selectedSectionKey);

    // 2. Файл изображения, если выбран для загрузки
    let imageFile: File | null = null;
    if (
      uploadingImageField &&
      fileInputRefs.current[uploadingImageField]?.files?.[0]
    ) {
      imageFile = fileInputRefs.current[uploadingImageField]!.files![0];
      formDataToSend.append("imageFile", imageFile);
      formDataToSend.append("imageFieldKey", uploadingImageField);
      console.log(
        `Appending image file for field: ${uploadingImageField}, Name: ${imageFile.name}`
      );
    } else {
      console.log("No new image file selected for upload.");
    }

    // 3. Сериализуем ТЕКУЩЕЕ состояние формы (currentFormData)
    // Убедимся, что все значения - строки (хотя handleInputChange должен это гарантировать)
    const dataToSend: SectionContent = {};
    Object.keys(currentFormData).forEach((key) => {
      dataToSend[key] = currentFormData[key] ?? ""; // Гарантируем строку
    });

    try {
      formDataToSend.append("sectionDataJson", JSON.stringify(dataToSend));
    } catch (err: unknown) {
      // Типизация
      setError(
        `Failed to prepare data for saving: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
      setIsSaving(false);
      return;
    }

    // --- Вызов Server Action ---
    try {
      const result = await updateSectionContent(
        selectedPageKey, // Передаем актуальные ключи
        selectedSectionKey,
        formDataToSend
      );

      if (result.success) {
        setStatusMessage(result.message || "Section updated successfully!"); // Сообщение об успехе
        if (result.updatedSection) {
          // Обновляем состояние контента и формы данными с сервера
          const updatedSectionData = result.updatedSection;
          setAppContent((prev) => {
            if (!prev) return null; // Защита
            return {
              ...prev,
              [selectedPageKey!]: {
                // Уверены, что не null
                ...(prev[selectedPageKey!] || {}),
                [selectedSectionKey!]: updatedSectionData, // Уверены, что не null
              },
            };
          });
          // Обновляем текущую форму ТОЧНО теми данными, что теперь на сервере
          setCurrentFormData(updatedSectionData);
          // Сброс состояния загрузки файла ПОСЛЕ успешного сохранения
          if (
            uploadingImageField &&
            fileInputRefs.current[uploadingImageField]
          ) {
            fileInputRefs.current[uploadingImageField]!.value = ""; // Очищаем инпут
          }
          setUploadingImageField(null); // Сбрасываем флаг
          setLocalImagePreviews({}); // Очищаем все локальные превью
        } else {
          // Если сервер не вернул updatedSection, возможно, стоит перезагрузить данные
          setStatusMessage(
            result.message + " (Could not refresh form data automatically)"
          );
        }
      } else {
        // Ошибка от Server Action
        setError(
          result.message || "Failed to update section. Unknown server error."
        );
      }
    } catch (err: unknown) {
      // Ошибка самого вызова fetch/action
      const message = err instanceof Error ? err.message : String(err);
      console.error("Failed to submit form:", err);
      setError(`An unexpected error occurred during submission: ${message}`);
    } finally {
      setIsSaving(false); // Завершаем состояние сохранения в любом случае
      // Не сбрасываем statusMessage здесь, чтобы пользователь видел результат
    }
  };

  // === Динамический рендеринг полей ===
  const renderFormFields = () => {
    // Ждем загрузки данных или выбора секции
    if (isLoading) return <p>Loading section data...</p>;
    if (!selectedPageKey || !selectedSectionKey)
      return <p>Select a page and section to edit.</p>;
    if (!currentFormData)
      return <p>No data loaded for this section, or section is empty.</p>;

    const currentKeys = Object.keys(currentFormData);
    if (currentKeys.length === 0) {
      return (
        <p>This section currently has no fields defined in content.json.</p>
      );
    }

    return currentKeys.map((key) => {
      const value = currentFormData[key]; // Гарантированно строка или пустая строка
      const label = generateLabel(key);
      const inputType = inferInputElement(key);
      const elementKey = `${selectedPageKey}-${selectedSectionKey}-${key}`; // Уникальный ключ для React
      const localPreviewUrl = localImagePreviews[key];
      // Формируем URL существующего изображения, ТОЛЬКО если нет локального превью и есть значение
      const existingImageUrl =
        isImageField(key) && value && !localPreviewUrl
          ? `/api/media/${value}`
          : null;
      // Приоритет у локального превью (то, что выбрал пользователь), затем у существующего
      const displayUrl = localPreviewUrl || existingImageUrl;

      if (inputType === "file") {
        // --- Поле для изображения ---
        return (
          <div
            key={elementKey}
            style={{
              marginBottom: "20px",
              padding: "15px",
              border: "1px solid #e0e0e0",
              borderRadius: "4px",
            }}
          >
            <label
              htmlFor={key}
              style={{
                fontWeight: "bold",
                display: "block",
                marginBottom: "8px",
              }}
            >
              {label}:
            </label>
            {/* Блок превью */}
            <div style={{ marginBottom: "10px", minHeight: "100px" }}>
              {displayUrl ? (
                localPreviewUrl ? (
                  <img // Стандартный img для Data URL
                    src={displayUrl}
                    alt={`${label} preview (local)`}
                    style={{
                      maxWidth: "150px",
                      maxHeight: "150px",
                      height: "auto",
                      display: "block",
                      objectFit: "contain",
                      border: "1px solid #ccc",
                    }}
                  />
                ) : (
                  <Image // Next/Image для серверных URL
                    src={displayUrl}
                    alt={`${label} preview (current)`}
                    width={150}
                    height={150}
                    style={{
                      display: "block",
                      objectFit: "contain",
                      border: "1px solid #ccc",
                    }}
                    // Добавляем onError для обработки ошибок загрузки существующих изображений
                    onError={(e) => {
                      console.warn(`Failed to load image: ${displayUrl}`);
                      // Можно показать плейсхолдер или сообщение об ошибке
                      (e.target as HTMLImageElement).style.display = "none"; // Скрыть сломанное изображение
                      // TODO: Показать запасной контент
                    }}
                  />
                )
              ) : value ? (
                // Если есть значение, но нет URL (например, ошибка загрузки)
                <p>
                  <small>Current file: {value} (preview not available)</small>
                </p>
              ) : (
                // Нет ни значения, ни превью
                <p>
                  <small>No image set.</small>
                </p>
              )}
              {/* Показываем скрытое сообщение, если изображение не найдено на сервере */}
              {!localPreviewUrl && existingImageUrl && (
                <Image
                  key={existingImageUrl + "-check"}
                  src={existingImageUrl}
                  alt=""
                  width={1}
                  height={1}
                  style={{ display: "none" }}
                  onError={() => {
                    // Эта ошибка сработает, если prepareImageData вернул URL, но /api/media отдало 404
                    // Можно обновить состояние, чтобы показать сообщение пользователю
                    console.warn(
                      `Admin check failed for image: ${existingImageUrl}`
                    );
                    // setMissingImages(prev => ({...prev, [key]: true})) // Пример
                  }}
                />
              )}
            </div>
            {/* Инпут файла */}
            <input
              type="file"
              id={key}
              name={key} // Важно для связи с label и потенциально для FormData без JS
              accept="image/*" // Браузерный фильтр
              ref={(el) => {
                fileInputRefs.current[key] = el;
              }}
              onChange={(e) => handleFileChange(key, e)}
              disabled={isSaving}
              style={{ display: "block", marginBottom: "10px" }}
            />
            {/* Кнопка очистки */}
            {(value || localPreviewUrl) && ( // Показываем, если есть значение ИЛИ локальное превью
              <button
                type="button"
                onClick={() => handleClearImage(key)}
                disabled={isSaving}
                style={{
                  marginRight: "5px",
                  background: "#f44336",
                  color: "white",
                  border: "none",
                  padding: "5px 10px",
                  cursor: "pointer",
                }}
              >
                Clear Image
              </button>
            )}
            <small>Max 5MB. Allowed: jpg, png, webp, gif, svg.</small>
          </div>
        );
      } else {
        // --- Поле textarea ---
        return (
          <div key={elementKey} style={{ marginBottom: "15px" }}>
            <label
              htmlFor={key}
              style={{
                display: "block",
                marginBottom: "5px",
                fontWeight: "bold",
              }}
            >
              {label}:
            </label>
            <textarea
              id={key}
              name={key} // Важно для связи с label и FormData
              value={value} // Значение всегда строка из currentFormData
              onChange={handleTextareaChange}
              rows={key.toLowerCase().includes("description") ? 6 : 3} // Больше строк для описаний
              disabled={isSaving}
              style={{
                width: "100%",
                maxWidth: "800px",
                minHeight: "80px",
                padding: "8px",
                border: "1px solid #ccc",
                borderRadius: "4px",
              }}
            />
          </div>
        );
      }
    });
  };

  // === Рендеринг Компонента ===
  if (isLoading && !appContent)
    return <div style={{ padding: "20px" }}>Loading content editor...</div>;
  // Показываем ошибку ЗАГРУЗКИ контента, если она произошла
  if (error && !isLoading && !appContent && !isSaving)
    return (
      <div style={{ padding: "20px", color: "red" }}>
        Error loading content: {error}
      </div>
    );
  // Если контент не загрузился по неизвестной причине
  if (!appContent && !isLoading)
    return (
      <div style={{ padding: "20px" }}>
        Could not load application content data. Check server logs or
        content.json.
      </div>
    );

  return (
    <div style={{ padding: "20px", fontFamily: "sans-serif" }}>
      <h1>Admin Panel - Content Editor</h1>

      {/* Навигация по страницам */}
      <nav
        style={{
          marginBottom: "15px",
          paddingBottom: "10px",
          borderBottom: "2px solid black",
        }}
      >
        <strong>Pages:</strong>{" "}
        {pageKeys.length > 0 ? (
          pageKeys.map((key) => (
            <button
              key={key}
              onClick={() => handlePageNavClick(key)}
              disabled={key === selectedPageKey || isSaving}
              style={{
                marginLeft: "8px",
                padding: "5px 10px",
                cursor: "pointer",
                fontWeight: key === selectedPageKey ? "bold" : "normal",
                border:
                  key === selectedPageKey ? "2px solid blue" : "1px solid #ccc",
                opacity: isSaving ? 0.6 : 1,
              }}
            >
              {generateLabel(String(key))}
            </button>
          ))
        ) : (
          <span>No pages found. Add pages in content.json.</span>
        )}
      </nav>

      {/* Навигация по секциям */}
      {selectedPageKey && (
        <nav
          style={{
            marginBottom: "25px",
            paddingBottom: "15px",
            borderBottom: "1px solid #ccc",
          }}
        >
          <strong>
            Sections in '{generateLabel(String(selectedPageKey))}':
          </strong>{" "}
          {sectionKeys.length > 0 ? (
            sectionKeys.map((key) => (
              <button
                key={key}
                onClick={() => handleSectionNavClick(key)}
                disabled={key === selectedSectionKey || isSaving}
                style={{
                  marginLeft: "8px",
                  padding: "5px 10px",
                  cursor: "pointer",
                  fontWeight: key === selectedSectionKey ? "bold" : "normal",
                  border:
                    key === selectedSectionKey
                      ? "2px solid green"
                      : "1px solid #ccc",
                  opacity: isSaving ? 0.6 : 1,
                }}
              >
                {generateLabel(key)}
              </button>
            ))
          ) : (
            <span>
              No sections found for this page. Add sections in content.json.
            </span>
          )}
        </nav>
      )}

      {/* Форма редактирования */}
      {selectedPageKey && selectedSectionKey ? (
        <div>
          <h2
            style={{
              borderBottom: "1px dashed #ccc",
              paddingBottom: "5px",
              marginBottom: "15px",
            }}
          >
            Edit Section:{" "}
            <span style={{ color: "green" }}>
              {generateLabel(selectedSectionKey)}
            </span>{" "}
            (Page:{" "}
            <span style={{ color: "blue" }}>
              {generateLabel(String(selectedPageKey))}
            </span>
            )
          </h2>
          <form
            ref={formRef}
            onSubmit={handleSubmit}
            encType="multipart/form-data"
          >
            {/* Динамический рендеринг полей */}
            {renderFormFields()}
            <hr style={{ margin: "25px 0" }} />
            {/* Кнопка сохранения и Сообщения */}
            <div>
              <button
                type="submit"
                disabled={isSaving || isLoading || !currentFormData} // Нельзя сохранять, пока грузится или не выбрана секция
                style={{
                  padding: "10px 20px",
                  fontSize: "16px",
                  background: "#4CAF50",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                  opacity: isSaving || isLoading || !currentFormData ? 0.5 : 1,
                }}
              >
                {isSaving ? "Saving..." : `Save Changes & Revalidate`}
              </button>
              {/* Сообщения статуса и ошибок */}
              {statusMessage && !error && (
                <p style={{ color: "green", marginTop: "10px" }}>
                  {statusMessage}
                </p>
              )}
              {error && (
                <p
                  style={{
                    color: "red",
                    marginTop: "10px",
                    fontWeight: "bold",
                  }}
                >
                  Error: {error}
                </p>
              )}
            </div>
          </form>
        </div>
      ) : (
        // Сообщение, если не выбрана секция или страница
        <p style={{ marginTop: "20px", fontStyle: "italic" }}>
          {isLoading
            ? "Loading..."
            : selectedPageKey
            ? "Select a section from the list above to start editing."
            : "Select a page from the list above to begin."}
        </p>
      )}
      <hr style={{ marginTop: "40px", borderColor: "#aaa" }} />
    </div>
  );
}
