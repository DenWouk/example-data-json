"use client";

import { useState, useEffect, ChangeEvent } from "react";
import { ContentData, ContentSection } from "@/types/content";
import ImageUploader from "./ImageUploader";

export default function ContentEditor() {
  const [content, setContent] = useState<ContentData>({});
  const [selectedSection, setSelectedSection] = useState<string | null>(null);

  useEffect(() => {
    const loadContent = async () => {
      try {
        const response = await fetch("/api/get-content");
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

    setContent((prevContent: ContentData) => {
      const updatedSection: ContentSection = {
        ...(prevContent[section] || {}),
        [field]: value,
      };

      return {
        ...prevContent,
        [section]: updatedSection,
      };
    });
  };

  const handleImageUpload = (section: string, imageUrl: string) => {
    setContent((prevContent: ContentData) => ({
      ...prevContent,
      [section]: {
        ...prevContent[section],
        image: imageUrl,
      },
    }));
    setSelectedSection(null);
  };

  const handleSubmit = async (event: React.FormEvent) => {
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
          <button type="button" onClick={() => setSelectedSection(section)}>
            Змяніць малюнак
          </button>
          {selectedSection === section && (
            <ImageUploader
              section={section}
              onImageUpload={handleImageUpload}
              onClose={() => setSelectedSection(null)}
            />
          )}
        </div>
      ))}
      <button type="submit">Захаваць змены</button>
    </form>
  );
}
