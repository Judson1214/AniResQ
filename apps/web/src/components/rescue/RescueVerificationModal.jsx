import { useState, useEffect } from "react";
import { 
  CheckCircle2, 
  Upload, 
  X, 
  AlertCircle, 
  Loader2 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { uploadMultipleFiles } from "@/services/storage.service";

export const RescueVerificationModal = ({ isOpen, onClose, onConfirm, isSubmitting }) => {
  const [notes, setNotes] = useState("");
  const [photoItems, setPhotoItems] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState("");

  // Revoke object URLs on unmount or modal close to prevent memory leaks
  useEffect(() => {
    return () => {
      photoItems.forEach((item) => {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      });
    };
  }, [photoItems]);

  if (!isOpen) return null;

  const handleFileChange = (e) => {
    if (!e.target.files) return;
    setError("");
    const selected = Array.from(e.target.files);
    const validItems = [];
    const MAX_SIZE = 5 * 1024 * 1024; // 5MB
    const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

    for (const file of selected) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        setError(`"${file.name}" is not an accepted format. Only JPEG, PNG, and WebP are allowed.`);
        return;
      }
      if (file.size > MAX_SIZE) {
        setError(`"${file.name}" exceeds the 5MB file size limit.`);
        return;
      }
      validItems.push({
        file,
        previewUrl: URL.createObjectURL(file),
      });
    }

    setPhotoItems((prev) => [...prev, ...validItems]);
  };

  const removePhotoItem = (index) => {
    setPhotoItems((prev) => {
      const target = prev[index];
      if (target?.previewUrl) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!notes.trim() || notes.trim().length < 10) {
      setError("Please provide resolution notes (at least 10 characters) describing the rescue actions and animal status.");
      return;
    }

    try {
      setIsUploading(true);
      let uploadedUrls = [];

      if (photoItems.length > 0) {
        const tempId = crypto.randomUUID();
        const filesToUpload = photoItems.map((item) => item.file);
        uploadedUrls = await uploadMultipleFiles(`rescue-verification/${tempId}`, filesToUpload);
      }

      await onConfirm({
        notes: notes.trim(),
        verificationPhotos: uploadedUrls,
      });
      onClose();
    } catch (err) {
      setError(err?.message || "Failed to upload verification photo. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  const busy = isUploading || isSubmitting;

  return (
    <div 
      role="dialog"
      aria-modal="true"
      aria-labelledby="rescue-verification-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl p-6 sm:p-8 space-y-6">
        
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <CheckCircle2 size={22} />
            </div>
            <div>
              <h3 id="rescue-verification-title" className="text-lg font-bold text-white">Resolve Emergency SOS</h3>
              <p className="text-xs text-slate-400">Submit on-scene verification proof & care summary</p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose} 
            disabled={busy}
            className="text-slate-400 hover:text-white rounded-xl p-1"
          >
            <X size={20} />
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Care summary notes */}
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
              Resolution Notes / Care Actions <span className="text-rose-400">*</span>
            </label>
            <textarea
              rows={3}
              required
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Describe the condition of the animal, immediate medical care administered, or transfer to veterinary facility (min 10 characters)..."
              className="w-full bg-slate-800/80 border border-slate-700 rounded-xl p-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Verification Photo Upload */}
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
              Verification Proof Photos (On-Scene / Rescued Animal)
            </label>
            
            {/* File drop zone */}
            <div className="relative border-2 border-dashed border-slate-700 hover:border-emerald-500/60 rounded-2xl p-4 text-center cursor-pointer transition-colors bg-slate-800/40">
              <input
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFileChange}
                disabled={busy}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <div className="flex flex-col items-center gap-2 text-slate-400">
                <Upload size={24} className="text-emerald-400" />
                <span className="text-xs">Click or drag & drop proof photos here</span>
                <span className="text-[10px] text-slate-500">JPG, PNG, WebP up to 5MB each</span>
              </div>
            </div>

            {/* Preview Selected Photos */}
            {photoItems.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {photoItems.map((item, i) => (
                  <div key={`item-${i}`} className="relative group w-14 h-14 rounded-xl overflow-hidden border border-slate-700 bg-black">
                    <img 
                      src={item.previewUrl} 
                      alt="Proof preview" 
                      className="w-full h-full object-cover" 
                    />
                    <button
                      type="button"
                      onClick={() => removePhotoItem(i)}
                      className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 text-rose-400 transition-opacity"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={busy}
              className="text-slate-400 hover:text-white rounded-xl"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={busy}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl px-5 flex items-center gap-2"
            >
              {busy ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Submitting...
                </>
              ) : (
                <>
                  <CheckCircle2 size={16} /> Verify & Complete Rescue
                </>
              )}
            </Button>
          </div>
        </form>

      </div>
    </div>
  );
};
