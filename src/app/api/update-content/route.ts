import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { updateContent } from '@/lib/content';

export async function POST(request: Request) {
  try {
    const newContent = await request.json();
    const success = await updateContent(newContent);

    if (success) {
      revalidatePath('/'); // Обновляем главную страницу (и другие, если нужно)
      return NextResponse.json({ message: 'Content updated successfully' }, { status: 200 });
    } else {
      return NextResponse.json({ message: 'Failed to update content' }, { status: 500 });
    }
  } catch (error) {
    console.error('Ошибка в API route:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}