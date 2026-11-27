import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { getSystemSettings, updateSystemSettings } from "@/services/settings.service";
import {
  Settings,
  ShieldCheck,
  MapPin,
  Bell,
  Cpu,
  Database,
  Lock,
  ArrowRight,
  Loader2,
  CheckCircle2,
  RotateCcw
} from "lucide-react";

export default function SystemSettingsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: settings, isLoading, error } = useQuery({
    queryKey: ["system-settings"],
    queryFn: getSystemSettings,
  });

  const [formData, setFormData] = useState({
    defaultDispatchRadiusKm: 15,
    maxBroadcastCeilingKm: 100,
    autoAlertHighSeverity: true,
    autoDispatchEnabled: true,
  });

  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (settings) {
      setFormData({
        defaultDispatchRadiusKm: settings.defaultDispatchRadiusKm ?? 15,
        maxBroadcastCeilingKm: settings.maxBroadcastCeilingKm ?? 100,
        autoAlertHighSeverity: settings.autoAlertHighSeverity ?? true,
        autoDispatchEnabled: settings.autoDispatchEnabled ?? true,
      });
      setIsDirty(false);
    }
  }, [settings]);

  const mutation = useMutation({
    mutationFn: (updatedPayload) => updateSystemSettings(updatedPayload),
    onSuccess: () => {
      queryClient.invalidateQueries(["system-settings"]);
      setIsDirty(false);
      toast({
        title: "Settings Saved",
        description: "Global dispatch and routing preferences have been updated successfully.",
      });
    },
    onError: (err) => {
      toast({
        title: "Failed to Update Settings",
        description: err.response?.data?.detail || err.message || "An error occurred while saving system settings.",
        variant: "destructive",
      });
    },
  });

  if (error?.response?.status === 403) {
    return (
      <DashboardLayout>
        <div className="max-w-4xl mx-auto my-12 p-8 text-center bg-slate-900 border border-amber-500/30 rounded-xl space-y-4">
          <Lock className="w-12 h-12 text-amber-500 mx-auto" />
          <h2 className="text-xl font-bold text-white">Access Restricted</h2>
          <p className="text-slate-400">
            You do not have administrative clearance to view or edit System Settings.
          </p>
        </div>
      </DashboardLayout>
    );
  }

  const handleNumberChange = (field, value) => {
    const num = parseInt(value, 10);
    setFormData((prev) => ({
      ...prev,
      [field]: isNaN(num) ? 0 : num,
    }));
    setIsDirty(true);
  };

  const handleToggle = (field) => {
    setFormData((prev) => ({
      ...prev,
      [field]: !prev[field],
    }));
    setIsDirty(true);
  };

  const handleReset = () => {
    if (settings) {
      setFormData({
        defaultDispatchRadiusKm: settings.defaultDispatchRadiusKm ?? 15,
        maxBroadcastCeilingKm: settings.maxBroadcastCeilingKm ?? 100,
        autoAlertHighSeverity: settings.autoAlertHighSeverity ?? true,
        autoDispatchEnabled: settings.autoDispatchEnabled ?? true,
      });
      setIsDirty(false);
    }
  };

  const handleSave = (e) => {
    e.preventDefault();
    mutation.mutate(formData);
  };

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-10 max-w-6xl mx-auto space-y-8">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <Settings size={22} />
              </div>
              <h1 className="text-3xl font-black text-white tracking-tight">System Settings</h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                Active System Policy
              </span>
            </div>
            <p className="text-slate-400 text-sm mt-1">
              Live configuration for automated rescue dispatch boundaries, spatial ceilings, and responder alert heuristics.
            </p>
          </div>

          {isDirty && (
            <div className="flex items-center gap-3 animate-in fade-in">
              <button
                type="button"
                onClick={handleReset}
                disabled={mutation.isPending}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl border border-slate-700 transition-colors flex items-center gap-1.5"
              >
                <RotateCcw size={14} />
                Revert
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={mutation.isPending}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-600/30 transition-all flex items-center gap-2"
              >
                {mutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                Save Changes
              </button>
            </div>
          )}
        </div>

        {/* Active Policy Status Banner */}
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5 text-emerald-400" />
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-emerald-200">Active Enforcement</h3>
            <p className="text-xs text-emerald-300/80 leading-relaxed">
              Spatial ceilings and responder alert toggles configured here are stored in <code>system_settings</code> and actively govern live rescue alert dispatch and volunteer direct claims.
            </p>
          </div>
        </div>

        {/* Telemetry Overview Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 rounded-2xl bg-[#0A0F1C] border border-slate-800">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider">Environment</span>
              <Cpu size={16} className="text-emerald-400" />
            </div>
            <p className="text-lg font-black text-white truncate">{settings?.environment || "Localhost"}</p>
            <p className="text-xs text-slate-500 mt-0.5">Version {settings?.platformVersion || "1.0.0"}</p>
          </div>

          <div className="p-5 rounded-2xl bg-[#0A0F1C] border border-slate-800">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider">Active Admins</span>
              <ShieldCheck size={16} className="text-rose-400" />
            </div>
            <p className="text-2xl font-black text-rose-400">{settings?.activeAdminCount || 1}</p>
            <p className="text-xs text-slate-500 mt-0.5">Full clearance credentials</p>
          </div>

          <div className="p-5 rounded-2xl bg-[#0A0F1C] border border-slate-800">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider">Registered Operators</span>
              <MapPin size={16} className="text-purple-400" />
            </div>
            <p className="text-2xl font-black text-purple-400">{settings?.totalOperatorsCount || 0}</p>
            <p className="text-xs text-slate-500 mt-0.5">Volunteers, Shelters, Vets</p>
          </div>

          <div className="p-5 rounded-2xl bg-[#0A0F1C] border border-slate-800">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider">Audit Integrity</span>
              <Database size={16} className="text-sky-400" />
            </div>
            <div className="flex items-center gap-1.5 text-sky-400 font-bold text-sm">
              <CheckCircle2 size={16} />
              <span>Append-Only</span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">Trigger-enforced ledger</p>
          </div>
        </div>

        {/* Settings Form Grid */}
        <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Dispatch & Spatial Coverage Card */}
          <Card className="border-slate-800 bg-[#0A0F1C] shadow-2xl rounded-3xl overflow-hidden">
            <CardHeader className="border-b border-slate-800 bg-[#0A0F1C]/80 py-5 px-6 flex flex-row items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <MapPin size={18} />
              </div>
              <div>
                <CardTitle className="text-base font-bold text-white">Dispatch & Spatial Ceilings</CardTitle>
                <p className="text-xs text-slate-400 mt-0.5">Define geographical thresholds for automated rescue routing.</p>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              {isLoading ? (
                <div className="py-8 flex items-center justify-center gap-2 text-slate-500 text-sm">
                  <Loader2 className="w-4 h-4 animate-spin text-emerald-500" /> Loading configuration...
                </div>
              ) : (
                <>
                  <div>
                    <label className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 block flex items-center justify-between">
                      <span>Default Dispatch Radius (km)</span>
                      <span className="text-emerald-400 font-mono text-sm">{formData.defaultDispatchRadiusKm} km</span>
                    </label>
                    <input
                      type="range"
                      min="1"
                      max="100"
                      value={formData.defaultDispatchRadiusKm}
                      onChange={(e) => handleNumberChange("defaultDispatchRadiusKm", e.target.value)}
                      className="w-full accent-emerald-500 cursor-pointer"
                    />
                    <p className="text-xs text-slate-500 mt-1.5">
                      Baseline search distance applied when alerting active volunteer responders about nearby incidents.
                    </p>
                  </div>

                  <div className="pt-4 border-t border-slate-800">
                    <label className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 block flex items-center justify-between">
                      <span>Maximum Search Broadcast Ceiling (km)</span>
                      <span className="text-emerald-400 font-mono text-sm">{formData.maxBroadcastCeilingKm} km</span>
                    </label>
                    <input
                      type="range"
                      min="10"
                      max="300"
                      step="5"
                      value={formData.maxBroadcastCeilingKm}
                      onChange={(e) => handleNumberChange("maxBroadcastCeilingKm", e.target.value)}
                      className="w-full accent-emerald-500 cursor-pointer"
                    />
                    <p className="text-xs text-slate-500 mt-1.5">
                      Hard geographic limit for spatial candidate queries calculated via the Haversine database RPC.
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Automated Incident Routing Card */}
          <Card className="border-slate-800 bg-[#0A0F1C] shadow-2xl rounded-3xl overflow-hidden">
            <CardHeader className="border-b border-slate-800 bg-[#0A0F1C]/80 py-5 px-6 flex flex-row items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                <Bell size={18} />
              </div>
              <div>
                <CardTitle className="text-base font-bold text-white">Automated Incident Routing</CardTitle>
                <p className="text-xs text-slate-400 mt-0.5">Control automatic responder notification pipelines.</p>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              {isLoading ? (
                <div className="py-8 flex items-center justify-center gap-2 text-slate-500 text-sm">
                  <Loader2 className="w-4 h-4 animate-spin text-purple-500" /> Loading configuration...
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-bold text-white">Auto-Broadcast High Severity Incidents</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Instantly dispatches in-app notifications to responders in range when a CRITICAL or HIGH emergency is logged.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleToggle("autoAlertHighSeverity")}
                      className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors shrink-0 ${
                        formData.autoAlertHighSeverity ? "bg-emerald-500" : "bg-slate-700"
                      }`}
                    >
                      <div
                        className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                          formData.autoAlertHighSeverity ? "translate-x-6" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>

                  <div className="pt-4 border-t border-slate-800 flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-bold text-white">Enable Volunteer Direct Claim Workflow</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Permits verified volunteers to self-assign unassigned rescue requests from the live dispatch map.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleToggle("autoDispatchEnabled")}
                      className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors shrink-0 ${
                        formData.autoDispatchEnabled ? "bg-emerald-500" : "bg-slate-700"
                      }`}
                    >
                      <div
                        className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                          formData.autoDispatchEnabled ? "translate-x-6" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </form>

        {/* Security & Ledger Card */}
        <Card className="border-slate-800 bg-[#0A0F1C] shadow-2xl rounded-3xl overflow-hidden">
          <CardHeader className="border-b border-slate-800 bg-[#0A0F1C]/80 py-5 px-6 flex flex-row items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
                <Lock size={18} />
              </div>
              <div>
                <CardTitle className="text-base font-bold text-white">Security & Audit Controls</CardTitle>
                <p className="text-xs text-slate-400 mt-0.5">Review access controls and append-only platform mutations.</p>
              </div>
            </div>
            <Link
              to="/admin/audit-logs"
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 text-xs font-bold border border-purple-500/30 transition-colors"
            >
              <span>Inspect Audit Logs</span>
              <ArrowRight size={14} />
            </Link>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-2xl bg-[#131B2C] border border-slate-800">
                <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold mb-1">
                  <CheckCircle2 size={14} />
                  <span>Append-Only Triggers</span>
                </div>
                <p className="text-xs text-slate-400">
                  `trg_audit_logs_append_only` strictly raises exceptions on any `UPDATE` or `DELETE` across all roles.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-[#131B2C] border border-slate-800">
                <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold mb-1">
                  <CheckCircle2 size={14} />
                  <span>Transactional Clearance RPCs</span>
                </div>
                <p className="text-xs text-slate-400">
                  Role assignments and clearance declines execute atomically inside PostgreSQL stored procedures.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-[#131B2C] border border-slate-800">
                <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold mb-1">
                  <CheckCircle2 size={14} />
                  <span>Client Direct Mutation Revoke</span>
                </div>
                <p className="text-xs text-slate-400">
                  Direct PostgREST table writes are revoked for anon and authenticated users; all mutations route via backend.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
