import ContentEditor from "../components/ContentEditor";

export default function AdminPage() {
  // TODO: Добавить проверку аутентификации (например, через cookies или JWT)
  // чтобы защитить этот роут.

  return (
    <div>
      <h1>Админ-панель</h1>
      <ContentEditor />
    </div>
  );
}