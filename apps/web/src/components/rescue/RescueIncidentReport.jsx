import { 
  FileText, 
  Printer, 
  X, 
  ShieldCheck, 
  MapPin, 
  Calendar, 
  User, 
  Clock, 
  CheckCircle2 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/utils";

export const RescueIncidentReport = ({ rescue, timeline = [], onClose }) => {
  if (!rescue) return null;

  const handlePrint = () => {
    window.print();
  };

  const caseId = `SOS-${rescue.id ? rescue.id.slice(0, 8).toUpperCase() : "UNKNOWN"}`;
  const generatedAt = new Date().toISOString();

  const maskId = (id) => {
    if (!id || typeof id !== "string") return "Anonymous";
    if (id.length <= 10) return id;
    return `${id.slice(0, 4)}...${id.slice(-4)}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-sm overflow-y-auto print:p-0 print:bg-white print:static">
      <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl overflow-hidden my-4 sm:my-8 print:border-none print:shadow-none print:m-0 print:max-w-none print:bg-white print:text-black">
        
        {/* Top Control Bar (Hidden during print) */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/80 print:hidden">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <FileText size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Emergency SOS Incident Case Report</h2>
              <p className="text-xs text-slate-400 font-mono">Case #{caseId}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button 
              onClick={handlePrint}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold flex items-center gap-2 rounded-xl text-sm h-9 px-4"
            >
              <Printer size={16} /> Print / Save PDF
            </Button>
            <Button 
              variant="ghost" 
              onClick={onClose}
              className="text-slate-400 hover:text-white rounded-xl h-9 w-9 p-0"
            >
              <X size={20} />
            </Button>
          </div>
        </div>

        {/* Printable Report Document Body */}
        <div className="p-8 sm:p-12 space-y-8 bg-slate-900 text-slate-100 print:bg-white print:text-black print:p-6">
          
          {/* Official Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b-2 border-slate-700 print:border-black gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-2xl tracking-wider text-emerald-400 print:text-emerald-700">AniResQ</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-bold uppercase tracking-wider border border-emerald-500/20 print:border-black print:text-black">
                  Incident Summary
                </span>
              </div>
              <h1 className="text-2xl font-black mt-1 text-white print:text-black">EMERGENCY INCIDENT SUMMARY</h1>
              <p className="text-xs text-slate-400 print:text-gray-600">Animal Rescue & Response Record</p>
            </div>
            <div className="text-left sm:text-right font-mono text-xs text-slate-300 print:text-black space-y-1">
              <div><span className="text-slate-500 print:text-gray-500">CASE NUMBER:</span> <span className="font-bold">{caseId}</span></div>
              <div><span className="text-slate-500 print:text-gray-500">GENERATED:</span> {formatDateTime(generatedAt)}</div>
              <div><span className="text-slate-500 print:text-gray-500">NETWORK STATUS:</span> <span className="text-emerald-400 print:text-emerald-700 font-bold">{rescue.status}</span></div>
            </div>
          </div>

          {/* Incident Overview Card */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-800/40 print:bg-gray-50 p-6 rounded-2xl border border-slate-700/60 print:border-gray-200">
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-400 print:text-gray-500 uppercase tracking-wider">Incident Overview</h3>
              <div className="text-lg font-bold text-white print:text-black">{rescue.title}</div>
              <p className="text-sm text-slate-300 print:text-gray-700 whitespace-pre-wrap">{rescue.description}</p>
              <div className="flex flex-wrap items-center gap-2 pt-2">
                <span className="text-xs px-2.5 py-1 rounded-lg bg-slate-700 text-slate-200 print:bg-gray-200 print:text-black font-semibold">
                  Species: {rescue.species}
                </span>
                <span className={`text-xs px-2.5 py-1 rounded-lg font-bold uppercase ${
                  rescue.severity === "CRITICAL" ? "bg-rose-500/20 text-rose-300 print:text-rose-800" :
                  rescue.severity === "HIGH" ? "bg-amber-500/20 text-amber-300 print:text-amber-800" :
                  "bg-blue-500/20 text-blue-300 print:text-blue-800"
                }`}>
                  Priority: {rescue.severity}
                </span>
                <span className="text-xs px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 print:text-emerald-800 font-bold uppercase">
                  Status: {rescue.status}
                </span>
              </div>
            </div>

            <div className="space-y-3 md:border-l md:border-slate-700 md:pl-6 print:border-gray-300">
              <h3 className="text-xs font-bold text-slate-400 print:text-gray-500 uppercase tracking-wider">Location & Geo-Coordinates</h3>
              <div className="flex items-start gap-2 text-sm text-slate-200 print:text-black">
                <MapPin className="w-4 h-4 text-emerald-400 print:text-emerald-700 shrink-0 mt-0.5" />
                <span>{rescue.address || "Street Address Not Provided"}</span>
              </div>
              <div className="bg-slate-900/60 print:bg-white p-3 rounded-xl border border-slate-800 print:border-gray-300 font-mono text-xs space-y-1">
                <div><span className="text-slate-500 print:text-gray-500">LATITUDE:</span> {rescue.location?.latitude ?? "N/A"}</div>
                <div><span className="text-slate-500 print:text-gray-500">LONGITUDE:</span> {rescue.location?.longitude ?? "N/A"}</div>
              </div>
              <div className="pt-2 text-xs text-slate-400 print:text-gray-500 flex items-center gap-1.5">
                <Calendar size={14} /> Reported: {formatDateTime(rescue.createdAt)}
              </div>
            </div>
          </div>

          {/* Involved Personnel */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-slate-800/30 print:bg-gray-50 border border-slate-700/50 print:border-gray-200">
              <div className="flex items-center gap-2 mb-2 text-xs font-bold text-slate-400 print:text-gray-500 uppercase tracking-wider">
                <User size={14} className="text-emerald-400 print:text-emerald-700" /> Reporting Citizen
              </div>
              <div className="text-sm font-semibold text-white print:text-black">{rescue.reporterName || "Citizen Reporter"}</div>
              <div className="text-xs text-slate-400 print:text-gray-500 font-mono mt-0.5">ID: {maskId(rescue.reporterId)}</div>
            </div>
            
            <div className="p-4 rounded-xl bg-slate-800/30 print:bg-gray-50 border border-slate-700/50 print:border-gray-200">
              <div className="flex items-center gap-2 mb-2 text-xs font-bold text-slate-400 print:text-gray-500 uppercase tracking-wider">
                <ShieldCheck size={14} className="text-blue-400 print:text-blue-700" /> Assigned Unit / Responder
              </div>
              <div className="text-sm font-semibold text-white print:text-black">
                {rescue.assignedTo ? (rescue.assignedName || "Assigned Responder") : "Unassigned / Open Pool"}
              </div>
              <div className="text-xs text-slate-400 print:text-gray-500 font-mono mt-0.5">
                {rescue.assignedTo ? `UID: ${maskId(rescue.assignedTo)}` : "Status: Open Pool"}
              </div>
            </div>
          </div>

          {/* Response Timeline Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-white print:text-black flex items-center gap-2 uppercase tracking-wider">
              <Clock size={16} className="text-emerald-400 print:text-emerald-700" />
              Verified Chronological Response Timeline
            </h3>

            {timeline && timeline.length > 0 ? (
              <div className="relative border-l-2 border-slate-700 print:border-gray-300 ml-4 space-y-4">
                {timeline.map((event, idx) => (
                  <div key={event.id || idx} className="relative pl-6">
                    <div className="absolute -left-[7px] top-1.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-slate-900 print:border-white" />
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-400 print:text-gray-500 mb-1">
                      <span className="font-bold text-emerald-400 print:text-emerald-800 uppercase">{event.status}</span>
                      <span>{formatDateTime(event.createdAt)}</span>
                    </div>
                    <p className="text-sm font-medium text-slate-200 print:text-black">{event.message}</p>
                    <p className="text-xs text-slate-500 print:text-gray-500 mt-0.5">By: {event.updatedByName || "Dispatcher"}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 bg-slate-800/20 print:bg-gray-50 rounded-xl text-center text-xs text-slate-400 print:text-gray-500">
                Initial dispatch logged. Additional timeline events will sync automatically.
              </div>
            )}
          </div>

          {/* Photo Evidence Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-white print:text-black flex items-center gap-2 uppercase tracking-wider">
              <CheckCircle2 size={16} className="text-emerald-400 print:text-emerald-700" />
              Photographic Evidence & Verification Proof
            </h3>

            {rescue.photoUrls && rescue.photoUrls.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {rescue.photoUrls.map((url, i) => (
                  <div key={i} className="group relative rounded-xl overflow-hidden border border-slate-700 print:border-gray-300 bg-black aspect-square">
                    <img 
                      src={url} 
                      alt={`Evidence ${i + 1}`} 
                      className="w-full h-full object-cover" 
                    />
                    <div className="absolute bottom-0 left-0 right-0 bg-black/70 px-2 py-1 text-[10px] text-slate-300 font-mono truncate">
                      {i === 0 ? "Initial Alert Photo" : `Verification Proof #${i}`}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 bg-slate-800/20 print:bg-gray-50 rounded-xl text-center text-xs text-slate-400 print:text-gray-500">
                No photographic evidence uploaded for this incident.
              </div>
            )}
          </div>

          {/* Incident Verification & Record Summary Block */}
          <div className="pt-8 border-t border-slate-700/80 print:border-gray-300 flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full border-2 border-dashed border-emerald-500/50 flex items-center justify-center text-emerald-400 print:text-emerald-700 print:border-black">
                <ShieldCheck size={32} />
              </div>
              <div>
                <div className="text-xs font-bold text-emerald-400 print:text-emerald-800 uppercase tracking-widest">
                  Incident Verification Summary
                </div>
                <div className="text-xs text-slate-400 print:text-gray-600 mt-0.5">
                  Generated from AniResQ system record {caseId}
                </div>
                <div className="text-[10px] font-mono text-slate-500 print:text-gray-500">
                  SYSTEM RECORD ID: {rescue.id}
                </div>
              </div>
            </div>

            <div className="text-center sm:text-right">
              <div className="w-48 border-b border-slate-600 print:border-black mb-1 mx-auto sm:ml-auto" />
              <p className="text-xs font-bold text-slate-300 print:text-black">Recorded by Responder / Dispatcher</p>
              <p className="text-[10px] text-slate-500 print:text-gray-500">AniResQ Community Rescue Network</p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
