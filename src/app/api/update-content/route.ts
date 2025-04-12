import { NextResponse } from 'next/server';
import { updateContent } from '@/lib/content';
import { revalidatePath } from 'next/cache';
import { ContentData } from '@/types/content';
import fs from 'fs/promises'; // Import fs/promises для асинхронной работы с файлами
import path from 'path';

export async function POST(request: Request) {
  try {
    const newContent: ContentData = await request.json();
    const success = await updateContent(newContent);

    if (success) {
      revalidatePath('/');

      // Пересоздаем пустой файл restart.txt в папке tmp
      const restartFilePath = path.join(process.cwd(), 'tmp', 'restart.txt');
      try {
        await fs.writeFile(restartFilePath, '', { encoding: 'utf8' }); // Создаем пустой файл
        console.log('Файл tmp/restart.txt успешно пересоздан.');
      } catch (error) {
        console.error('Ошибка при пересоздании файла tmp/restart.txt:', error);
        return NextResponse.json({ message: 'Content updated successfully, but failed to trigger restart' }, { status: 500 });
      }

      return NextResponse.json({ message: 'Content updated successfully, server will restart' }, { status: 200 });

    } else {
      return NextResponse.json({ message: 'Failed to update content' }, { status: 500 });
    }
  } catch (error) {
    console.error('Ошибка в API route:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}