import { useState } from "react";
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
  const [photoFiles, setPhotoFiles] = useState([]);
  const [photoUrls, setPhotoUrls] = useState([]);
  const [manualUrl, setManualUrl] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleFileChange = (e) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      setPhotoFiles((prev) => [...prev, ...files]);
    }
  };

  const handleAddManualUrl = () => {
    if (!manualUrl.trim()) return;
    try {
      const parsed = new URL(manualUrl.trim());
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        setError("Photo URL must start with http:// or https://");
        return;
      }
      setPhotoUrls((prev) => [...prev, manualUrl.trim()]);
      setManualUrl("");
      setError("");
    } catch {
      setError("Please enter a valid URL (e.g. https://images.unsplash.com/...)");
    }
  };

  const removeFile = (index) => {
    setPhotoFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const removeUrl = (index) => {
    setPhotoUrls((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    try {
      setIsUploading(true);
      let uploadedUrls = [...photoUrls];

      if (photoFiles.length > 0) {
        const tempId = crypto.randomUUID();
        const urls = await uploadMultipleFiles(`rescue-verification/${tempId}`, photoFiles);
        uploadedUrls = [...uploadedUrls, ...urls];
      }

      await onConfirm({
        notes: notes.trim() || "Emergency rescue completed and animal safely secured.",
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl p-6 sm:p-8 space-y-6">
        
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <CheckCircle2 size={22} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Resolve Emergency SOS</h3>
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
              Resolution Notes / Care Actions
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="E.g., Animal safely retrieved, first aid applied, transported to partner veterinary clinic."
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
                accept="image/*"
                onChange={handleFileChange}
                disabled={busy}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <div className="flex flex-col items-center gap-2 text-slate-400">
                <Upload size={24} className="text-emerald-400" />
                <span className="text-xs">Click or drag & drop photos here</span>
                <span className="text-[10px] text-slate-500">JPG, PNG, WebP up to 10MB</span>
              </div>
            </div>

            {/* Optional URL input fallback */}
            <div className="mt-3 flex gap-2">
              <input
                type="url"
                value={manualUrl}
                onChange={(e) => setManualUrl(e.target.value)}
                placeholder="Or paste verification image URL"
                className="flex-1 bg-slate-800/80 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddManualUrl}
                className="border-slate-700 text-xs rounded-xl"
              >
                Add URL
              </Button>
            </div>

            {/* Preview Selected Photos */}
            {(photoFiles.length > 0 || photoUrls.length > 0) && (
              <div className="mt-3 flex flex-wrap gap-2">
                {photoFiles.map((file, i) => (
                  <div key={`file-${i}`} className="relative group w-14 h-14 rounded-xl overflow-hidden border border-slate-700 bg-black">
                    <img 
                      src={URL.createObjectURL(file)} 
                      alt="Proof" 
                      className="w-full h-full object-cover" 
                    />
                    <button
                      type="button"
                      onClick={() => removeFile(i)}
                      className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 text-rose-400 transition-opacity"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
                {photoUrls.map((url, i) => (
                  <div key={`url-${i}`} className="relative group w-14 h-14 rounded-xl overflow-hidden border border-slate-700 bg-black">
                    <img 
                      src={url} 
                      alt="Proof" 
                      className="w-full h-full object-cover" 
                    />
                    <button
                      type="button"
                      onClick={() => removeUrl(i)}
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
