import { getContent } from "@/lib/content";
import Image from "next/image";

export default async function Home() {
  const content = await getContent();
  const homeContent = content?.home || {};

  return (
    <div>
      <h1>{homeContent.title}</h1>
      <p>{homeContent.description}</p>
      {homeContent.image && (
        <Image
          src={homeContent.image}
          alt={"Малюнак"}
          width={200}
          height={150}
        />
      )}
    </div>
  );
}

export const revalidate = 3600;
