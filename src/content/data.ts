// Define the structure of our content
export interface ContentItem {
  title: string
  description: string
  image: string // Path to the image relative to /public
}

// Define the structure of our entire content object
export interface ContentData {
  home: ContentItem
  // Add other pages as needed
  about?: ContentItem
  contact?: ContentItem
}

// The actual content data
const contentData: ContentData = {
  home: {
    title: "Welcome to Our Website",
    description: "This is a simple website built with Next.js 15 and TypeScript.",
    image: "/images/default-home.jpg", // Default image path
  },
}

export default contentData
