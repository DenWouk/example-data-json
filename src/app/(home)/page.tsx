import Image from "next/image";
import { getHomeContent } from "@/lib/data";

export default async function Home() {
  const content = await getHomeContent();

  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">
      <div className="z-10 max-w-5xl w-full items-center justify-between font-mono text-sm">
        {content.title && (
          <h1 className="text-4xl font-bold mb-4">{content.title}</h1>
        )}

        {content.description && (
          <p className="text-xl mb-6">{content.description}</p>
        )}

        {content.image && (
          <div className="mb-6">
            <Image
              src={content.image || "/placeholder.svg"}
              alt={'image'}
              width={300}
              height={300}
              className="rounded-lg object-cover"
            />
          </div>
        )}
      </div>
    </main>
  );
}
