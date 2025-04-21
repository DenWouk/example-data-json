import fs from "fs"
import path from "path"
import type { ContentData } from "@/content/data"

// Путь к JSON файлу для хранения данных
const CONTENT_JSON_PATH = path.join(process.cwd(), "public", "content", "data.json")

// Функция для чтения данных из JSON файла
export async function readContentData(): Promise<ContentData> {
  try {
    // Проверяем существование директории и файла
    const contentDir = path.join(process.cwd(), "public", "content")

    if (!fs.existsSync(contentDir)) {
      fs.mkdirSync(contentDir, { recursive: true })
    }

    // Если файл не существует, создаем его с данными по умолчанию из data.ts
    if (!fs.existsSync(CONTENT_JSON_PATH)) {
      const defaultData = (await import("@/content/data")).default
      fs.writeFileSync(CONTENT_JSON_PATH, JSON.stringify(defaultData, null, 2), "utf8")
      return defaultData
    }

    // Читаем данные из файла
    const fileContent = fs.readFileSync(CONTENT_JSON_PATH, "utf8")
    return JSON.parse(fileContent) as ContentData
  } catch (error) {
    console.error("Error reading content data:", error)

    // В случае ошибки возвращаем данные по умолчанию из data.ts
    const defaultData = (await import("@/content/data")).default
    return defaultData
  }
}

// Функция для записи данных в JSON файл
export async function writeContentData(data: ContentData): Promise<void> {
  try {
    // Проверяем существование директории
    const contentDir = path.join(process.cwd(), "public", "content")

    if (!fs.existsSync(contentDir)) {
      fs.mkdirSync(contentDir, { recursive: true })
    }

    // Записываем данные в файл
    fs.writeFileSync(CONTENT_JSON_PATH, JSON.stringify(data, null, 2), "utf8")
  } catch (error) {
    console.error("Error writing content data:", error)
    throw error
  }
}
