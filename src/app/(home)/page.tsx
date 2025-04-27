// src/app/page.tsx
import Image from "next/image";
import { getContent } from "@/lib/content";
import { checkMediaFileExists } from "@/lib/fsUtils";

// Эта страница будет рендериться на сервере и кэшироваться
// Revalidate будет управляться из админки
export default async function HomePage() {
  const content = await getContent();
  const homeContent = content.home;

  // Проверяем, существует ли файл изображения на сервере
  const imagePath = homeContent.image;
  const imageExists = await checkMediaFileExists(imagePath);

  // Формируем URL для Next.js Image
  // Он будет указывать на наш API роут
  const imageUrl = imagePath ? `/api/media/${imagePath}` : null;

  if (imagePath && !imageExists) {
    console.warn(
      `Image file specified in content.json (${imagePath}) does not exist in the media folder.`
    );
  }

  return (
    <div>
      <h1>{homeContent.title}</h1>
      <p>{homeContent.description}</p>

      {/* Отображаем изображение только если путь есть в JSON и файл существует */}
      {imageUrl && imageExists && (
        <Image
          src={imageUrl}
          alt={homeContent.title} // Хорошая практика использовать осмысленный alt
          width={300}
          height={300}
          // Можно добавить priority={true}, если это LCP элемент
        />
      )}
      {/* Можно добавить сообщение, если изображение не найдено */}
      {/* {imagePath && !imageExists && (
                <p style={{ color: 'orange' }}>Image configured but not found.</p>
             )} */}
    </div>
  );
}

// Можно добавить настройку ревалидации, но мы будем делать это вручную
// export const revalidate = 3600; // Например, ревалидация раз в час (если не вызвано вручную)
// Но для нашей задачи ручной ревалидации это не нужно.
