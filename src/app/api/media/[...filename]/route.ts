// src/app/api/media/[...filename]/route.ts
import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import mime from "mime-types";
import { getMediaFilePath } from "@/lib/fs-utils";

export async function GET(
  request: NextRequest,
  context: { params: /* Promise< */ { filename: string[] } /* > */ } // params теперь неявно Promise
) {
  // --- ИСПОЛЬЗУЕМ await ---
  const params = await context.params; // <-- ЯВНО ДОЖИДАЕМСЯ params
  // --- Конец исправления ---

  // Теперь можно безопасно обращаться к params.filename
  if (!params || !Array.isArray(params.filename)) {
    console.error(
      "[API Media GET] Error: Invalid params structure received after await:",
      params
    );
    return new NextResponse("Invalid route parameters", { status: 500 });
  }

  const filename = params.filename.join("/");

  if (!filename) {
    return new NextResponse("Filename missing", { status: 400 });
  }
  console.log(`[API Media GET] Requested filename: ${filename}`);

  try {
    const filePath = getMediaFilePath(filename);
    await fs.access(filePath);

    const fileBuffer = await fs.readFile(filePath);
    const contentType = mime.lookup(filename) || "application/octet-stream";

    const headers = new Headers();
    headers.set("Content-Type", contentType);
    headers.set("Cache-Control", "public, max-age=60, immutable");

    return new NextResponse(fileBuffer, { status: 200, headers });
  } catch (error: any) {
    console.error(
      `[API Media GET] Error serving media file ${filename}:`,
      error
    );
    if (error.code === "ENOENT") {
      return new NextResponse("Media file not found", { status: 404 });
    }
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
