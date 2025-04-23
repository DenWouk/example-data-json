import { getHomeContent } from "@/lib/data";
import AdminForm from "./admin-form";

export default async function AdminPage() {
  const content = await getHomeContent();

  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-8">Admin Panel</h1>
      <AdminForm initialContent={content} />
    </div>
  );
}
