import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import api from "@/lib/api";
import { Flag, Loader2 } from "lucide-react";

export function ReportContentModal({
  isOpen,
  onClose,
  targetType,
  targetId,
  targetTitle = "content",
}) {
  const { toast } = useToast();
  const [reason, setReason] = useState("SPAM");
  const [details, setDetails] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!targetId || !targetType) return;

    setIsSubmitting(true);
    try {
      await api.post("/reports", {
        targetType,
        targetId,
        reason,
        details: details.trim() || undefined,
      });

      toast({
        title: "Report Submitted",
        description: "Thank you. Our moderation team will review this report promptly.",
      });
      setDetails("");
      setReason("SPAM");
      onClose();
    } catch (err) {
      const detail = err.response?.data?.detail || err.message || "Failed to submit report";
      toast({
        title: "Report Failed",
        description: detail,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md bg-[#0A0F1C] text-white border-slate-800">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base text-rose-400">
            <Flag className="w-4 h-4" /> Report {targetTitle}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <p className="text-xs text-slate-400">
            Help us keep AniResQ safe. If this content violates community guidelines, please report it below.
          </p>

          <div className="space-y-1.5">
            <label htmlFor="report-reason-select" className="text-xs font-bold text-slate-300">
              Reason for Report *
            </label>
            <select
              id="report-reason-select"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full bg-[#131B2C] border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
            >
              <option value="SPAM">Spam or Advertisement</option>
              <option value="FAKE">Fake or Fabricated Incident</option>
              <option value="ABUSE">Animal Cruelty or Abuse</option>
              <option value="PRIVACY">Privacy Violation / Doxxing</option>
              <option value="OTHER">Other Community Guideline Breach</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="report-details-textarea" className="text-xs font-bold text-slate-300">
              Additional Details (Optional)
            </label>
            <textarea
              id="report-details-textarea"
              rows={3}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              maxLength={1000}
              placeholder="Provide any relevant context for the moderation team..."
              className="w-full bg-[#131B2C] border border-slate-800 rounded-xl p-2.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-rose-500 resize-none"
            />
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isSubmitting}
              className="border-slate-700 text-slate-300 hover:bg-slate-800"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting}
              className="bg-rose-600 hover:bg-rose-500 text-white font-bold"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> Submitting...
                </>
              ) : (
                "Submit Report"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
