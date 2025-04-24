// src/app/api/upload/route.ts

import { NextRequest, NextResponse } from "next/server";
import { writeFile } from "fs/promises";
import path from "path";

export async function POST(request: NextRequest) {
  try {
    const data = await request.formData();
    const file: File | null = data.get("file") as unknown as File;

    if (!file) {
      return NextResponse.json(
        { success: false, message: "No file uploaded" },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Путь для сохранения файла (относительно папки public/images)
    const filename = Date.now() + file.name.replace(/ /g, "_");
    const imagePath = path.join(process.cwd(), "public/images", filename);

    await writeFile(imagePath, buffer);

    // Возвращаем URL изображения
    const imageUrl = `/images/${filename}`;

    return NextResponse.json({ success: true, imageUrl }, { status: 200 });
  } catch (error) {
    console.error("Error uploading file:", error);
    return NextResponse.json(
      { success: false, message: "Failed to upload file" },
      { status: 500 }
    );
  }
}

export const config = {
  api: {
    bodyParser: false,
  },
};
