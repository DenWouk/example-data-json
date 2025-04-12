import fs from 'fs/promises';
import path from 'path';
import { ContentData } from '@/types/content'; 


const CONTENT_PATH = path.join(process.cwd(), 'content/data.json');

export async function getContent() {
  try {
    const fileContent = await fs.readFile(CONTENT_PATH, 'utf-8');
    return JSON.parse(fileContent) as ContentData;
  } catch (error) {
    console.error('Ошибка при чтении контента:', error);
    return {}; // Или какое-то значение по умолчанию
  }
}

export async function updateContent(newContent: ContentData) {
  try {
    await fs.writeFile(CONTENT_PATH, JSON.stringify(newContent, null, 2), 'utf-8');
    return true; // Успех
  } catch (error) {
    console.error('Ошибка при записи контента:', error);
    return false; // Ошибка
  }
}

// import fs from 'fs/promises';
// import path from 'path';
// import { unstable_cache } from 'next/cache';
// import { ContentData } from '@/types/content';

// const CONTENT_PATH = path.join(process.cwd(), 'content/data.json');

// export const getContent = unstable_cache(
//   async () => {
//     try {
//       const fileContent = await fs.readFile(CONTENT_PATH, 'utf-8');
//       return JSON.parse(fileContent) as ContentData;
//     } catch (error) {
//       console.error('Ошибка при чтении контента:', error);
//       return {};
//     }
//   },
//   ['content'], // Ключ кэша
//   {
//     revalidate: 60, // Рэвалідацыя кожныя 60 секунд
//     tags: ['content'], // Тэг для ручной рэвалідацыі
//   }
// );

// export async function updateContent(newContent: ContentData): Promise<boolean> {
//   try {
//     await fs.writeFile(CONTENT_PATH, JSON.stringify(newContent, null, 2), 'utf-8');
//     return true;
//   } catch (error) {
//     console.error('Ошибка при записи контента:', error);
//     return false;
//   }
// }