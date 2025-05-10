// src/app/page.tsx
import Image from "next/image";
import { getContent } from "@/lib/fs-utils";

export default async function AboutPage() {
  const content = await getContent();
  const about = content.about;

  return (
    <div>
      <h1>{about.section1.title}</h1>
      <p>{about.section1.description1}</p>

      {about.section1.image1 && (
        <Image
          src={about.section1.image1}
          alt={"image"}
          width={300}
          height={300}
        />
      )}

      {about.section1.image2 && (
        <Image
          src={about.section1.image2}
          alt={"image"}
          width={300}
          height={300}
        />
      )}
    </div>
  );
}
