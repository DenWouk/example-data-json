'use client';

import { useState, useEffect } from 'react';

export default function ContentEditor() {
  const [content, setContent] = useState({});

  useEffect(() => {
    // Загрузка контента при монтировании компонента (на клиенте)
    const loadContent = async () => {
      try {
        const response = await fetch('/api/get-content'); // Создайте API route для получения контента
        const data = await response.json();
        setContent(data);
      } catch (error) {
        console.error('Ошибка при загрузке контента:', error);
      }
    };

    loadContent();
  }, []);

  const handleChange = (event: any) => {
    const { name, value } = event.target;
    const [section, field] = name.split('.');

    setContent((prevContent: any) => ({
      ...prevContent,
      [section]: {
        ...prevContent[section],
        [field]: value,
      },
    }));
  };

  const handleSubmit = async (event: any) => {
    event.preventDefault();

    try {
      const response = await fetch('/api/update-content', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(content),
      });

      if (response.ok) {
        alert('Контент успешно обновлен!');
        // TODO:  Можно добавить уведомление об успехе и, возможно,
        // выполнить revalidatePath('/') для обновления главной страницы.
      } else {
        alert('Ошибка при обновлении контента.');
      }
    } catch (error) {
      console.error('Ошибка при отправке данных:', error);
      alert('Ошибка при отправке данных.');
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {Object.entries(content).map(([section, sectionContent]: [string, any]) => (
        <div key={section}>
          <h3>{section}</h3>
          {Object.entries(sectionContent).map(([field, value]: [string, any]) => (
            <div key={field}>
              <label htmlFor={`${section}.${field}`}>{field}:</label>
              <input
                type="text"
                id={`${section}.${field}`}
                name={`${section}.${field}`}
                value={value || ''}
                onChange={handleChange}
              />
            </div>
          ))}
        </div>
      ))}
      <button type="submit">Сохранить изменения</button>
    </form>
  );
}