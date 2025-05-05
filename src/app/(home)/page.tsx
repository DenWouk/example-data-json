// Пример для src/app/(home)/page.tsx

import { getContent } from "@/lib/fs-utils"; // Используем getContent
import Image from "next/image";

export default async function HomePage() {
  // Получаем контент, который УЖЕ содержит обработанные пути к картинкам
  const content = await getContent();
  const section1 = content.home.section1;
  const section2 = content.home.section2;

  // Больше НЕ НУЖНО вызывать prepareImageData
  // const [imageDataS1I1, imageDataS1I2, imageDataS2I1] = await Promise.all([
  //   prepareImageData(section1.image1, "home.section1.image1"),
  //   prepareImageData(section1.image2, "home.section1.image2"),
  //   prepareImageData(section2.image1, "home.section2.image1"),
  // ]);

  return (
    <div>
      <h1>Home Page</h1>

      {/* Секция 1 */}
      <h2>{section1.title}</h2>
      <p>{section1.description1}</p>
      <div style={{ display: "flex", flexWrap: "wrap" }}>
        {/* Используем путь напрямую */}
        {section1.image1 && ( // Проверяем, что путь не пустая строка
          <Image
            src={section1.image1} // <--- Прямое использование
            alt={section1.title || "Section 1 Image 1"}
            width={300}
            height={300}
            style={{ objectFit: "cover", margin: "5px" }}
            priority // Для LCP элемента, если это основное изображение
          />
        )}
        {section1.image2 && ( // Проверяем, что путь не пустая строка
          <Image
            src={section1.image2} // <--- Прямое использование
            alt={section1.title || "Section 1 Image 2"}
            width={300}
            height={300}
            style={{ objectFit: "cover", margin: "5px" }}
          />
        )}
        {section1.image3 && ( // Проверяем, что путь не пустая строка
          <Image
            src={section1.image3} // <--- Прямое использование
            alt={section1.title || "Section 1 Image 3"}
            width={300}
            height={300}
            style={{ objectFit: "cover", margin: "5px" }}
          />
        )}
      </div>

      {/* Секция 2 */}
      <h2>{section2.title}</h2>
      <p>{section2.description1}</p>
      <div style={{ display: "flex", flexWrap: "wrap" }}>
        {section2.image1 && ( // Проверяем, что путь не пустая строка
          <Image
            src={section2.image1} // <--- Прямое использование
            alt={section2.title || "Section 2 Image 1"}
            width={300}
            height={300}
            style={{ objectFit: "cover", margin: "5px" }}
          />
        )}
      </div>
    </div>
  );
}
