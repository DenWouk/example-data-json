// src/app/admin/page.tsx

import { revalidatePath } from "next/cache";
import AdminForm from "@/components/AdminForm";
import { getHomeContent, updateHomeContent } from "@/lib/data";
import { HomeContent } from "@/types/content";

async function onSubmit(content: Partial<HomeContent>): Promise<void> {
  "use server";
  try {
    await updateHomeContent(content);
    revalidatePath('/'); 
  } catch (error) {
    console.error("Error updating content:", error);
    alert("Failed to update content");
  }
}

export default async function Admin() {
  const initialContent = await getHomeContent();

  return (
    <div>
      <h1>Admin Panel</h1>
      <AdminForm initialContent={initialContent} onSubmit={onSubmit} />
    </div>
  );
}
