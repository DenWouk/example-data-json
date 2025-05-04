// src/app/api/media/[...filename]/route.ts
import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import mime from "mime-types";
import { getSafeMediaFilePath } from "@/lib/fs-utils"; // Проверь путь

interface RouteContext {
  // Определение типа context.params здесь не так важно,
  // так как мы будем использовать await
  params: {
    filename?: string[];
  };
}

export async function GET(
  _: NextRequest, // request не используется
  context: RouteContext
) {
  let awaitedParams: { filename?: string[] } | undefined;
  try {
    // ПОЛУЧАЕМ ПАРАМЕТРЫ ЧЕРЕЗ AWAIT
    awaitedParams = await context.params;
  } catch (error) {
    console.error("[API Media GET] Error awaiting context.params:", error);
    return new NextResponse("Internal Server Error awaiting params", {
      status: 500,
    });
  }

  // ПРОВЕРЯЕМ РЕЗУЛЬТАТ AWAIT
  if (
    !awaitedParams ||
    !awaitedParams.filename ||
    !Array.isArray(awaitedParams.filename) ||
    awaitedParams.filename.length === 0
  ) {
    console.error(
      "[API Media GET] Error: Invalid or missing params/filename segments after await. Params:",
      awaitedParams
    );
    return new NextResponse("Invalid or missing filename in route parameters", {
      status: 400,
    });
  }

  // Теперь используем awaitedParams.filename
  const filenameSegments = awaitedParams.filename;
  const requestedFilename = filenameSegments.join("/");
  console.log(
    `[API Media GET] Requested filename joined: ${requestedFilename}`
  );

  try {
    const filePath = getSafeMediaFilePath(requestedFilename);
    console.log(`[API Media GET] Serving file from safe path: ${filePath}`);
    await fs.access(filePath);

    const fileBuffer = await fs.readFile(filePath);
    const contentType = mime.lookup(filePath) || "application/octet-stream";
    const headers = new Headers();
    headers.set("Content-Type", contentType);
    headers.set("Cache-Control", "public, max-age=31536000, immutable");

    return new NextResponse(fileBuffer, { status: 200, headers });
  } catch (error: unknown) {
    console.error(
      `[API Media GET] Error serving media file '${requestedFilename}':`,
      error
    );
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return new NextResponse("Media file not found", { status: 404 });
    }
    return new NextResponse("Internal Server Error serving file", {
      status: 500,
    });
  }
}
