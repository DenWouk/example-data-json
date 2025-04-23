"use client";

import type React from "react";
import { useState, useRef } from "react";
import Image from "next/image";
import type { HomeContent } from "@/lib/data";
import { useRouter } from "next/navigation";

interface AdminFormProps {
  initialContent: HomeContent;
}

export default function AdminForm({ initialContent }: AdminFormProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [content, setContent] = useState<Partial<Omit<HomeContent, "id">>>({
    title: initialContent.title || "",
    description: initialContent.description || "",
    image: initialContent.image || "",
  });
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [message, setMessage] = useState<string>("");
  const [previewImage, setPreviewImage] = useState<string | null>(
    initialContent.image
  );

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setContent((prev) => ({
      ...prev,
      [name]: value,
    }));

    if (name === "image") {
      setPreviewImage(value || null);
    }
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      if (typeof e.target?.result === "string") {
        setPreviewImage(e.target.result);
      }
    };
    reader.readAsDataURL(file);

    // Upload image
    const formData = new FormData();
    formData.append("image", file);

    try {
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to upload image");
      }

      const data = await response.json();
      setContent((prev) => ({
        ...prev,
        image: data.imagePath,
      }));
      setMessage("Image uploaded successfully!");
    } catch (error) {
      if (error instanceof Error) {
        setMessage(`Error uploading image: ${error.message}`);
      } else {
        setMessage("An unknown error occurred during upload");
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage("");

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

      setMessage("Content updated successfully!");

      // Trigger revalidation
      await fetch("/api/revalidate");
      router.refresh();
    } catch (error) {
      if (error instanceof Error) {
        setMessage(`Error: ${error.message}`);
      } else {
        setMessage("An unknown error occurred");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClearImage = () => {
    setContent((prev) => ({
      ...prev,
      image: null,
    }));
    setPreviewImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label htmlFor="title" className="block text-sm font-medium mb-1">
          Title
        </label>
        <input
          type="text"
          id="title"
          name="title"
          value={content.title || ""}
          onChange={handleChange}
          className="w-full p-2 border rounded-md"
        />
      </div>

      <div>
        <label htmlFor="description" className="block text-sm font-medium mb-1">
          Description
        </label>
        <textarea
          id="description"
          name="description"
          value={content.description || ""}
          onChange={handleChange}
          rows={4}
          className="w-full p-2 border rounded-md"
        />
      </div>

      <div>
        <label htmlFor="image" className="block text-sm font-medium mb-1">
          Image URL
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            id="image"
            name="image"
            value={content.image || ""}
            onChange={handleChange}
            className="w-full p-2 border rounded-md"
          />
          <button
            type="button"
            onClick={handleClearImage}
            className="px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
          >
            Clear
          </button>
        </div>
      </div>

      <div>
        <label htmlFor="imageUpload" className="block text-sm font-medium mb-1">
          Upload Image
        </label>
        <input
          type="file"
          id="imageUpload"
          ref={fileInputRef}
          accept="image/*"
          onChange={handleImageChange}
          className="w-full p-2 border rounded-md"
        />
      </div>

      {previewImage && (
        <div className="mt-4">
          <p className="text-sm font-medium mb-1">Image Preview</p>
          <div>
            <Image
              src={previewImage || "/placeholder.svg"}
              alt="Preview"
              width={300}
              height={300}
              className="rounded-lg object-contain border"
            />
          </div>
        </div>
      )}

      {message && (
        <div
          className={`p-3 rounded-md ${
            message.includes("Error")
              ? "bg-red-100 text-red-700"
              : "bg-green-100 text-green-700"
          }`}
        >
          {message}
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {isSubmitting ? "Updating..." : "Update Content"}
        </button>
      </div>
    </form>
  );
}
