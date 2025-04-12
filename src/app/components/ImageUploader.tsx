"use client";

import { useState, ChangeEvent } from "react";

interface ImageUploaderProps {
  section: string;
  onImageUpload: (section: string, imageUrl: string) => void;
  onClose: () => void;
}

export default function ImageUploader({
  section,
  onImageUpload,
  onClose,
}: ImageUploaderProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      setSelectedFile(event.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      alert("Выберыце файл");
      return;
    }

    setUploading(true);

    const formData = new FormData();
    formData.append("image", selectedFile);

    try {
      const response = await fetch("/api/upload-image", {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        onImageUpload(section, data.imageUrl);
        alert("Малюнак паспяхова загружаны!");
      } else {
        alert("Памылка пры загрузцы малюнка.");
      }
    } catch (error) {
      console.error("Памылка пры адпраўцы дадзеных:", error);
      alert("Памылка пры адпраўцы дадзеных.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <input type="file" accept="image/*" onChange={handleFileChange} />
      <button onClick={handleUpload} disabled={uploading}>
        {uploading ? "Загрузка..." : "Загрузіць"}
      </button>
      <button onClick={onClose}>Закрыць</button>
    </div>
  );
}
