// src/app/admin/actions.ts
"use server"; // Обязательно для Server Actions

import { revalidatePath } from "next/cache";
import {
  getContent,
  writeContent,
  AppContent,
  PageContent,
} from "@/lib/content";

// Получение текущего контента для формы
export async function getAdminContent(): Promise<AppContent> {
  // Здесь можно добавить логику проверки прав доступа в будущем
  console.log("Server Action: getAdminContent called");
  return await getContent();
}

// Обновление контента и ревалидация кэша
export async function updateAdminContent(
  pageKey: keyof AppContent, // Ключ страницы ('home', 'about', etc.)
  updatedPageData: PageContent // Новые данные для этой страницы
): Promise<{ success: boolean; message: string }> {
  // Здесь можно добавить логику проверки прав доступа в будущем
  console.log(`Server Action: updateAdminContent called for page: ${pageKey}`);
  try {
    const currentContent = await getContent();
    const newContent = {
      ...currentContent,
      [pageKey]: updatedPageData, // Обновляем только нужную страницу
    };

    await writeContent(newContent);

    // Ревалидация кэша для затронутых страниц
    // Ревалидируем главную страницу, если изменили 'home'
    if (pageKey === "home") {
      revalidatePath("/"); // Ревалидирует главную страницу
      console.log("Revalidated path: /");
    }
    // Добавь ревалидацию для других путей, если нужно
    if (pageKey === "about") {
      revalidatePath("/about"); // Пример для другой страницы
      console.log("Revalidated path: /about");
    }
    // Можно ревалидировать layout, если изменения затрагивают его
    // revalidatePath('/', 'layout');

    return { success: true, message: "Content updated successfully!" };
  } catch (error: any) {
    console.error("Error in updateAdminContent:", error);
    return {
      success: false,
      message: `Failed to update content: ${error.message}`,
    };
  }
}
