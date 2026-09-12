import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage";
import { storage } from "@/config/firebase";
const uploadFile = async (path, file, onProgress) => {
  const storageRef = ref(storage, path);
  const uploadTask = uploadBytesResumable(storageRef, file);
  return new Promise((resolve, reject) => {
    uploadTask.on(
      "state_changed",
      (snapshot) => {
        const progress = snapshot.bytesTransferred / snapshot.totalBytes * 100;
        if (onProgress) onProgress(progress);
      },
      (error) => reject(error),
      async () => {
        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
        resolve(downloadURL);
      }
const compressImage = (file, maxWidth = 800) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
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
        }, 'image/jpeg', 0.7);
      };
      img.onerror = () => resolve(file); // fallback to original
    };
    reader.onerror = () => resolve(file); // fallback to original
  });
};

const uploadMultipleFiles = async (basePath, files, onProgress) => {
  const totalFiles = files.length;
  let overallProgress = 0;
  const progressPerFile = 100 / totalFiles;
  
  const uploadProcess = async () => {
    // 1. Compress all files
    const compressedFiles = await Promise.all(
      files.map(f => f.type.startsWith('image/') ? compressImage(f) : f)
    );

    // 2. Upload files
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

  // Wrap the entire compression AND upload in a strict timeout.
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error("Storage upload timed out. Firebase Storage might be disabled.")), 8000);
  });

  return Promise.race([
    uploadProcess(),
    timeoutPromise
  ]);
};
const deleteFile = async (url) => {
  try {
    const urlRef = ref(storage, url);
    await deleteObject(urlRef);
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
