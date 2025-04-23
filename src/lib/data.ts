import Database from "better-sqlite3";
import { join } from "path";
import fs from "fs";

// Define types for our content
export interface HomeContent {
  id: number;
  title: string | null;
  description: string | null;
  image: string | null;
}

// Initialize database
const dbDir = join(process.cwd(), "public/content");
const dbPath = join(dbDir, "content.db");
let db: Database.Database;

// Ensure the database exists
function ensureDbExists(): void {
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  // Ensure images directory exists
  const imagesDir = join(process.cwd(), "public/images");
  if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir, { recursive: true });
  }

  db = new Database(dbPath);

  // Create tables if they don't exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS home_content (
      id INTEGER PRIMARY KEY,
      title TEXT,
      description TEXT,
      image TEXT
    )
  `);

  // Insert default data if table is empty
  const count = db
    .prepare("SELECT COUNT(*) as count FROM home_content")
    .get() as { count: number };

  if (count.count === 0) {
    db.prepare(
      `
      INSERT INTO home_content (title, description, image)
      VALUES (?, ?, ?)
    `
    ).run(
      "Welcome to My Next.js App",
      "This is a sample description for the home page. Edit this content in the admin panel.",
      null // No default image
    );
  }
}

// Get database connection
function getDb(): Database.Database {
  if (!db) {
    ensureDbExists();
  }
  return db;
}

// Get home page content
export async function getHomeContent(): Promise<HomeContent> {
  const db = getDb();
  const content = db
    .prepare("SELECT * FROM home_content WHERE id = 1")
    .get() as HomeContent;
  return content;
}

// Update home page content
export async function updateHomeContent(
  content: Partial<Omit<HomeContent, "id">>
): Promise<HomeContent> {
  const db = getDb();

  // Get current content to preserve fields that aren't being updated
  const currentContent = db
    .prepare("SELECT * FROM home_content WHERE id = 1")
    .get() as HomeContent;

  const updatedContent = {
    title: content.title !== undefined ? content.title : currentContent.title,
    description:
      content.description !== undefined
        ? content.description
        : currentContent.description,
    image: content.image !== undefined ? content.image : currentContent.image,
  };

  db.prepare(
    `
    UPDATE home_content
    SET title = ?, description = ?, image = ?
    WHERE id = 1
  `
  ).run(updatedContent.title, updatedContent.description, updatedContent.image);

  return getHomeContent();
}
