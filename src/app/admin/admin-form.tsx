"use client";

import type React from "react";
import { useState, useRef } from "react";
import Image from "next/image";
import type { ContentData } from "@/content/data";
import { useRouter } from "next/navigation";

interface AdminFormProps {
  initialContent: ContentData;
}

export default function AdminForm({ initialContent }: AdminFormProps) {
  const router = useRouter();
  const [content, setContent] = useState<ContentData>(initialContent);
  const [status, setStatus] = useState<string | null>(null);
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleInputChange = (
    page: keyof ContentData,
    field: string,
    value: string
  ) => {
    setContent((prev) => ({
      ...prev,
      [page]: {
        ...prev[page],
        [field]: value,
      },
    }));
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!validTypes.includes(file.type)) {
      setUploadStatus(
        "Error: Please upload a valid image file (JPEG, PNG, WebP, or GIF)"
      );
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setUploadStatus("Error: Image size should be less than 5MB");
      return;
    }

    setUploading(true);
    setUploadStatus("Uploading image...");

    try {
      const formData = new FormData();
      formData.append("image", file);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || "Failed to upload image");
      }

      const data: { filePath: string } = await response.json();

      // Update content with new image path
      handleInputChange("home", "image", data.filePath);
      setUploadStatus("Image uploaded successfully!");
    } catch (error) {
      if (error instanceof Error) {
        setUploadStatus(`Error: ${error.message}`);
      } else {
        setUploadStatus("An unknown error occurred during upload");
      }
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    try {
      const response = await fetch("/api/content", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(content),
      });

      if (!response.ok) {
        throw new Error("Failed to update content");
      }

      setStatus("Content updated successfully!");
      router.refresh(); // Refresh the page to show updated content
    } catch (error) {
      if (error instanceof Error) {
        setStatus(`Error: ${error.message}`);
      } else {
        setStatus("An unknown error occurred");
      }
    }
  };

  return (
    <>
      {status && (
        <div
          className={`p-4 mb-4 rounded ${
            status.includes("Error") ? "bg-red-100" : "bg-green-100"
          }`}
        >
          {status}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="border p-4 rounded">
          <h2 className="text-xl font-semibold mb-4">Home Page</h2>

          <div className="mb-4">
            <label htmlFor="home-title" className="block mb-1 font-medium">
              Title
            </label>
            <input
              id="home-title"
              type="text"
              value={content.home.title}
              onChange={(e) =>
                handleInputChange("home", "title", e.target.value)
              }
              className="w-full p-2 border rounded"
              required
            />
          </div>

          <div className="mb-4">
            <label
              htmlFor="home-description"
              className="block mb-1 font-medium"
            >
              Description
            </label>
            <textarea
              id="home-description"
              value={content.home.description}
              onChange={(e) =>
                handleInputChange("home", "description", e.target.value)
              }
              className="w-full p-2 border rounded"
              rows={4}
              required
            />
          </div>

          <div className="mb-4">
            <label className="block mb-1 font-medium">Image</label>

            {/* Current image preview */}
            <div className="mb-3">
              <p className="text-sm text-gray-500 mb-2">Current image:</p>
              <div className="relative w-full h-40 border rounded overflow-hidden">
                <Image
                  src={content.home.image || "/placeholder.svg"}
                  alt="Current image"
                  width={300}
                  height={300}
                  className="object-contain"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">{content.home.image}</p>
            </div>

            {/* Image upload */}
            <div className="mt-4">
              <input
                ref={fileInputRef}
                type="file"
                id="home-image"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={handleImageUpload}
                className="hidden"
                disabled={uploading}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 disabled:opacity-50"
              >
                {uploading ? "Uploading..." : "Upload New Image"}
              </button>

              {uploadStatus && (
                <p
                  className={`mt-2 text-sm ${
                    uploadStatus.includes("Error")
                      ? "text-red-500"
                      : "text-green-500"
                  }`}
                >
                  {uploadStatus}
                </p>
              )}
            </div>

            {/* Manual image path input */}
            <div className="mt-4">
              <label htmlFor="home-image-path" className="block mb-1 text-sm">
                Or enter image path manually:
              </label>
              <input
                id="home-image-path"
                type="text"
                value={content.home.image}
                onChange={(e) =>
                  handleInputChange("home", "image", e.target.value)
                }
                placeholder="/images/your-image.jpg"
                className="w-full p-2 border rounded text-sm"
              />
              <p className="text-xs text-gray-500 mt-1">
                Path should be relative to the public directory
              </p>
            </div>
          </div>
        </div>

        <button
          type="submit"
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Update Content
        </button>
      </form>
    </>
  );
}
