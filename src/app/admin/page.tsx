import { readContentData } from "@/lib/content-utils"
import AdminForm from "./admin-form"

export default async function AdminPage() {
  // Получаем данные из JSON файла на сервере
  const contentData = await readContentData()

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Admin Panel</h1>
      <AdminForm initialContent={contentData} />
    </div>
  )
}
