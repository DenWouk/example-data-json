import fs from 'fs/promises';
import path from 'path';

const CONTENT_PATH = path.join(process.cwd(), 'content/data.json');

export async function getContent() {
  try {
    const fileContent = await fs.readFile(CONTENT_PATH, 'utf-8');
    return JSON.parse(fileContent);
  } catch (error) {
    console.error('Ошибка при чтении контента:', error);
    return {}; // Или какое-то значение по умолчанию
  }
}

export async function updateContent(newContent: any) {
  try {
    await fs.writeFile(CONTENT_PATH, JSON.stringify(newContent, null, 2), 'utf-8');
    return true; // Успех
  } catch (error) {
    console.error('Ошибка при записи контента:', error);
    return false; // Ошибка
  }
}