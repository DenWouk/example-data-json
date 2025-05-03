// src/app/(home)/page.tsx
import Image from "next/image";
import { prepareImageData } from "@/lib/image-utils";
import { getContent } from "@/lib/fs-utils";
import { SpecificAppContent } from "@/types/types";

export default async function HomePage() {
  const content = await getContent(); // getContent уже возвращает нормализованный AppContent или {}
  const homeContent = content.home ?? {}; // Используем ?? {} для безопасности
  const section1 = homeContent.section1 ?? {}; // Используем ?? {} для безопасности
  const section2 = homeContent.section2 ?? {}; // Используем ?? {} для безопасности


  // console.log(content); // Убрали отладочный лог

  // Асинхронно готовим данные для всех изображений
  // Передаем путь (который может быть undefined если секции нет) и ключ контента
  const [imageDataS1I1, imageDataS1I2, imageDataS2I1] = await Promise.all([
    prepareImageData(section1.image1, "home.section1.image1"),
    prepareImageData(section1.image2, "home.section1.image2"),
    prepareImageData(section2.image1, "home.section2.image1"),
  ]);

  return (
    <>
      {/* <h1>{currentContent.home.section1.title}</h1> */}
      <p>{section1.description1}</p>

      {imageDataS1I1.url && (
        <Image
          src={imageDataS1I1.url}
          alt={section1.title || "Section 1 Image 1"} // Более осмысленный alt
          width={300}
          height={300}
          style={{ objectFit: "cover", margin: "5px" }} // Добавим стиль
          // priority={true} // Раскомментировать, если это основной контент (LCP)
        />
      )}
      {!imageDataS1I1.url && section1.image1 && !imageDataS1I1.exists && (
        <p style={{ color: "red" }}>Missing image: {section1.image1}</p> // Показать, если файл указан, но не найден
      )}
      {imageDataS1I2.url && (
        <Image
          src={imageDataS1I2.url}
          alt={section1.title || "Section 1 Image 2"}
          width={300}
          height={300}
          style={{ objectFit: "cover", margin: "5px" }}
        />
      )}
      {!imageDataS1I2.url && section1.image2 && !imageDataS1I2.exists && (
        <p style={{ color: "red" }}>Missing image: {section1.image2}</p>
      )}
      <hr style={{ margin: "20px 0" }} />
      {/* Section 2 */}
      {section2.title && <h1>{section2.title}</h1>}
      {section2.description1 && <p>{section2.description1}</p>}
      {imageDataS2I1.url && (
        <Image
          src={imageDataS2I1.url}
          alt={section2.title || "Section 2 Image 1"}
          width={300}
          height={300}
          style={{ objectFit: "cover", margin: "5px" }}
        />
      )}
      {!imageDataS2I1.url && section2.image1 && !imageDataS2I1.exists && (
        <p style={{ color: "red" }}>Missing image: {section2.image1}</p>
      )}
    </>
  );
}
