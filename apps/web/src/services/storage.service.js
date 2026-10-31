import { supabase } from "@/config/supabase";

const uploadFile = async (path, file, onProgress) => {
  // Note: Ensure you have created a public bucket named 'uploads' in Supabase
  const { error } = await supabase.storage
    .from('uploads')
    .upload(path, file, {
      cacheControl: '3600',
      upsert: true // Overwrite if exists
    });

  if (error) throw error;
  
  if (onProgress) onProgress(100);

  const { data: publicUrlData } = supabase.storage
    .from('uploads')
    .getPublicUrl(path);
    
  return publicUrlData.publicUrl;
};

const compressImage = (file, maxWidth = 800) => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        // Only scale down if image exceeds maxWidth; never upscale smaller images
        if (img.width <= maxWidth) {
          resolve(file);
          return;
        }

        const canvas = document.createElement('canvas');
        const scaleSize = maxWidth / img.width;
        canvas.width = maxWidth;
        canvas.height = img.height * scaleSize;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(new File([blob], file.name, {
              type: 'image/jpeg',
              lastModified: Date.now()
            }));
          } else {
            resolve(file); // fallback to original if compression fails
          }
        }, 'image/jpeg', 0.8);
      };
      img.onerror = () => resolve(file); // fallback to original
    };
    reader.onerror = () => resolve(file); // fallback to original
  });
};

const uploadMultipleFiles = async (basePath, files, onProgress) => {
  const totalFiles = files.length;
  if (totalFiles === 0) return [];
  let overallProgress = 0;
  const progressPerFile = 100 / totalFiles;
  
  // 1. Compress images first
  const compressedFiles = await Promise.all(
    files.map(f => f.type.startsWith('image/') ? compressImage(f) : f)
  );

  // 2. Upload files with generous 30s network timeout
  const uploadProcess = async () => {
    const uploadPromises = compressedFiles.map(async (file, index) => {
      const extension = "jpg";
      const filename = `${Date.now()}-${index}.${extension}`;
      const path = `${basePath}/${filename}`;
      return uploadFile(path, file, () => {}).then((url) => {
        overallProgress += progressPerFile;
        if (onProgress) onProgress(Math.min(overallProgress, 100));
        return url;
      });
    });
    return Promise.all(uploadPromises);
  };

  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error("Storage upload timed out. Please check your network connection.")), 30000);
  });

  return Promise.race([
    uploadProcess(),
    timeoutPromise
  ]);
};

const deleteFile = async (url) => {
  try {
    // Extract the path from the public URL if possible
    const matches = url.match(/\/storage\/v1\/object\/public\/uploads\/(.+)/);
    if (matches && matches[1]) {
      const path = matches[1];
      const { error } = await supabase.storage.from('uploads').remove([path]);
      if (error) throw error;
    }
  } catch (error) {
    console.error("Error deleting file:", error);
    throw error;
  }
};

export {
  deleteFile,
  uploadFile,
  uploadMultipleFiles
};
