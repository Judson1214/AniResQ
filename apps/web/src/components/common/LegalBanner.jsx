export function LegalBanner() {
  if (import.meta.env.VITE_LEGAL_REVIEWED === "true") {
    return null;
  }
  return (
    <div
      role="alert"
      className="bg-amber-500/15 border-b border-amber-500/30 text-amber-300 px-4 py-3 text-center text-sm font-semibold flex items-center justify-center gap-2"
    >
      <span>⚠️ TEMPLATE: must be reviewed by a qualified lawyer before launch</span>
    </div>
  );
}
