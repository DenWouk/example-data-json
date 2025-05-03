// src/app/api/media/[...filename]/route.ts
import { NextResponse } from "next/server";
import fs from "fs/promises";
// Не импортируем path, будем использовать basename внутри getSafeMediaFilePath
import mime from "mime-types";
// Используем ОБНОВЛЕННУЮ безопасную функцию
import { getSafeMediaFilePath } from "@/lib/fs-utils";

// Типизация контекста для App Router Route Handlers
interface RouteContext {
  params: {
    filename?: string[]; // filename может отсутствовать если роут не совпал точно
  };
}

export async function GET(
  context: RouteContext // Убрали Promise<>, params доступны синхронно
) {
  // Параметры доступны сразу в context.params
  const params = await context.params;
  const filenameSegments = params.filename;

  if (
    !filenameSegments ||
    !Array.isArray(filenameSegments) ||
    filenameSegments.length === 0
  ) {
    console.error(
      "[API Media GET] Error: Invalid or missing filename segments in route params:",
      filenameSegments
    );
    return new NextResponse("Invalid route parameters", { status: 400 }); // 400 Bad Request
  }

  // Собираем путь из сегментов. Важно: getSafeMediaFilePath обработает только последний сегмент (имя файла)!
  // Если нужны вложенные папки внутри media, логику getSafeMediaFilePath нужно будет адаптировать.
  // Текущая реализация getSafeMediaFilePath ожидает ТОЛЬКО имя файла.
  const requestedFilename = filenameSegments.join("/"); // Это может быть "image.jpg" или "subdir/image.jpg"

  console.log(`[API Media GET] Requested filename raw: ${requestedFilename}`);

  try {
    // getSafeMediaFilePath ИСПОЛЬЗУЕТ ТОЛЬКО БАЗОВОЕ ИМЯ ФАЙЛА из requestedFilename
    // Если вам нужно разрешить подпапки, getSafeMediaFilePath нужно модифицировать
    // или использовать другой подход для валидации пути.
    // Текущий вызов безопасен, т.к. path.basename() будет вызван внутри.
    const filePath = getSafeMediaFilePath(requestedFilename);
    console.log(`[API Media GET] Serving file from safe path: ${filePath}`);

    // Проверка доступа (уже внутри getSafeMediaFilePath не делается, делаем здесь)
    // fs.access нужен, чтобы убедиться, что файл действительно существует перед чтением
    await fs.access(filePath);

    const fileBuffer = await fs.readFile(filePath);
    // mime.lookup использует расширение файла
    const contentType = mime.lookup(filePath) || "application/octet-stream";

    const headers = new Headers();
    headers.set("Content-Type", contentType);
    // Кеширование: public, max-age=31536000 (1 год), immutable - агрессивное кеширование для статики
    headers.set("Cache-Control", "public, max-age=31536000, immutable");

    return new NextResponse(fileBuffer, { status: 200, headers });
  } catch (error: unknown) {
    // Логируем исходное запрошенное имя и ошибку
    console.error(
      `[API Media GET] Error serving media file '${requestedFilename}':`,
      error
    );
    // Проверяем тип ошибки для доступа к 'code'
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return new NextResponse("Media file not found", { status: 404 });
    }
    // Для других ошибок возвращаем 500
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
