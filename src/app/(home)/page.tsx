import Image from "next/image";
import { readContentData } from "@/lib/content-utils";

export default async function HomePage() {
  // Получаем данные из JSON файла на сервере
  const contentData = await readContentData();
  const { title, description, image } = contentData.home;

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-4">{title}</h1>
        <div className="relative w-full h-64 md:h-80 mb-6 rounded-lg overflow-hidden">
          <Image
            src={image || "/placeholder.svg"}
            alt={title}
            width={300}
            height={300}
            priority
            className="object-cover"
          />
        </div>
        <p className="text-lg">{description}</p>
      </div>
    </main>
  );
}
