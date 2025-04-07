import { NextResponse } from "next/server";
import { getContent } from "@/lib/content";
import { ContentData } from "@/types/content";

export async function GET() {
  try {
    const content: ContentData = await getContent();
    return NextResponse.json(content, { status: 200 });
  } catch (error) {
    console.error("Ошибка в API route:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
