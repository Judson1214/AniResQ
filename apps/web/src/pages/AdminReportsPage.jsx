import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { UserRole } from "@aniresq/shared-types";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import api from "@/lib/api";
import { formatDateTime } from "@/lib/utils";
import {
  ShieldAlert,
  ArrowLeft,
  Filter,
  Loader2,
  CheckCircle2,
  XCircle,
  Eye,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";

const STATUS_BADGES = {
  OPEN: "bg-rose-500/15 text-rose-400 border-rose-500/30",
  REVIEWED: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  ACTIONED: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  DISMISSED: "bg-slate-500/15 text-slate-400 border-slate-500/30",
};

export default function AdminReportsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedStatus, setSelectedStatus] = useState("OPEN");

  const { data: reports = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ["admin-content-reports", selectedStatus],
    queryFn: async () => {
      const url = selectedStatus === "ALL" ? "/reports" : `/reports?status=${selectedStatus}`;
      const res = await api.get(url);
      return res.data;
    },
    enabled: user?.role === UserRole.ADMIN,
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }) => {
      const res = await api.patch(`/reports/${id}`, { status });
      return res.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries(["admin-content-reports"]);
      toast({
        title: "Report Updated",
        description: `Report marked as ${variables.status}`,
      });
    },
    onError: (err) => {
      toast({
        title: "Action Failed",
        description: err.response?.data?.detail || err.message || "Failed to update report status",
        variant: "destructive",
      });
    },
  });

  if (user && user.role !== UserRole.ADMIN) {
    return (
      <DashboardLayout>
        <div className="p-8 text-center text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-2xl">
          <AlertTriangle className="w-10 h-10 mx-auto mb-2 text-rose-400" />
          <h2 className="text-lg font-bold">Unauthorized Access</h2>
          <p className="text-xs text-slate-400 mt-1">You do not have administrative clearance to access Content Moderation Reports.</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Link to="/admin" className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition">
                <ArrowLeft size={16} />
              </Link>
              <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
                <ShieldAlert className="w-6 h-6 text-rose-500" /> Content Moderation Reports
              </h1>
            </div>
            <p className="text-xs text-slate-400 pl-7">
              Review and act on user-submitted flags for spam, fake incidents, abuse, and privacy violations.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
              className="bg-slate-900 border-slate-800 text-slate-300 hover:text-white text-xs gap-1.5"
            >
              <RefreshCw size={13} className={isFetching ? "animate-spin" : ""} /> Refresh
            </Button>
          </div>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-3">
          <span className="text-xs text-slate-500 font-bold uppercase tracking-wider mr-2 flex items-center gap-1">
            <Filter size={12} /> Status:
          </span>
          {["OPEN", "REVIEWED", "ACTIONED", "DISMISSED", "ALL"].map((st) => (
            <button
              key={st}
              onClick={() => setSelectedStatus(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                selectedStatus === st
                  ? "bg-rose-600 text-white shadow-lg shadow-rose-600/20"
                  : "bg-slate-900/60 text-slate-400 hover:text-white border border-slate-800 hover:border-slate-700"
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        {/* Reports Content */}
        <Card className="bg-[#0A0F1C] border-slate-800 text-white overflow-hidden">
          <CardHeader className="py-4 px-6 border-b border-slate-800 bg-slate-900/30">
            <CardTitle className="text-sm font-bold flex items-center justify-between text-slate-300">
              <span>Reports Queue ({reports.length})</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-12 text-center text-slate-400 flex items-center justify-center gap-2 text-xs">
                <Loader2 className="w-4 h-4 animate-spin text-rose-500" /> Loading moderation reports...
              </div>
            ) : reports.length === 0 ? (
              <div className="p-12 text-center text-slate-500 text-xs">
                No reports found matching status &quot;{selectedStatus}&quot;.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 bg-[#131B2C]/40 text-slate-400 font-bold uppercase tracking-wider text-[11px]">
                      <th className="py-3 px-4">Created</th>
                      <th className="py-3 px-4">Target Type</th>
                      <th className="py-3 px-4">Target ID</th>
                      <th className="py-3 px-4">Reason</th>
                      <th className="py-3 px-4">Details</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-6 text-right">Moderation Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {reports.map((report) => (
                      <tr key={report.id} className="hover:bg-slate-900/40 transition-colors">
                        <td className="py-3 px-4 text-slate-400 whitespace-nowrap">
                          {formatDateTime(report.createdAt)}
                        </td>
                        <td className="py-3 px-4 font-bold text-white">
                          <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-200 border border-slate-700">
                            {report.targetType}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono text-[11px] text-slate-400 max-w-[120px] truncate" title={report.targetId}>
                          {report.targetId}
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-bold text-rose-400">{report.reason}</span>
                        </td>
                        <td className="py-3 px-4 text-slate-300 max-w-[200px] truncate" title={report.details || ""}>
                          {report.details || <span className="text-slate-600">—</span>}
                        </td>
                        <td className="py-3 px-4">
                          <Badge className={STATUS_BADGES[report.status] || "bg-slate-800"}>
                            {report.status}
                          </Badge>
                        </td>
                        <td className="py-3 px-6 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            {report.status !== "REVIEWED" && (
                              <button
                                onClick={() => updateStatusMutation.mutate({ id: report.id, status: "REVIEWED" })}
                                disabled={updateStatusMutation.isPending}
                                className="px-2 py-1 rounded bg-amber-500/10 hover:bg-amber-500 text-amber-400 hover:text-white border border-amber-500/20 text-[11px] font-bold transition inline-flex items-center gap-1"
                                title="Mark as Reviewed"
                              >
                                <Eye size={11} /> Review
                              </button>
                            )}
                            {report.status !== "ACTIONED" && (
                              <button
                                onClick={() => updateStatusMutation.mutate({ id: report.id, status: "ACTIONED" })}
                                disabled={updateStatusMutation.isPending}
                                className="px-2 py-1 rounded bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-white border border-emerald-500/20 text-[11px] font-bold transition inline-flex items-center gap-1"
                                title="Mark as Actioned"
                              >
                                <CheckCircle2 size={11} /> Action
                              </button>
                            )}
                            {report.status !== "DISMISSED" && (
                              <button
                                onClick={() => updateStatusMutation.mutate({ id: report.id, status: "DISMISSED" })}
                                disabled={updateStatusMutation.isPending}
                                className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 text-[11px] font-bold transition inline-flex items-center gap-1"
                                title="Dismiss Report"
                              >
                                <XCircle size={11} /> Dismiss
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
