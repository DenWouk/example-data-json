// src/app/admin/page.tsx
"use client";

import {
  useState,
  useEffect,
  FormEvent,
  useRef,
  ChangeEvent,
  useCallback,
} from "react";
import Image from "next/image"; // Нужен для превью
import { AppContent, PageKey, SectionContent } from "../../types/types";
import { getAdminContent, updateSectionContent } from "./actions";
import {
  generateLabel,
  isImageField,
  inferInputElement,
  createEmptySectionContent,
} from "@/lib/content-utils";
// Импорт prepareImageData НЕ нужен на клиенте
// import { prepareImageData } from '@/lib/imageUtils';

// Тип для данных формы - всегда SectionContent или null
type CurrentFormDataType = SectionContent | null;

export default function AdminPage() {
  // === Состояния ===
  const [appContent, setAppContent] = useState<AppContent | null>(null); // Весь контент
  const [pageKeys, setPageKeys] = useState<PageKey[]>([]); // Ключи страниц для навигации
  const [selectedPageKey, setSelectedPageKey] = useState<PageKey | null>(null); // Выбранная страница
  const [sectionKeys, setSectionKeys] = useState<string[]>([]); // Ключи секций для навигации
  const [selectedSectionKey, setSelectedSectionKey] = useState<string | null>(
    null
  ); // Выбранная секция
  const [currentFormData, setCurrentFormData] =
    useState<CurrentFormDataType>(null); // Данные ТЕКУЩЕЙ секции для формы
  const [localImagePreviews, setLocalImagePreviews] = useState<{
    [key: string]: string | null;
  }>({}); // Для превью ВЫБРАННЫХ файлов
  const [uploadingImageField, setUploadingImageField] = useState<string | null>(
    null
  ); // Какой image-* файл выбран для загрузки

  // Состояния UI
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  // Рефы
  const fileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({}); // Рефы для ВСЕХ input[type=file]
  const formRef = useRef<HTMLFormElement>(null);

  // === Эффекты ===

  // 1. Загрузка начальных данных всего контента
  useEffect(() => {
    async function loadInitialContent() {
      setIsLoading(true);
      setError(null); // Сброс состояний
      setAppContent(null);
      setPageKeys([]);
      setSelectedPageKey(null);
      setSectionKeys([]);
      setSelectedSectionKey(null);
      setCurrentFormData(null);
      setLocalImagePreviews({});
      setUploadingImageField(null); // Сброс превью

      try {
        const fetchedContent = await getAdminContent(); // Получаем контент (уже нормализованный)
        setAppContent(fetchedContent);
        const keys = Object.keys(fetchedContent || {}) as PageKey[];
        setPageKeys(keys);
        if (keys.length > 0) {
          setSelectedPageKey(keys[0]); // Выбираем первую страницу
        } else {
          console.warn("No pages found in content.");
          setIsLoading(false); // Завершаем загрузку, если страниц нет
        }
      } catch (err: any) {
        console.error("Failed to load content for admin:", err);
        setError(`Failed to load content: ${err.message || "Unknown error"}`);
        setIsLoading(false); // Завершаем загрузку при ошибке
      }
      // setIsLoading(false) будет вызван после установки selectedPageKey -> sectionKey -> currentFormData
    }
    loadInitialContent();
  }, []); // Только при монтировании

  // 2. Обновление списка секций при смене страницы
  useEffect(() => {
    let keys: string[] = [];
    if (selectedPageKey && appContent) {
      keys = Object.keys(appContent[selectedPageKey] || {});
    }
    setSectionKeys(keys);
    setSelectedSectionKey(keys.length > 0 ? keys[0] : null); // Выбираем первую секцию или null
    // Очищаем данные формы и превью при смене страницы, они загрузятся следующим эффектом
    setCurrentFormData(null);
    setLocalImagePreviews({});
    setUploadingImageField(null);
    setStatusMessage("");
    setError(null);
  }, [selectedPageKey, appContent]);

  // 3. Обновление данных формы при смене секции (или страницы)
  useEffect(() => {
    let sectionData: SectionContent | null = null;
    if (appContent && selectedPageKey && selectedSectionKey) {
      sectionData = appContent[selectedPageKey]?.[selectedSectionKey] ?? null;
    }
    // Устанавливаем данные ТЕКУЩЕЙ секции или пустой объект, если секции нет, но ключ выбран
    setCurrentFormData(
      sectionData ?? (selectedSectionKey ? createEmptySectionContent() : null)
    );
    setLocalImagePreviews({}); // Всегда сбрасываем локальные превью при смене секции
    setUploadingImageField(null);

    // Завершаем общую загрузку здесь, после попытки установки данных формы
    if (isLoading && appContent !== null) setIsLoading(false); // Условие изменено на appContent !== null
    setStatusMessage("");
    setError(null); // Сброс сообщений
  }, [selectedSectionKey, selectedPageKey, appContent, isLoading]);

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

  // Универсальный обработчик для обновления ЛЮБОГО поля в currentFormData
  const handleInputChange = useCallback((key: string, value: string) => {
    // value всегда string
    setCurrentFormData((prevData) => {
      // Создаем пустой объект, если предыдущего состояния нет, но ключи есть
      const baseData =
        prevData ?? createEmptySectionContent(Object.keys(prevData ?? {}));
      return { ...baseData, [key]: value };
    });
    // Сбрасываем локальное превью для image полей, если значение очищено
    if (isImageField(key) && value === "") {
      setLocalImagePreviews((prev) => ({ ...prev, [key]: null }));
    }
  }, []);

  // Конкретный обработчик для textarea
  const handleTextareaChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    handleInputChange(e.target.name, e.target.value);
  };

  // Обработчик выбора файла для КОНКРЕТНОГО поля image-*
  const handleFileChange = (
    fieldKey: string,
    e: ChangeEvent<HTMLInputElement>
  ) => {
    if (e.target.files && e.target.files[0]) {
      setUploadingImageField(fieldKey); // Запоминаем, ДЛЯ КАКОГО ПОЛЯ выбран файл
      setError(null);
      setStatusMessage("");
      const reader = new FileReader();
      reader.onload = (loadEvent) => {
        if (loadEvent.target?.result) {
          // Сохраняем локальное превью выбранного файла
          setLocalImagePreviews((prev) => ({
            ...prev,
            [fieldKey]: loadEvent.target?.result as string,
          }));
        }
      };
      reader.readAsDataURL(e.target.files[0]);
    } else {
      // Если пользователь отменил выбор файла
      setUploadingImageField(null);
      // Убираем локальное превью
      setLocalImagePreviews((prev) => ({ ...prev, [fieldKey]: null }));
    }
  };

  // Обработчик кнопки "Clear Image" для КОНКРЕТНОГО поля image-*
  const handleClearImage = (fieldKey: string) => {
    handleInputChange(fieldKey, ""); // Устанавливаем пустую строку в данных формы
    if (fileInputRefs.current[fieldKey]) {
      fileInputRefs.current[fieldKey]!.value = ""; // Сбрасываем сам инпут файла
    }
    setUploadingImageField(null); // Сбрасываем флаг загрузки для этого поля
    setLocalImagePreviews((prev) => ({ ...prev, [fieldKey]: null })); // Убираем локальное превью
  };

  // === Отправка формы ===
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // Добавлена проверка selectedPageKey и selectedSectionKey
    if (
      !formRef.current ||
      !currentFormData ||
      !selectedPageKey ||
      !selectedSectionKey
    ) {
      setError("Cannot save: missing page/section selection or form data.");
      return;
    }

    setIsSaving(true);
    setStatusMessage("");
    setError(null);
    const formDataToSend = new FormData();

    // 1. Добавляем ключи страницы и секции (приводим к строке)
    formDataToSend.append("pageKey", String(selectedPageKey));
    formDataToSend.append("sectionKey", String(selectedSectionKey));

    // 2. Ищем, был ли выбран файл для загрузки
    let imageFile: File | null = null;
    if (
      uploadingImageField &&
      fileInputRefs.current[uploadingImageField]?.files?.[0]
    ) {
      imageFile = fileInputRefs.current[uploadingImageField]!.files![0];
      formDataToSend.append("imageFile", imageFile);
      formDataToSend.append("imageFieldKey", uploadingImageField); // Ключ поля, к которому относится файл
      console.log(`Appending image file for field: ${uploadingImageField}`);
    }

    // 3. Сериализуем ТЕКУЩЕЕ состояние формы (currentFormData)
    // Убедимся, что все значения - строки перед отправкой
    const dataToSend: SectionContent = {};
    Object.keys(currentFormData).forEach((key) => {
      dataToSend[key] = currentFormData[key] ?? ""; // Гарантируем строку
    });

    try {
      formDataToSend.append("sectionDataJson", JSON.stringify(dataToSend));
    } catch (err) {
      setError("Failed to serialize form data.");
      setIsSaving(false);
      return;
    }

    try {
      // Вызываем action с АКТУАЛЬНЫМИ selectedPageKey и selectedSectionKey
      const result = await updateSectionContent(
        selectedPageKey,
        selectedSectionKey,
        formDataToSend
      );

      if (result.success) {
        setStatusMessage(result.message);
        // Обновляем ВСЕ состояния из ответа сервера
        if (result.updatedSection && appContent) {
          const updatedSectionData = result.updatedSection;
          // Обновляем общее состояние контента
          setAppContent((prev) => ({
            ...prev!,
            [selectedPageKey!]: {
              ...(prev![selectedPageKey!] || {}),
              [selectedSectionKey!]: updatedSectionData,
            },
          }));
          // Обновляем текущую форму данными с сервера
          setCurrentFormData(updatedSectionData);
          // Сброс состояния загрузки файла
          if (
            uploadingImageField &&
            fileInputRefs.current[uploadingImageField]
          ) {
            fileInputRefs.current[uploadingImageField]!.value = "";
          }
          setUploadingImageField(null);
          // Локальные превью очистятся при следующем ререндере из-за обновления currentFormData
          setLocalImagePreviews({}); // Очищаем локальные превью явно
        }
      } else {
        setError(result.message);
      }
    } catch (err: any) {
      console.error("Failed to submit form:", err);
      setError(`An unexpected error occurred: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  // === Динамический рендеринг полей ===
  const renderFormFields = () => {
    if (!currentFormData || !selectedPageKey || !selectedSectionKey) {
      return <p>Select a section to edit or wait for data to load...</p>;
    }

    const currentKeys = Object.keys(currentFormData);
    if (currentKeys.length === 0 && !isLoading) {
      // Добавили проверку isLoading
      return (
        <p>No fields found in this section. Add fields in content.json.</p>
      );
    }

    return currentKeys.map((key) => {
      const value = currentFormData[key]; // Это всегда строка
      const label = generateLabel(key);
      const inputType = inferInputElement(key); // 'file' или 'textarea'
      const elementKey = `${selectedPageKey}-${selectedSectionKey}-${key}`;
      const localPreviewUrl = localImagePreviews[key]; // Получаем локальное превью
      // Формируем URL для существующего изображения, только если нет локального превью
      const existingImageUrl =
        isImageField(key) && value && !localPreviewUrl
          ? `/api/media/${value}`
          : null;
      const displayUrl = localPreviewUrl || existingImageUrl; // Приоритет у локального превью

      if (inputType === "file") {
        // Рендеринг поля для загрузки изображения
        return (
          <div
            key={elementKey}
            style={{
              marginBottom: "15px",
              padding: "10px",
              border: "1px solid lightblue",
            }}
          >
            <label htmlFor={key} style={{ fontWeight: "bold" }}>
              {label}:
            </label>
            <br />
            {/* Показ превью */}
            {displayUrl ? (
              /* Используем стандартный img для локального превью (Data URL) и Next Image для серверного */
              localPreviewUrl ? (
                <img
                  src={displayUrl}
                  alt={`${label} preview`}
                  width="100"
                  height="100"
                  style={{
                    display: "block",
                    marginBottom: "5px",
                    objectFit: "contain",
                  }}
                />
              ) : (
                <Image
                  src={displayUrl}
                  alt={`${label} preview`}
                  width={100}
                  height={100}
                  style={{
                    display: "block",
                    marginBottom: "5px",
                    objectFit: "contain",
                  }}
                />
              )
            ) : value ? (
              <p>
                <small>Current file: {value} (preview unavailable)</small>
              </p>
            ) : (
              <p>
                <small>No image set.</small>
              </p>
            )}
            {/* Инпут файла */}
            <input
              type="file"
              id={key}
              name={key}
              accept="image/*"
              ref={(el) => {
                fileInputRefs.current[key] = el;
              }}
              onChange={(e) => handleFileChange(key, e)}
              style={{ display: "block", marginBottom: "5px" }}
            />
            {/* Кнопка очистки */}
            {value && ( // Показываем, только если есть значение (файл задан)
              <button
                type="button"
                onClick={() => handleClearImage(key)}
                disabled={isSaving}
                style={{ marginLeft: "5px" }}
              >
                Clear Image
              </button>
            )}
            <br />
            <small>Max 5MB.</small>
          </div>
        );
      } else {
        // Рендеринг textarea для всех остальных полей
        return (
          <div key={elementKey} style={{ marginBottom: "10px" }}>
            <label htmlFor={key}>{label}:</label>
            <br />
            <textarea
              id={key}
              name={key}
              value={value} // Значение уже строка
              onChange={handleTextareaChange}
              rows={key.toLowerCase().includes("description") ? 5 : 3} // Пример: больше строк для описаний
              style={{ width: "100%", maxWidth: "600px", minHeight: "60px" }}
            />
          </div>
        );
      }
    });
  };

  // === Рендеринг Компонента ===
  if (isLoading) return <div>Loading content editor...</div>;
  // Показываем ошибку загрузки только если она есть и загрузка завершена
  if (error && !isLoading && !isSaving)
    return <div>Error loading content: {error}</div>;
  // Если контент не загрузился (например, ошибка парсинга JSON на сервере)
  if (!appContent && !isLoading)
    return <div>Could not load application content data.</div>;

  return (
    <div>
      <h1>Admin Panel</h1>
      {/* Навигация по страницам */}
      <nav
        style={{
          marginBottom: "10px",
          paddingBottom: "5px",
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
                marginLeft: "5px",
                fontWeight: key === selectedPageKey ? "bold" : "normal",
                cursor:
                  key === selectedPageKey || isSaving ? "default" : "pointer",
              }}
            >
              {" "}
              {generateLabel(String(key))}{" "}
            </button>
          )) // Приводим к строке для generateLabel
        ) : (
          <span>No pages found. Add pages in content.json.</span>
        )}
      </nav>

      {/* Навигация по секциям */}
      {selectedPageKey && (
        <nav
          style={{
            marginBottom: "20px",
            paddingBottom: "10px",
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
                  marginLeft: "5px",
                  fontWeight: key === selectedSectionKey ? "bold" : "normal",
                  cursor:
                    key === selectedSectionKey || isSaving
                      ? "default"
                      : "pointer",
                }}
              >
                {" "}
                {generateLabel(key)}{" "}
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
      {selectedPageKey && selectedSectionKey ? ( // Показываем форму только если выбрана страница И секция
        <div>
          <h2>
            Edit '{generateLabel(selectedSectionKey)}' in '
            {generateLabel(String(selectedPageKey))}'
          </h2>
          <form
            ref={formRef}
            onSubmit={handleSubmit}
            encType="multipart/form-data"
          >
            {/* Динамический рендеринг полей */}
            {renderFormFields()}
            <br />
            <button
              type="submit"
              disabled={isSaving || isLoading || !currentFormData}
            >
              {isSaving ? "Saving..." : `Update Section & Revalidate Cache`}
            </button>
          </form>
          {/* Сообщения */}
          {statusMessage && <p style={{ color: "green" }}>{statusMessage}</p>}
          {/* Показываем ошибку сохранения */}
          {error && isSaving && (
            <p style={{ color: "red" }}>Error during save: {error}</p>
          )}
          {/* Показываем ошибку загрузки (если не isSaving) */}
          {error && !isSaving && <p style={{ color: "red" }}>Error: {error}</p>}
        </div>
      ) : (
        // Уточняем сообщение ожидания
        <p>
          {isLoading
            ? "Loading..."
            : selectedPageKey
            ? "Select a section to edit."
            : "Select a page to begin."}
        </p>
      )}
      <hr style={{ marginTop: "30px" }} />
    </div>
  );
}
