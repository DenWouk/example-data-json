// src/components/AdminForm.tsx

"use client";

import { useState, useEffect } from "react";
import { HomeContent } from "@/types/content";

interface AdminFormProps {
  initialContent: HomeContent;
  onSubmit: (content: Partial<HomeContent>) => Promise<void>;
}

const AdminForm: React.FC<AdminFormProps> = ({ initialContent, onSubmit }) => {
  const [title, setTitle] = useState<string | null>(initialContent.title);
  const [description, setDescription] = useState<string | null>(
    initialContent.description
  );
  const [image, setImage] = useState<string | null>(initialContent.image);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  useEffect(() => {
    setTitle(initialContent.title);
    setDescription(initialContent.description);
    setImage(initialContent.image);
  }, [initialContent]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files && event.target.files[0];
    setSelectedFile(file || null);
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      alert("Please select a file");
      return;
    }

    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        setImage(data.imageUrl); // Set the image URL from the response
        alert("File uploaded successfully!");
      } else {
        alert(`File upload failed: ${data.message}`);
      }
    } catch (error) {
      console.error("Error uploading file:", error);
      alert("Failed to upload file");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit({ title, description, image });
  };

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <label htmlFor="title">Title:</label>
        <input
          type="text"
          id="title"
          value={title || ""}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>
      <div>
        <label htmlFor="description">Description:</label>
        <textarea
          id="description"
          value={description || ""}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      <div>
        <label htmlFor="image">Image URL:</label>
        <input
          type="text"
          id="image"
          value={image || ""}
          onChange={(e) => setImage(e.target.value)}
        />
      </div>
      <div>
        <label htmlFor="file">Upload Image:</label>
        <input type="file" id="file" onChange={handleFileChange} />
        <button type="button" onClick={handleUpload}>
          Upload
        </button>
      </div>
      <button type="submit">Update Content</button>
    </form>
  );
};

export default AdminForm;
