"use client";

import { useState, useEffect, ChangeEvent, FormEvent } from "react";
import { ContentData, ContentSection } from "@/types/content";

export default function ContentEditor() {
  const [content, setContent] = useState<ContentData>({});

  useEffect(() => {
    // Загрузка контента при монтировании компонента (на клиенте)
    const loadContent = async () => {
      try {
        const response = await fetch("/api/get-content"); // Создайте API route для получения контента
        const data: ContentData = await response.json();
        setContent(data);
      } catch (error) {
        console.error("Ошибка при загрузке контента:", error);
      }
    };

    loadContent();
  }, []);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    const [section, field] = name.split(".");

    setContent((prevContent: ContentData) => ({
      ...prevContent,
      [section]: {
        ...prevContent[section],
        [field]: value,
      },
    }));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    try {
      const response = await fetch("/api/update-content", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(content),
      });

      if (response.ok) {
        alert("Контент успешно обновлен!");
        // TODO:  Можно добавить уведомление об успехе и, возможно,
        // выполнить revalidatePath('/') для обновления главной страницы.
      } else {
        alert("Ошибка при обновлении контента.");
      }
    } catch (error) {
      console.error("Ошибка при отправке данных:", error);
      alert("Ошибка при отправке данных.");
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {Object.entries(content).map(([section, sectionContent]) => (
        <div key={section}>
          <h3>{section}</h3>
          {Object.entries(sectionContent as ContentSection).map(
            ([field, value]) => (
              <div key={field}>
                <label htmlFor={`${section}.${field}`}>{field}:</label>
                <input
                  type="text"
                  id={`${section}.${field}`}
                  name={`${section}.${field}`}
                  value={(value as string) || ""}
                  onChange={handleChange}
                />
              </div>
            )
          )}
        </div>
      ))}
      <button type="submit">Сохранить изменения</button>
    </form>
  );
}
