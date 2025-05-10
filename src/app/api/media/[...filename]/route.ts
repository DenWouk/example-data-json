// src/app/api/media/[...filename]/route.ts
import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import mime from "mime-types";
import { getSafeMediaFilePath } from "@/lib/fs-utils";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ filename: string[] }> }
) {
  const paramsObject = await context.params;
  const filenameSegments = paramsObject.filename;

  if (!filenameSegments || filenameSegments.length === 0) {
    console.error(
      "[API Media GET] Error: Missing filename segments. Resolved params.filename was empty or falsy.",
      paramsObject
    );
    return new NextResponse("Invalid or missing filename in route parameters", {
      status: 400,
    });
  }

  const requestedFilename = filenameSegments.join("/");

  console.log(
    `[API Media GET] Requested filename joined: ${requestedFilename}`
  );

  try {
    const filePath = getSafeMediaFilePath(requestedFilename);
    console.log(`[API Media GET] Serving file from safe path: ${filePath}`);

    await fs.access(filePath); // Check if file exists and is accessible

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
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code: string }).code === "ENOENT"
    ) {
      return new NextResponse("Media file not found", { status: 404 });
    }

    return new NextResponse("Internal Server Error serving file", {
      status: 500,
    });
  }
}
