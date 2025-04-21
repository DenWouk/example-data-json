import { type NextRequest, NextResponse } from "next/server"
import { writeFile, mkdir } from "fs/promises"
import path from "path"
import { existsSync } from "fs"

// Helper function to ensure directory exists
async function ensureDirectoryExists(dirPath: string): Promise<void> {
  if (!existsSync(dirPath)) {
    await mkdir(dirPath, { recursive: true })
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const formData = await request.formData()
    const file = formData.get("image") as File | null

    if (!file) {
      return NextResponse.json({ error: "No image file provided" }, { status: 400 })
    }

    // Validate file type
    const validTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"]
    if (!validTypes.includes(file.type)) {
      return NextResponse.json({ error: "Invalid file type" }, { status: 400 })
    }

    // Generate a unique filename
    const timestamp = Date.now()
    const originalName = file.name.replace(/[^a-zA-Z0-9.]/g, "-").toLowerCase()
    const extension = originalName.split(".").pop() || "jpg"
    const filename = `${timestamp}-${originalName.split(".")[0]}.${extension}`

    // Ensure the images directory exists
    const imagesDir = path.join(process.cwd(), "public", "images")
    await ensureDirectoryExists(imagesDir)

    // Convert the file to a Buffer
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Write the file to the public/images directory
    const filePath = path.join(imagesDir, filename)
    await writeFile(filePath, buffer)

    // Return the path to the file (relative to public)
    return NextResponse.json({ filePath: `/images/${filename}` })
  } catch (error) {
    console.error("Error uploading image:", error)

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ error: "An unknown error occurred" }, { status: 500 })
  }
}

// Configure the maximum file size (10MB)
export const config = {
  api: {
    bodyParser: false,
  },
}
