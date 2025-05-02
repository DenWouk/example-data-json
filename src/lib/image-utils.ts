// src/lib/image-utils.ts
import { checkMediaFileExists } from "./fs-utils";


/**
 * Интерфейс для результата обработки пути к изображению.
 */
interface PreparedImageData {
  /** URL для использования в src тега Image, или null если изображение не должно отображаться. */
  url: string | null;
  /** Существует ли файл изображения физически? */
  exists: boolean;
}



/**
 * Обрабатывает путь к изображению из контента, проверяет его существование
 * и формирует данные для использования в компоненте Image.
 * Выводит предупреждение в консоль, если файл указан, но не найден.
 * @param imagePath - Путь к файлу изображения из content.json (может быть string, null или undefined).
 * @param contentKey - Ключ контента (например, 'home', 'about.hero') для более информативного сообщения в консоли.
 * @returns Объект PreparedImageData.
 */
export async function prepareImageData(
  imagePath: string | null | undefined,
  contentKey: string = "unknown" // Добавим ключ для контекста в логах
): Promise<PreparedImageData> {
  if (!imagePath) {
    // Если путь не указан в контенте, просто возвращаем пустой результат
    return { url: null, exists: false };
  }

  const imageExists = await checkMediaFileExists(imagePath);

  if (imageExists) {
    // Файл найден, формируем URL
    return { url: `/api/media/${imagePath}`, exists: true };
  } else {
    // Файл указан, но не найден
    console.warn(
      `Изображение не найдено: Файл '${imagePath}', указанный для контента '${contentKey}', отсутствует в папке 'media'.`
    );
    return { url: null, exists: false };
  }
}
