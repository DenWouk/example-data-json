import { NextResponse } from 'next/server';
import { updateContent } from '@/lib/content';
import { revalidatePath } from 'next/cache';
import { ContentData } from '@/types/content'; 

export async function POST(request: Request) {
  try {
    const newContent: ContentData = await request.json(); 
    const success = await updateContent(newContent);

    if (success) {
      revalidatePath('/');
      return NextResponse.json({ message: 'Content updated successfully' }, { status: 200 });
    } else {
      return NextResponse.json({ message: 'Failed to update content' }, { status: 500 });
    }
  } catch (error) {
    console.error('Ошибка в API route:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}