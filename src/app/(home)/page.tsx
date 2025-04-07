import { getContent } from "@/lib/content";
import "./home.css";

export default async function Home() {
  const content = await getContent();
  const homeContent = content?.home || {};

  return (
    <div>
      <h1>{homeContent.title}</h1>
      <p>{homeContent.description}</p>
    </div>
  );
}

// Пример использования revalidate
export const revalidate = 60; // Перепроверка каждые 60 секунд
