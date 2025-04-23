import { type NextRequest, NextResponse } from "next/server";
import { writeFile } from "fs/promises";
import { join } from "path";
import { existsSync, mkdirSync } from "fs";
import { v4 as uuidv4 } from "uuid";
import path from "path";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const formData = await request.formData();
    const file = formData.get("image") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    // Validate file type
    const validTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!validTypes.includes(file.type)) {
      return NextResponse.json({ error: "Invalid file type" }, { status: 400 });
    }

    // Create directory if it doesn't exist
    const uploadDir = join(process.cwd(), "public/images");
    if (!existsSync(uploadDir)) {
      mkdirSync(uploadDir, { recursive: true });
    }

    // Generate unique filename
    const fileExtension = path.extname(file.name);
    const fileName = `${uuidv4()}${fileExtension}`;
    const filePath = join(uploadDir, fileName);

    // Convert file to buffer and save
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    await writeFile(filePath, buffer);

    // Return the path to the saved file (relative to public)
    const imagePath = `/images/${fileName}`;

    return NextResponse.json({
      success: true,
      imagePath,
    });
  } catch (error) {
    console.error("Error uploading file:", error);
    return NextResponse.json(
      { error: "Failed to upload file" },
      { status: 500 }
    );
  }
}

// Specify that this route should run in the Node.js runtime, not Edge
export const runtime = "nodejs";
