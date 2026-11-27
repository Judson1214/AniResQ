import { Link } from "react-router-dom";
import { AlertTriangle, ArrowRight } from "lucide-react";

export function EmergencyNoticeBanner() {
  return (
    <div
      role="region"
      aria-label="Emergency notice"
      className="bg-amber-500/15 border-b border-amber-500/30 text-amber-300 px-4 py-2.5 text-xs font-medium flex flex-wrap items-center justify-center gap-2 text-center"
    >
      <div className="flex items-center gap-1.5 font-bold">
        <AlertTriangle size={14} className="text-amber-400 shrink-0" />
        <span>Emergency Notice:</span>
      </div>
      <span>AniResQ is an asynchronous community platform and not an emergency response service.</span>
      <Link
        to="/safety"
        className="font-bold underline hover:text-white inline-flex items-center gap-0.5 ml-1 transition"
      >
        View Safety Protocols & Helplines <ArrowRight size={12} />
      </Link>
    </div>
  );
}
