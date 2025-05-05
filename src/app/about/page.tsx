// src/app/page.tsx
import Image from "next/image";
import { prepareImageData } from "@/lib/image-utils"; // Импортируем новую утилиту
import { getContent } from "@/lib/fs-utils";

export default async function AboutPage() {
  const content = await getContent();
  const about = content.about;

  

  return (
    <div>
      <h1>{about.section1.title}</h1>
      <p>{about.section1.description1}</p>

      {/* Используем результат работы утилиты */}
      {/* Рендерим Image только если файл существует (imageData.exists === true) */}
      {/* и URL не null (imageData.url) */}
      {about.section1.image1 && (
        <Image
          src={about.section1.image1}
          alt={"image"}
          width={300}
          height={300}
          // Можно добавить priority={true}, если это LCP элемент
        />
      )}

      {about.section1.image2 && (
        <Image
          src={about.section1.image2}
          alt={"image"}
          width={300}
          height={300}
          // Можно добавить priority={true}, если это LCP элемент
        />
      )}
    </div>
  );
}
