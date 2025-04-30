// src/app/page.tsx
import Image from "next/image";
import { getContent } from "@/lib/content";
import { prepareImageData } from "@/lib/imageUtils"; // Импортируем новую утилиту

export default async function HomePage() {
  const content = await getContent();
  const homeContent = content.home;
  const section1 = homeContent.section1;
  const section2 = homeContent.section2;

  // Используем новую утилиту для получения данных изображения
  // Передаем путь к файлу и ключ 'home' для контекста логов
  const imageData = await prepareImageData(section1.image1, "home1");
  const imageData1 = await prepareImageData(section1.image2, "home1");
  const imageData2 = await prepareImageData(section2.image1, "home2");

  return (
    <>
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
        {imageData1.exists && imageData1.url && (
          <Image
            src={imageData1.url}
            alt={"image"}
            width={300}
            height={300}
            // Можно добавить priority={true}, если это LCP элемент
          />
        )}
      </div>

      <div>
        <h1>{section2.title}</h1>
        <p>{section2.description1}</p>

        {/* Используем результат работы утилиты */}
        {/* Рендерим Image только если файл существует (imageData.exists === true) */}
        {/* и URL не null (imageData.url) */}
        {imageData2.exists && imageData2.url && (
          <Image
            src={imageData2.url}
            alt={"image"}
            width={300}
            height={300}
            // Можно добавить priority={true}, если это LCP элемент
          />
        )}
      </div>
    </>
  );
}
