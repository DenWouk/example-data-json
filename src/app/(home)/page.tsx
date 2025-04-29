// src/app/page.tsx
import Image from "next/image";
import { getContent } from "@/lib/content";
import { prepareImageData } from "@/lib/imageUtils"; // Импортируем новую утилиту

export default async function HomePage() {
  const content = await getContent();
  const homeContent = content.home;

  // Используем новую утилиту для получения данных изображения
  // Передаем путь к файлу и ключ 'home' для контекста логов
  const imageData = await prepareImageData(homeContent.image, "home");

  return (
    <div>
      <h1>{homeContent.title}</h1>
      <p>{homeContent.description}</p>

      {/* Используем результат работы утилиты */}
      {/* Рендерим Image только если файл существует (imageData.exists === true) */}
      {/* и URL не null (imageData.url) */}
      {imageData.exists && imageData.url && (
        <Image
          src={imageData.url}
          alt={homeContent.title}
          width={300}
          height={300}
          // Можно добавить priority={true}, если это LCP элемент
        />
      )}
    </div>
  );
}
