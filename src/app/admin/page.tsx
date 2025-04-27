// src/app/admin/page.tsx
"use client"; // Это клиентский компонент

import { useState, useEffect, FormEvent } from "react";
import { getAdminContent, updateAdminContent } from "./actions"; // Импорт Server Actions
import { PageContent } from "@/lib/content"; // Импорт интерфейса

// Начальное состояние для формы
const initialFormState: PageContent = {
  title: "",
  description: "",
  image: "",
};

export default function AdminPage() {
  const [formData, setFormData] = useState<PageContent>(initialFormState);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  // Загрузка данных при монтировании компонента
  useEffect(() => {
    async function loadContent() {
      setIsLoading(true);
      setError(null);
      try {
        const content = await getAdminContent();
        // Устанавливаем данные для 'home' страницы в форму
        if (content.home) {
          setFormData(content.home);
        } else {
          // Если данных для home нет, устанавливаем пустые или значения по умолчанию
          setFormData(initialFormState);
          console.warn(
            "No 'home' content found in content.json for admin form."
          );
        }
      } catch (err) {
        console.error("Failed to load content for admin:", err);
        setError("Failed to load content. Please try refreshing.");
      } finally {
        setIsLoading(false);
      }
    }
    loadContent();
  }, []); // Пустой массив зависимостей = запуск только один раз при монтировании

  // Обработчик изменений в полях формы
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prevData) => ({
      ...prevData,
      [name]: value,
    }));
  };

  // Обработчик отправки формы
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault(); // Предотвращаем стандартную отправку формы
    setIsSaving(true);
    setStatusMessage("");
    setError(null);

    try {
      // Вызываем Server Action для обновления контента 'home'
      const result = await updateAdminContent("home", formData);

      if (result.success) {
        setStatusMessage(result.message);
        // Можно перезагрузить данные формы после успешного сохранения,
        // но обычно это не требуется, т.к. данные уже актуальны
        // const updatedContent = await getAdminContent();
        // setFormData(updatedContent.home);
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

  if (isLoading) {
    return <div>Loading content editor...</div>;
  }

  if (error && !isSaving) {
    // Показываем ошибку загрузки, если не идет сохранение
    return <div>Error: {error}</div>;
  }

  return (
    <div>
      <h1>Edit Home Page Content</h1>
      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="title">Title:</label>
          <br />
          <input
            type="text"
            id="title"
            name="title"
            value={formData.title}
            onChange={handleChange}
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
            onChange={handleChange}
            rows={5}
            required
            style={{ width: "300px" }}
          />
        </div>
        <br />
        <div>
          <label htmlFor="image">Image Filename:</label>
          <br />
          <input
            type="text"
            id="image"
            name="image"
            value={formData.image ?? ""} // Используем ?? '' для случая null/undefined
            onChange={handleChange}
            placeholder="e.g., my-image.jpg (must be in /media folder)"
            style={{ width: "300px" }}
          />
          <small>
            {" "}
            Enter filename only. Upload image to the '/media' folder manually
            for now.
          </small>
        </div>
        <br />
        <button type="submit" disabled={isSaving}>
          {isSaving ? "Saving..." : "Update Content & Revalidate Cache"}
        </button>
      </form>
      {/* Сообщения о статусе */}
      {statusMessage && <p style={{ color: "green" }}>{statusMessage}</p>}
      {error && isSaving && <p style={{ color: "red" }}>Error: {error}</p>}{" "}
      {/* Показываем ошибку сохранения */}
      <hr />
      <p>
        <strong>Note:</strong> Currently, you need to manually upload image
        files to the <code>media</code> folder on the server.
      </p>
    </div>
  );
}
