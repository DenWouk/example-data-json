//src/app/(home)/page.tsx

import Image from "next/image";
import { getContent } from "@/lib/fs-utils";

export default async function HomePage() {
  const content = await getContent();
  const home = content.home;

  return (
    <div>
      <h1>Home Page</h1>

      <h2>{home.section1.title}</h2>
      <p>{home.section1.description1}</p>
      <div style={{ display: "flex", flexWrap: "wrap" }}>
        {home.section1.image1 && (
          <Image
            src={home.section1.image1}
            alt={home.section1.title || "Section 1 Image 1"}
            width={300}
            height={300}
          />
        )}
        {home.section1.image2 && (
          <Image
            src={home.section1.image2}
            alt={home.section1.title || "Section 1 Image 2"}
            width={300}
            height={300}
          />
        )}
        {home.section1.image3 && (
          <Image
            src={home.section1.image3}
            alt={home.section1.title || "Section 1 Image 3"}
            width={300}
            height={300}
          />
        )}
      </div>

      <h2>{home.section2.title}</h2>
      <p>{home.section2.description1}</p>

      <div style={{ display: "flex", flexWrap: "wrap" }}>
        {home.section2.image1 && (
          <Image
            src={home.section2.image1}
            alt={home.section2.title || "Section 2 Image 1"}
            width={300}
            height={300}
          />
        )}
        {home.section2.image2 && (
          <Image
            src={home.section2.image2}
            alt={home.section2.title || "Section 2 Image 2"}
            width={300}
            height={300}
          />
        )}
      </div>
    </div>
  );
}
