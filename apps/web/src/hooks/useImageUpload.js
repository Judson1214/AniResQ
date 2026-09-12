import { useState } from "react";
import { uploadMultipleFiles } from "@/services/storage.service";
const useImageUpload = () => {
  const [progress, setProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const uploadImages = async (files, basePath) => {
    setIsUploading(true);
    setProgress(0);
    try {
      const urls = await uploadMultipleFiles(basePath, files, (p) => setProgress(p));
      return urls;
    } catch (error) {
      console.error("Error uploading images:", error);
      throw error;
    } finally {
      setIsUploading(false);
      setProgress(100);
    }
  };
  return { uploadImages, progress, isUploading };
};
export {
  useImageUpload
};
