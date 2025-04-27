// src/app/api/media/[...filename]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import mime from 'mime-types'; // Понадобится установить: npm install mime-types @types/mime-types
import { getMediaFilePath } from '@/lib/fsUtils'; // Импортируем хелпер

export async function GET(
    request: NextRequest,
    { params }: { params: { filename: string[] } }
) {
    // Объединяем сегменты пути, если они есть (хотя обычно будет один)
    const filename = params.filename.join('/');

    if (!filename) {
        return new NextResponse('Filename missing', { status: 400 });
    }

    try {
        const filePath = getMediaFilePath(filename); // Используем хелпер для получения пути

        // Проверяем существование файла перед чтением
        await fs.access(filePath);

        const fileBuffer = await fs.readFile(filePath);
        const contentType = mime.lookup(filename) || 'application/octet-stream';

        // Устанавливаем заголовки кэширования, если нужно
        // Next.js Image Optimization будет кэшировать у себя, так что здесь можно ставить короткое время
        const headers = new Headers();
        headers.set('Content-Type', contentType);
        headers.set('Cache-Control', 'public, max-age=60, immutable'); // Кэш на 1 минуту

        return new NextResponse(fileBuffer, { status: 200, headers });

    } catch (error: any) {
         // Логируем ошибку на сервере
         console.error(`Error serving media file ${filename}:`, error);

         // Если файл не найден (ENOENT)
         if (error.code === 'ENOENT') {
            return new NextResponse('Media file not found', { status: 404 });
         }
         // Другие ошибки файловой системы или безопасности
         return new NextResponse('Internal Server Error', { status: 500 });
    }
}