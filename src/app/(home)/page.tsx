//src/app/(home)/page.tsx

import Image from "next/image";
import { getContent } from "@/lib/fs-utils";

export default async function HomePage() {
  const content = await getContent();
  const section1 = content.home.section1;
  const section2 = content.home.section2;

  return (
    <div>
      <h1>Home Page</h1>

      <h2>{section1.title}</h2>
      <p>{section1.description1}</p>
      <div style={{ display: "flex", flexWrap: "wrap" }}>
        {section1.image1 && (
          <Image
            src={section1.image1}
            alt={section1.title || "Section 1 Image 1"}
            width={300}
            height={300}
            style={{ objectFit: "cover", margin: "5px" }}
            priority
          />
        )}
        {section1.image2 && (
          <Image
            src={section1.image2}
            alt={section1.title || "Section 1 Image 2"}
            width={300}
            height={300}
            style={{ objectFit: "cover", margin: "5px" }}
          />
        )}
        {section1.image3 && (
          <Image
            src={section1.image3}
            alt={section1.title || "Section 1 Image 3"}
            width={300}
            height={300}
            style={{ objectFit: "cover", margin: "5px" }}
          />
        )}
      </div>

      <h2>{section2.title}</h2>
      <p>{section2.description1}</p>

      <div style={{ display: "flex", flexWrap: "wrap" }}>
        {section2.image1 && (
          <Image
            src={section2.image1}
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
