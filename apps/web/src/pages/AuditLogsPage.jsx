import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { UserRole } from "@aniresq/shared-types";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { getAuditLogs } from "@/services/audit.service";
import { formatDateTime } from "@/lib/utils";
import { 
  ShieldCheck, 
  ArrowLeft, 
  Search, 
  Filter, 
  Loader2, 
  Clock, 
  User, 
  FileText, 
  ChevronDown, 
  ChevronUp, 
  RefreshCw 
} from "lucide-react";

const ACTION_COLORS = {
  ROLE_CHANGE: "bg-purple-500/10 text-purple-400 border-purple-500/30",
  ROLE_REQUEST_DECLINED: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  RESCUE_STATUS_UPDATE: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  RESCUE_ASSIGNED: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  ADOPTION_STATUS_UPDATE: "bg-teal-500/10 text-teal-400 border-teal-500/30",
};

export default function AuditLogsPage() {
  const { user } = useAuth();
  const [selectedAction, setSelectedAction] = useState("ALL");
  const [selectedEntity, setSelectedEntity] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedLogId, setExpandedLogId] = useState(null);

  const { data: logs = [], isLoading, isFetching, refetch } = useQuery({
    queryKey: ["audit-logs", selectedAction, selectedEntity],
    queryFn: () => {
      const params = {};
      if (selectedAction !== "ALL") params.action = selectedAction;
      if (selectedEntity !== "ALL") params.entity_type = selectedEntity;
      params.limit = 100;
      return getAuditLogs(params);
    },
    enabled: user?.role === UserRole.ADMIN,
  });

  const filteredLogs = useMemo(() => {
    if (!searchQuery.trim()) return logs;
    const q = searchQuery.toLowerCase();
    return logs.filter(
      (log) =>
        log.entityId?.toLowerCase().includes(q) ||
        log.performedBy?.toLowerCase().includes(q) ||
        log.action?.toLowerCase().includes(q) ||
        log.entityType?.toLowerCase().includes(q)
    );
  }, [logs, searchQuery]);

  if (user && user.role !== UserRole.ADMIN) {
    return <Navigate to="/unauthorized" replace />;
  }

  const toggleExpand = (id) => {
    setExpandedLogId((prev) => (prev === id ? null : id));
  };

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-300 pb-16">
        
        {/* Navigation & Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-6">
          <div className="space-y-1">
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-white transition-colors mb-2"
            >
              <ArrowLeft size={14} /> Back to Command Center
            </Link>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                <ShieldCheck size={22} />
              </div>
              <div>
                <h1 className="text-3xl font-black text-white tracking-tight">Security Audit Logs</h1>
                <p className="text-sm text-slate-400">
                  Immutable ledger of clearance decisions, dispatch assignments, and platform mutations.
                </p>
              </div>
            </div>
          </div>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={14} className={isFetching ? "animate-spin" : ""} />
            Refresh Logs
          </button>
        </div>

        {/* Filters and Search Bar */}
        <div className="grid gap-4 md:grid-cols-3">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
            <Input
              type="text"
              placeholder="Search by User ID, Entity ID, or Admin..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-[#0A0F1C] border-slate-800 text-white rounded-xl focus:border-purple-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter size={16} className="text-slate-400 shrink-0" />
            <select
              value={selectedAction}
              onChange={(e) => setSelectedAction(e.target.value)}
              aria-label="Filter by action"
              className="w-full bg-[#0A0F1C] border border-slate-800 text-slate-200 text-sm rounded-xl px-3 py-2.5 focus:border-purple-500 focus:outline-none"
            >
              <option value="ALL">All Actions</option>
              <option value="ROLE_CHANGE">Role Changes</option>
              <option value="ROLE_REQUEST_DECLINED">Declined Role Requests</option>
              <option value="RESCUE_ASSIGNED">Rescue Dispatches</option>
              <option value="RESCUE_STATUS_UPDATE">Rescue Status Updates</option>
              <option value="ADOPTION_STATUS_UPDATE">Adoption Decisions</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={selectedEntity}
              onChange={(e) => setSelectedEntity(e.target.value)}
              aria-label="Filter by entity type"
              className="w-full bg-[#0A0F1C] border border-slate-800 text-slate-200 text-sm rounded-xl px-3 py-2.5 focus:border-purple-500 focus:outline-none"
            >
              <option value="ALL">All Entity Types</option>
              <option value="USER">User Accounts</option>
              <option value="RESCUE">Emergency Rescues</option>
              <option value="ADOPTION_APPLICATION">Adoption Applications</option>
            </select>
          </div>
        </div>

        {/* Audit Log Table / Stream */}
        <Card className="border-slate-800 bg-[#0A0F1C] shadow-2xl rounded-3xl overflow-hidden">
          <CardHeader className="border-b border-slate-800 py-4 px-6 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-bold text-slate-300">
              Audit Event Stream ({filteredLogs.length} Records)
            </CardTitle>
            {isFetching && (
              <span className="text-xs text-purple-400 flex items-center gap-1.5">
                <Loader2 size={12} className="animate-spin" /> Syncing...
              </span>
            )}
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-500">
                <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
                <p className="text-sm font-medium">Loading audit history...</p>
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="py-20 text-center text-slate-500 text-sm">
                No audit log records match the current filters.
              </div>
            ) : (
              <div className="divide-y divide-slate-800/80">
                {filteredLogs.map((log) => {
                  const badgeClass = ACTION_COLORS[log.action] || "bg-slate-800 text-slate-300 border-slate-700";
                  const isExpanded = expandedLogId === log.id;

                  return (
                    <div key={log.id} className="p-5 hover:bg-slate-900/40 transition-colors">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-start gap-3.5">
                          <div className="p-2 rounded-xl bg-slate-800/60 border border-slate-700 text-slate-300 mt-0.5">
                            <FileText size={16} />
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2.5 flex-wrap">
                              <Badge className={`${badgeClass} text-xs font-bold border px-2.5 py-0.5`}>
                                {log.action}
                              </Badge>
                              <span className="text-xs text-slate-400 font-mono">
                                Entity: <strong className="text-slate-200">{log.entityType}</strong> ({log.entityId?.slice(0, 8)}...)
                              </span>
                            </div>
                            <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap">
                              <span className="flex items-center gap-1">
                                <User size={13} className="text-slate-400" />
                                Performed By: <code className="text-slate-300">{log.performedBy?.slice(0, 8)}</code>
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock size={13} className="text-slate-400" />
                                {formatDateTime(log.createdAt)}
                              </span>
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={() => toggleExpand(log.id)}
                          className="self-start md:self-center px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700 flex items-center gap-1.5 transition-colors"
                        >
                          {isExpanded ? (
                            <>
                              Hide Diff <ChevronUp size={14} />
                            </>
                          ) : (
                            <>
                              View Diff <ChevronDown size={14} />
                            </>
                          )}
                        </button>
                      </div>

                      {/* Expandable JSON / Mutation Diff */}
                      {isExpanded && (
                        <div className="mt-4 pt-4 border-t border-slate-800/60 grid md:grid-cols-2 gap-4 text-xs font-mono animate-in fade-in">
                          <div className="p-3.5 rounded-xl bg-black/40 border border-slate-800 space-y-1.5">
                            <span className="text-amber-400/90 font-bold tracking-wider uppercase text-[11px] block">
                              Previous State (old_value)
                            </span>
                            <pre className="text-slate-300 overflow-x-auto whitespace-pre-wrap">
                              {log.oldValue ? JSON.stringify(log.oldValue, null, 2) : "null"}
                            </pre>
                          </div>
                          <div className="p-3.5 rounded-xl bg-black/40 border border-slate-800 space-y-1.5">
                            <span className="text-emerald-400/90 font-bold tracking-wider uppercase text-[11px] block">
                              Updated State (new_value)
                            </span>
                            <pre className="text-slate-300 overflow-x-auto whitespace-pre-wrap">
                              {log.newValue ? JSON.stringify(log.newValue, null, 2) : "null"}
                            </pre>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
