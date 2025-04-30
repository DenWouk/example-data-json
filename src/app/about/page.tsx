// src/app/page.tsx
import Image from "next/image";
import { getContent } from "@/lib/content";
import { prepareImageData } from "@/lib/imageUtils"; // Импортируем новую утилиту

export default async function AboutPage() {
  const content = await getContent();
  const aboutContent = content.about;
  const section1 = aboutContent.section1;

  // Используем новую утилиту для получения данных изображения
  // Передаем путь к файлу и ключ 'home' для контекста логов
  const imageData = await prepareImageData(section1.image1, "about");

  return (
    <div>
      <h1>{section1.title}</h1>
      <p>{section1.description1}</p>

      {/* Используем результат работы утилиты */}
      {/* Рендерим Image только если файл существует (imageData.exists === true) */}
      {/* и URL не null (imageData.url) */}
      {imageData.exists && imageData.url && (
        <Image
          src={imageData.url}
          alt={"image"}
          width={300}
          height={300}
          // Можно добавить priority={true}, если это LCP элемент
        />
      )}
    </div>
  );
}
