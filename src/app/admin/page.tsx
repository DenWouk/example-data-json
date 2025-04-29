// src/app/admin/page.tsx
"use client";

import { useState, useEffect, FormEvent, useRef } from "react"; // Добавили useRef
import { getAdminContent, updateAdminContent } from "./actions";
import { PageContent } from "@/lib/content";

const initialFormState: PageContent = {
  title: "",
  description: "",
  image: null, // Используем null по умолчанию
};

export default function AdminPage() {
  const [formData, setFormData] = useState<PageContent>(initialFormState);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null); // Реф для сброса поля файла

  // Загрузка данных при монтировании компонента (без изменений)
  useEffect(() => {
    async function loadContent() {
      setIsLoading(true);
      setError(null);
      try {
        const content = await getAdminContent();
        if (content.home) {
          setFormData(content.home);
        } else {
          setFormData(initialFormState);
          console.warn("No 'home' content found for admin form.");
        }
      } catch (err) {
        console.error("Failed to load content for admin:", err);
        setError("Failed to load content. Please try refreshing.");
      } finally {
        setIsLoading(false);
      }
    }
    loadContent();
  }, []);

  // Обработчик изменений текстовых полей (без изменений)
  const handleTextChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prevData) => ({
      ...prevData,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formElement = e.currentTarget; // <--- Получаем ссылку на форму ЗДЕСЬ
    setIsSaving(true);
    setStatusMessage('');
    setError(null);

    // Создаем FormData из сохраненной ссылки
    const currentFormData = new FormData(formElement);

    try {
        // Вызываем Server Action, передавая FormData и ключ страницы
        const result = await updateAdminContent('home', currentFormData); // <--- await здесь

        if (result.success) {
            setStatusMessage(result.message);
            if (result.updatedContent) {
                setFormData(result.updatedContent);
            }
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
             // Сбрасываем чекбокс удаления, используя сохраненную ссылку
             const removeCheckbox = formElement.elements.namedItem('removeImage') as HTMLInputElement; // <--- Используем formElement
             if (removeCheckbox) {
                removeCheckbox.checked = false;
             }

        } else {
            setError(result.message);
        }
    } catch (err: any) {
        console.error('Failed to submit form:', err);
        // Важно: Не пытаемся получить доступ к e.currentTarget здесь
        setError(`An unexpected error occurred: ${err.message}`);
    } finally {
        setIsSaving(false);
    }
};

  if (isLoading) {
    return <div>Loading content editor...</div>;
  }

  if (error && !isSaving) {
    return <div>Error: {error}</div>;
  }

  return (
    <div>
      <h1>Edit Home Page Content</h1>
      {/* Добавляем enctype для загрузки файлов */}
      <form onSubmit={handleSubmit} encType="multipart/form-data">
        {/* Скрытое поле для передачи текущего имени файла */}
        <input type="hidden" name="currentImage" value={formData.image ?? ""} />

        <div>
          <label htmlFor="title">Title:</label>
          <br />
          <input
            type="text"
            id="title"
            name="title"
            value={formData.title}
            onChange={handleTextChange} // Используем старый обработчик для текста
            required
            style={{ width: "300px" }}
          />
        </div>
        <br />
        <div>
          <label htmlFor="description">Description:</label>
          <br />
          <textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleTextChange} // Используем старый обработчик для текста
            rows={5}
            required
            style={{ width: "300px" }}
          />
        </div>
        <br />

        {/* --- Секция Изображения --- */}
        <div>
          <label htmlFor="imageFile">Upload New Image (Optional):</label>
          <br />
          {/* Отображение текущего имени файла */}
          {formData.image && (
            <p>
              Current image: <strong>{formData.image}</strong>
              {/* Опционально: Показ превью, если файл существует */}
              <br />
              {/* <Image src={`/api/media/${formData.image}`} width={100} height={100} alt="Current preview" /> */}
            </p>
          )}
          {!formData.image && <p>No image currently set.</p>}

          <input
            type="file"
            id="imageFile"
            name="imageFile" // Имя поля для Server Action
            accept="image/png, image/jpeg, image/webp, image/gif" // Ограничение типов на клиенте
            ref={fileInputRef} // Добавляем реф для сброса
            onChange={() => {
              // Опционально: сбросить сообщение об ошибке/статусе при выборе файла
              setError(null);
              setStatusMessage("");
            }}
          />
          <small>Max 5MB. Allowed types: JPG, PNG, WEBP, GIF.</small>
        </div>
        <br />

        {/* Чекбокс для удаления текущего изображения */}
        {formData.image && ( // Показываем только если есть текущее изображение
          <div>
            <label>
              <input type="checkbox" name="removeImage" />
              Remove Current Image
            </label>
            <small>
              {" "}
              (Will be removed on update if checked and no new image is
              uploaded)
            </small>
          </div>
        )}
        <br />
        {/* --- Конец Секции Изображения --- */}

        <button type="submit" disabled={isSaving || isLoading}>
          {isSaving ? "Saving..." : "Update Content & Revalidate Cache"}
        </button>
      </form>

      {statusMessage && <p style={{ color: "green" }}>{statusMessage}</p>}
      {error && <p style={{ color: "red" }}>Error: {error}</p>}

      <hr />
      <p>
        <strong>Note:</strong> Uploading a new image will replace the current
        one. Check 'Remove' to delete the image without uploading a new one.
      </p>
    </div>
  );
}
