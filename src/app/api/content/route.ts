import { type NextRequest, NextResponse } from "next/server"
import type { ContentData } from "@/content/data"
import { writeContentData } from "@/lib/content-utils"
import { revalidatePath } from "next/cache"

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Parse the request body
    const contentData: ContentData = await request.json()

    // Validate the data structure
    if (!contentData || !contentData.home) {
      return NextResponse.json({ error: "Invalid content data structure" }, { status: 400 })
    }

    // Validate required fields
    if (!contentData.home.title || !contentData.home.description || !contentData.home.image) {
      return NextResponse.json({ error: "Missing required fields in content data" }, { status: 400 })
    }

    // Записываем данные в JSON файл
    await writeContentData(contentData)

    // Revalidate all pages that might use this data
    revalidatePath("/")
    revalidatePath("/admin")

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error updating content:", error)

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ error: "An unknown error occurred" }, { status: 500 })
  }
}
