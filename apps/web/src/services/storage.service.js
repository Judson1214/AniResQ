import { supabase } from "@/config/supabase";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const DEFAULT_ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

const MIME_EXTENSION_MAP = {
  "image/jpeg": ["jpg", "jpeg"],
  "image/png": ["png"],
  "image/webp": ["webp"],
  "application/pdf": ["pdf"],
};

const DANGEROUS_EXTENSIONS = new Set([
  "php", "phtml", "php3", "php4", "php5", "phar",
  "js", "mjs", "html", "htm", "svg",
  "exe", "dll", "sh", "bat", "cmd", "com", "jar",
  "py", "pl", "cgi", "asp", "aspx", "jsp"
]);

export const validateFile = async (file, options = {}) => {
  const maxSize = options.maxSize || MAX_FILE_SIZE;
  const allowedTypes = options.allowedTypes || DEFAULT_ALLOWED_TYPES;

  if (!file) {
    throw new Error("No file provided for upload");
  }

  // Reject file names longer than 120 characters
  if (file.name.length > 120) {
    throw new Error(`File name "${file.name}" exceeds maximum allowed length of 120 characters`);
  }

  // Reject names with path separators, null bytes, or control characters
  if (/[/\\\x00-\x1F\x7F]/.test(file.name)) {
    throw new Error(`File name "${file.name}" contains invalid characters (path separators, null bytes, or control characters)`);
  }

  // Reject zero-byte files
  if (file.size === 0) {
    throw new Error(`File "${file.name}" is empty (0 bytes)`);
  }

  if (file.size > maxSize) {
    const sizeInMb = (maxSize / (1024 * 1024)).toFixed(0);
    throw new Error(`File "${file.name}" exceeds maximum allowed size of ${sizeInMb}MB`);
  }

  const nameParts = file.name.split(".");
  if (nameParts.length < 2 || !nameParts[nameParts.length - 1].trim()) {
    throw new Error(`File "${file.name}" is missing a file extension`);
  }

  // Reject names where an earlier dot-separated segment is a dangerous executable extension
  for (let i = 1; i < nameParts.length - 1; i++) {
    const segment = nameParts[i].toLowerCase();
    if (DANGEROUS_EXTENSIONS.has(segment)) {
      throw new Error(`File "${file.name}" contains dangerous executable extension segment ".${nameParts[i]}"`);
    }
  }

  const ext = nameParts[nameParts.length - 1].toLowerCase();

  // Validate declared MIME type against allowlist
  if (!allowedTypes.includes(file.type)) {
    const acceptedList = allowedTypes.map(t => t.split('/')[1]?.toUpperCase() || t).join(', ');
    throw new Error(`File "${file.name}" has invalid format "${file.type}". Allowed formats: ${acceptedList}`);
  }

  // Check file extension against allow-list matching the MIME type
  const expectedExtensions = MIME_EXTENSION_MAP[file.type] || [];
  if (!expectedExtensions.includes(ext)) {
    throw new Error(`File extension ".${ext}" does not match declared MIME type "${file.type}"`);
  }

  // Magic bytes inspection
  const buffer = await file.slice(0, 12).arrayBuffer();
  const bytes = new Uint8Array(buffer);

  if (file.type === "image/jpeg") {
    if (bytes.length < 3 || bytes[0] !== 0xFF || bytes[1] !== 0xD8 || bytes[2] !== 0xFF) {
      throw new Error(`File "${file.name}" does not have valid JPEG header signatures`);
    }
  } else if (file.type === "image/png") {
    const pngMagic = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
    const isPng = bytes.length >= pngMagic.length && pngMagic.every((b, i) => bytes[i] === b);
    if (!isPng) {
      throw new Error(`File "${file.name}" does not have valid PNG header signatures`);
    }
  } else if (file.type === "image/webp") {
    const isRiff = bytes.length >= 12 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46;
    const isWebp = bytes.length >= 12 && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
    if (!isRiff || !isWebp) {
      throw new Error(`File "${file.name}" does not have valid WEBP header signatures`);
    }
  } else if (file.type === "application/pdf") {
    const pdfMagic = [0x25, 0x50, 0x44, 0x46, 0x2D];
    const isPdf = bytes.length >= pdfMagic.length && pdfMagic.every((b, i) => bytes[i] === b);
    if (!isPdf) {
      throw new Error(`File "${file.name}" does not have valid PDF header signatures`);
    }
  }

  return true;
};

const uploadFile = async (path, file, onProgress) => {
  await validateFile(file);
  // Ensure the upload path is strictly scoped under {auth.uid()}/... to satisfy storage RLS policies
  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id;
  
  let scopedPath = path.replace(/^\/+/, '');
  if (userId && !scopedPath.startsWith(`${userId}/`)) {
    scopedPath = `${userId}/${scopedPath}`;
  }

  // Upload to public 'uploads' bucket in Supabase
  const { error } = await supabase.storage
    .from('uploads')
    .upload(scopedPath, file, {
      cacheControl: '3600',
      upsert: true // Overwrite if exists
    });

  if (error) throw error;
  
  if (onProgress) onProgress(100);

  const { data: publicUrlData } = supabase.storage
    .from('uploads')
    .getPublicUrl(scopedPath);
    
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
  if (files.length > 5) {
    throw new Error("Maximum 5 files allowed per upload");
  }
  const totalFiles = files.length;
  if (totalFiles === 0) return [];
  
  // Validate all files before processing
  for (const file of files) {
    await validateFile(file);
  }

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

const uploadIdDocument = async (file, onProgress) => {
  await validateFile(file, {
    maxSize: MAX_FILE_SIZE,
    allowedTypes: [...DEFAULT_ALLOWED_TYPES, "application/pdf"],
  });

  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id;
  if (!userId) throw new Error("Must be logged in to upload identification documents");

  const ext = file.name.split('.').pop() || 'jpg';
  const scopedPath = `${userId}/id_document_${Date.now()}.${ext}`;

  // Upload to private 'id-verification' bucket in Supabase (public = false)
  const { error } = await supabase.storage
    .from('id-verification')
    .upload(scopedPath, file, {
      cacheControl: '3600',
      upsert: true
    });

  if (error) throw error;
  if (onProgress) onProgress(100);

  // Return the private storage object path (NOT a public URL)
  return scopedPath;
};

export {
  deleteFile,
  uploadFile,
  uploadMultipleFiles,
  uploadIdDocument
};
