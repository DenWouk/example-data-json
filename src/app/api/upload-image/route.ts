import { NextResponse } from "next/server";
import { writeFile } from "fs/promises";
import path from "path";

export async function POST(request: Request) {
  const data = await request.formData();
  const image = data.get("image") as File | null;

  if (!image) {
    return NextResponse.json(
      { success: false, message: "Малюнак не знойдзены" },
      { status: 400 }
    );
  }

  const bytes = await image.arrayBuffer();
  const buffer = Buffer.from(bytes);

  const imageName = Date.now() + "-" + image.name; // Больш бяспечная назва
  const imagePath = path.join(process.cwd(), "public/", imageName);

  try {
    await writeFile(imagePath, buffer);
    const imageUrl = `/${imageName}`;
    return NextResponse.json({ success: true, imageUrl });
  } catch (error) {
    console.error("Памылка пры захаванні файла:", error);
    return NextResponse.json(
      { success: false, message: "Памылка пры захаванні файла" },
      { status: 500 }
    );
  }
}
