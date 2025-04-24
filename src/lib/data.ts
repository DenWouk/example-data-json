// src/lib/data.ts

import Database from "better-sqlite3";
import { join } from "path";
import fs from "fs";
import { HomeContent } from "@/types/content";

const dbPath = join(process.cwd(), "data", "content.db"); // Путь к базе данных (относительный путь к корню проекта)

let db: Database.Database | null = null;

function ensureDbExists(): void {
  const dbDir = join(process.cwd(), "data"); // Папка для хранения базы данных
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  if (!fs.existsSync(dbPath)) {
    db = new Database(dbPath);

    db.exec(`
      CREATE TABLE IF NOT EXISTS home_content (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
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

    console.log("Database created and initialized.");
  } else {
    db = new Database(dbPath);
    console.log("Database connection established.");
  }
}

function getDb(): Database.Database {
  if (!db) {
    ensureDbExists();
  }
  return db as Database.Database; // Type assertion here
}

export async function getHomeContent(): Promise<HomeContent> {
  const db = getDb();
  try {
    const content = db
      .prepare("SELECT * FROM home_content WHERE id = 1")
      .get() as HomeContent;
    return content;
  } catch (error) {
    console.error("Error getting home content:", error);
    throw new Error("Failed to get home content");
  }
}

export async function updateHomeContent(
  content: Partial<HomeContent>
): Promise<HomeContent> {
  const db = getDb();
  try {
    const currentContent = await getHomeContent(); // Get current content

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
    ).run(
      updatedContent.title,
      updatedContent.description,
      updatedContent.image
    );

    return getHomeContent(); // Return the updated content
  } catch (error) {
    console.error("Error updating home content:", error);
    throw new Error("Failed to update home content");
  }
}
