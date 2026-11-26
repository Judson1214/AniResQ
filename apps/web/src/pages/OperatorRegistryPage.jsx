import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { getUsers, updateUserRole, declineRoleRequest } from "@/services/user.service";
import { formatDateTime } from "@/lib/utils";
import {
  Users,
  Search,
  Shield,
  ShieldAlert,
  UserCheck,
  X,
  Phone,
  Mail,
  MapPin,
  Calendar,
  AlertCircle,
  Loader2,
  RefreshCw,
  Edit2,
  CreditCard,
  ExternalLink
} from "lucide-react";

const ROLES = ["ALL", "VOLUNTEER", "NGO", "SHELTER", "VET", "CITIZEN", "ADMIN"];
const ASSIGNABLE_ROLES = ["CITIZEN", "VOLUNTEER", "NGO", "SHELTER", "VET", "ADMIN"];

export default function OperatorRegistryPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedRole, setSelectedRole] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [onlyPending, setOnlyPending] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [targetRole, setTargetRole] = useState("");
  const [adminConfirmText, setAdminConfirmText] = useState("");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  const { data: users = [], isLoading, isFetching, refetch } = useQuery({
    queryKey: ["operator-registry-users", selectedRole, onlyPending, searchQuery, page],
    queryFn: () => getUsers({
      role: selectedRole === "ALL" ? undefined : selectedRole,
      has_requested_role: onlyPending ? true : undefined,
      search: searchQuery.trim() || undefined,
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    }),
  });

  const roleMutation = useMutation({
    mutationFn: ({ uid, role }) => updateUserRole(uid, role),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries(["operator-registry-users"]);
      queryClient.invalidateQueries(["admin-users"]);
      setEditingUser(null);
      toast({
        title: "Role Updated Successfully",
        description: `Operator assigned role: ${variables.role}`,
      });
    },
    onError: (err) => {
      toast({
        title: "Role Update Failed",
        description: err.response?.data?.detail || err.message || "Could not update user role.",
        variant: "destructive",
      });
    },
  });

  const declineMutation = useMutation({
    mutationFn: (uid) => declineRoleRequest(uid),
    onSuccess: () => {
      queryClient.invalidateQueries(["operator-registry-users"]);
      queryClient.invalidateQueries(["admin-users"]);
      toast({
        title: "Request Declined",
        description: "The clearance request was declined. User's existing role is preserved.",
      });
    },
    onError: (err) => {
      toast({
        title: "Decline Action Failed",
        description: err.response?.data?.detail || err.message || "Failed to decline clearance request.",
        variant: "destructive",
      });
    },
  });

  // Filtered operators
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchesRole =
        selectedRole === "ALL" || (u.role && u.role.toUpperCase() === selectedRole);
      const matchesPending =
        !onlyPending || (u.requestedRole && u.requestedRole !== u.role);
      const term = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !term ||
        (u.displayName && u.displayName.toLowerCase().includes(term)) ||
        (u.email && u.email.toLowerCase().includes(term)) ||
        (u.phone && u.phone.toLowerCase().includes(term)) ||
        (u.id && u.id.toLowerCase().includes(term));

      return matchesRole && matchesPending && matchesSearch;
    });
  }, [users, selectedRole, onlyPending, searchQuery]);

  // Aggregate metrics
  const metrics = useMemo(() => {
    const total = users.length;
    const volunteers = users.filter((u) => u.role === "VOLUNTEER").length;
    const shelters = users.filter((u) => u.role === "SHELTER" || u.role === "NGO").length;
    const vets = users.filter((u) => u.role === "VET").length;
    const admins = users.filter((u) => u.role === "ADMIN").length;
    const pending = users.filter((u) => u.requestedRole && u.requestedRole !== u.role).length;

    return { total, volunteers, shelters, vets, admins, pending };
  }, [users]);

  const getRoleBadge = (role) => {
    switch (role) {
      case "ADMIN":
        return "bg-rose-500/10 text-rose-400 border-rose-500/20";
      case "VOLUNTEER":
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
      case "SHELTER":
      case "NGO":
        return "bg-purple-500/10 text-purple-400 border-purple-500/20";
      case "VET":
        return "bg-sky-500/10 text-sky-400 border-sky-500/20";
      default:
        return "bg-slate-800 text-slate-400 border-slate-700";
    }
  };

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-10 max-w-7xl mx-auto space-y-8">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                <Users size={22} />
              </div>
              <h1 className="text-3xl font-black text-white tracking-tight">Operator Registry</h1>
            </div>
            <p className="text-slate-400 text-sm mt-1">
              Centralized directory of verified volunteers, shelters, clinic providers, and administrative operators.
            </p>
          </div>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800/80 hover:bg-slate-800 text-slate-300 text-xs font-bold rounded-xl border border-slate-700 transition-colors w-fit"
          >
            <RefreshCw size={14} className={isFetching ? "animate-spin text-purple-400" : ""} />
            Refresh Directory
          </button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="p-4 rounded-2xl bg-[#0A0F1C] border border-slate-800">
            <p className="text-[11px] font-bold text-slate-500 uppercase">Total Accounts</p>
            <p className="text-2xl font-black text-white mt-1">{metrics.total}</p>
          </div>
          <div className="p-4 rounded-2xl bg-[#0A0F1C] border border-slate-800">
            <p className="text-[11px] font-bold text-emerald-400 uppercase">Volunteers</p>
            <p className="text-2xl font-black text-emerald-400 mt-1">{metrics.volunteers}</p>
          </div>
          <div className="p-4 rounded-2xl bg-[#0A0F1C] border border-slate-800">
            <p className="text-[11px] font-bold text-purple-400 uppercase">Shelters & NGOs</p>
            <p className="text-2xl font-black text-purple-400 mt-1">{metrics.shelters}</p>
          </div>
          <div className="p-4 rounded-2xl bg-[#0A0F1C] border border-slate-800">
            <p className="text-[11px] font-bold text-sky-400 uppercase">Veterinarians</p>
            <p className="text-2xl font-black text-sky-400 mt-1">{metrics.vets}</p>
          </div>
          <div className="p-4 rounded-2xl bg-[#0A0F1C] border border-slate-800">
            <p className="text-[11px] font-bold text-rose-400 uppercase">Admins</p>
            <p className="text-2xl font-black text-rose-400 mt-1">{metrics.admins}</p>
          </div>
          <div className="p-4 rounded-2xl bg-[#0A0F1C] border border-slate-800">
            <p className="text-[11px] font-bold text-amber-400 uppercase">Pending Requests</p>
            <p className="text-2xl font-black text-amber-400 mt-1">{metrics.pending}</p>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#0A0F1C] p-4 rounded-2xl border border-slate-800">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search by name, email, phone, or ID..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(0);
              }}
              className="w-full bg-[#131B2C] border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-purple-500 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setPage(0);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Pending Toggle */}
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-300">
              <input
                type="checkbox"
                checked={onlyPending}
                onChange={(e) => {
                  setOnlyPending(e.target.checked);
                  setPage(0);
                }}
                className="rounded border-slate-700 bg-slate-800 text-purple-600 focus:ring-purple-500"
              />
              Show Pending Clearance Only ({metrics.pending})
            </label>
          </div>
        </div>

        {/* Role Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          {ROLES.map((r) => {
            const isSelected = selectedRole === r;
            return (
              <button
                key={r}
                onClick={() => {
                  setSelectedRole(r);
                  setPage(0);
                }}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors shrink-0 ${
                  isSelected
                    ? "bg-purple-600 text-white shadow-lg shadow-purple-600/30"
                    : "bg-[#0A0F1C] text-slate-400 hover:text-white border border-slate-800"
                }`}
              >
                {r}
              </button>
            );
          })}
        </div>

        {/* Operators Table */}
        <Card className="border-slate-800 bg-[#0A0F1C] shadow-2xl shadow-black/50 rounded-3xl overflow-hidden">
          <CardHeader className="border-b border-slate-800 bg-[#0A0F1C]/80 py-4 px-6 flex flex-row items-center justify-between">
            <CardTitle className="text-base font-bold text-white flex items-center gap-2">
              <span>Directory Results</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700 font-mono">
                {filteredUsers.length} operators
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="py-16 text-center text-slate-500 text-sm flex flex-col items-center justify-center gap-3">
                <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
                <span>Loading operator records from database...</span>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="py-16 text-center text-slate-500 text-sm flex flex-col items-center justify-center gap-2">
                <AlertCircle className="w-8 h-8 text-slate-600" />
                <p>No operator records match the current filter criteria.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-400">
                  <thead className="bg-[#101726] text-[11px] uppercase font-bold text-slate-500 tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="py-3.5 px-6">Operator</th>
                      <th className="py-3.5 px-4">Role Clearance</th>
                      <th className="py-3.5 px-4">Pending Request</th>
                      <th className="py-3.5 px-4">ID Verification</th>
                      <th className="py-3.5 px-4">Coverage & Alerting</th>
                      <th className="py-3.5 px-4">Joined Date</th>
                      <th className="py-3.5 px-6 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {filteredUsers.map((u) => {
                      const hasPending = u.requestedRole && u.requestedRole !== u.role;
                      return (
                        <tr key={u.id} className="hover:bg-slate-900/50 transition-colors group">
                          {/* Operator Identity */}
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-white font-bold text-sm shrink-0 overflow-hidden">
                                {u.avatarUrl ? (
                                  <img src={u.avatarUrl} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <span>{(u.displayName || u.email || "?").charAt(0).toUpperCase()}</span>
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="font-bold text-white text-sm truncate">
                                  {u.displayName || "Anonymous Operator"}
                                </p>
                                <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                                  {u.email && (
                                    <span className="flex items-center gap-1 truncate">
                                      <Mail size={11} /> {u.email}
                                    </span>
                                  )}
                                  {u.phone && (
                                    <span className="flex items-center gap-1">
                                      <Phone size={11} /> {u.phone}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Role Badge */}
                          <td className="py-4 px-4">
                            <span
                              className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-md border ${getRoleBadge(
                                u.role
                              )}`}
                            >
                              <Shield size={12} />
                              {u.role || "CITIZEN"}
                            </span>
                          </td>

                          {/* Pending Request */}
                          <td className="py-4 px-4">
                            {hasPending ? (
                              <div className="flex items-center gap-2">
                                <span className="inline-flex items-center gap-1 text-xs font-black px-2.5 py-1 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                  <ShieldAlert size={12} />
                                  {u.requestedRole}
                                </span>
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => roleMutation.mutate({ uid: u.id, role: u.requestedRole })}
                                    disabled={roleMutation.isPending}
                                    className="p-1 rounded bg-emerald-500/20 hover:bg-emerald-500 text-emerald-400 hover:text-white transition-colors"
                                    title={`Approve as ${u.requestedRole}`}
                                  >
                                    <UserCheck size={14} />
                                  </button>
                                  <button
                                    onClick={() => declineMutation.mutate(u.id)}
                                    disabled={declineMutation.isPending}
                                    className="p-1 rounded bg-rose-500/20 hover:bg-rose-500 text-rose-400 hover:text-white transition-colors"
                                    title="Decline Request"
                                  >
                                    <X size={14} />
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <span className="text-xs text-slate-600">—</span>
                            )}
                          </td>

                          {/* ID Verification */}
                          <td className="py-4 px-4 text-xs">
                            {u.idCardNumber || u.idCardType ? (
                              <div className="flex flex-col gap-0.5">
                                <span className="inline-flex items-center gap-1 font-bold text-slate-200">
                                  <CreditCard size={12} className="text-purple-400" />
                                  {u.idCardType || "Government Photo ID"}
                                </span>
                                <span className="text-[11px] font-mono text-purple-300">
                                  {u.idCardNumber || "ID Document Provided"}
                                </span>
                              </div>
                            ) : (
                              <span className="text-slate-600">—</span>
                            )}
                          </td>

                          {/* Coverage / Alerts */}
                          <td className="py-4 px-4 text-xs">
                            {u.latitude && u.longitude ? (
                              <div className="flex flex-col gap-0.5">
                                <span className="flex items-center gap-1 text-slate-300">
                                  <MapPin size={11} className="text-emerald-400" />
                                  {u.serviceRadiusKm || 15} km radius
                                </span>
                                <span className="text-[11px] text-slate-500">
                                  {Number(u.latitude).toFixed(3)}, {Number(u.longitude).toFixed(3)}
                                </span>
                              </div>
                            ) : (
                              <span className="text-slate-600">No geo configured</span>
                            )}
                          </td>

                          {/* Created At */}
                          <td className="py-4 px-4 text-xs text-slate-500">
                            <span className="flex items-center gap-1">
                              <Calendar size={12} />
                              {u.createdAt ? formatDateTime(u.createdAt) : "—"}
                            </span>
                          </td>

                          {/* Actions */}
                          <td className="py-4 px-6 text-right">
                            <button
                              onClick={() => {
                                setEditingUser(u);
                                setTargetRole(u.role || "CITIZEN");
                                setAdminConfirmText("");
                              }}
                              className="px-3 py-1.5 rounded-lg bg-[#131B2C] hover:bg-purple-600/20 text-slate-300 hover:text-purple-300 border border-slate-700 hover:border-purple-500/30 text-xs font-bold transition-all inline-flex items-center gap-1.5"
                            >
                              <Edit2 size={12} />
                              Manage
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination Controls */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-[#0A0F1C]/80 text-xs text-slate-400">
              <span>
                Showing Page {page + 1} ({filteredUsers.length} operators displayed)
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0 || isLoading}
                  className="px-3.5 py-1.5 rounded-xl bg-[#131B2C] hover:bg-slate-700 text-slate-200 border border-slate-800 disabled:opacity-40 disabled:cursor-not-allowed font-medium transition-colors"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={users.length < PAGE_SIZE || isLoading}
                  className="px-3.5 py-1.5 rounded-xl bg-[#131B2C] hover:bg-slate-700 text-slate-200 border border-slate-800 disabled:opacity-40 disabled:cursor-not-allowed font-medium transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Manage Role Modal Dialog */}
        {editingUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-[#0A0F1C] border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl relative">
              <button
                onClick={() => setEditingUser(null)}
                className="absolute right-5 top-5 text-slate-500 hover:text-white"
              >
                <X size={18} />
              </button>

              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                  <Shield size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Adjust Clearance Role</h3>
                  <p className="text-xs text-slate-400">{editingUser.displayName || editingUser.email}</p>
                </div>
              </div>

              <div className="space-y-4">
                {editingUser.requestedRole && editingUser.requestedRole !== editingUser.role && (
                  <div className="p-4 rounded-2xl bg-slate-900/90 border border-amber-500/30 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                        <CreditCard size={14} />
                        Identity Card Verification
                      </span>
                      <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
                        Pending Clearance
                      </span>
                    </div>

                    <div className="text-xs space-y-1.5 text-slate-300 bg-[#0A0F1C] p-3 rounded-xl border border-slate-800">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Requested Clearance:</span>
                        <span className="font-bold text-emerald-400">{editingUser.requestedRole}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Document Type:</span>
                        <span className="font-medium text-slate-200">{editingUser.idCardType || "Government Photo ID"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Credential / Reg No:</span>
                        <span className="font-mono text-purple-300 font-bold">{editingUser.idCardNumber || "Verified Document"}</span>
                      </div>
                      {editingUser.idCardUrl && editingUser.idCardUrl.startsWith("https://") && (
                        <div className="pt-1">
                          <a
                            href={editingUser.idCardUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300 underline"
                          >
                            <ExternalLink size={11} />
                            Inspect ID Document Proof
                          </a>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          roleMutation.mutate({ uid: editingUser.id, role: editingUser.requestedRole });
                          setEditingUser(null);
                        }}
                        disabled={roleMutation.isPending}
                        className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20"
                      >
                        <UserCheck size={14} />
                        Verify & Approve {editingUser.requestedRole}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          declineMutation.mutate(editingUser.id);
                          setEditingUser(null);
                        }}
                        disabled={declineMutation.isPending}
                        className="px-3 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-xs font-bold transition-colors"
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                )}

                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">
                    Current Clearance
                  </label>
                  <span
                    className={`inline-flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-lg border ${getRoleBadge(
                      editingUser.role
                    )}`}
                  >
                    {editingUser.role || "CITIZEN"}
                  </span>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">
                    Select New Role
                  </label>
                  <select
                    value={targetRole}
                    onChange={(e) => setTargetRole(e.target.value)}
                    className="w-full bg-[#131B2C] border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-purple-500"
                  >
                    {ASSIGNABLE_ROLES.map((role) => (
                      <option key={role} value={role}>
                        {role} {role === "ADMIN" ? "(Full System Access)" : ""}
                      </option>
                    ))}
                  </select>
                </div>

                {targetRole === "ADMIN" && editingUser.role !== "ADMIN" && (
                  <div className="space-y-3">
                    <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start gap-2">
                      <AlertCircle size={16} className="shrink-0 mt-0.5" />
                      <span>
                        Warning: Granting <strong>ADMIN</strong> clearance provides unrestricted access to all operations,
                        audit logs, and user clearance changes.
                      </span>
                    </div>

                    <div className="space-y-1.5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30">
                      <label className="block text-xs font-bold text-rose-300 uppercase tracking-wider">
                        Type &quot;GRANT ADMIN&quot; to authorize full clearance:
                      </label>
                      <input
                        type="text"
                        value={adminConfirmText}
                        onChange={(e) => setAdminConfirmText(e.target.value)}
                        placeholder="GRANT ADMIN"
                        className="w-full bg-[#131B2C] border border-rose-500/40 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-rose-400 font-mono"
                      />
                    </div>
                  </div>
                )}

                <div className="pt-4 flex gap-3">
                  <button
                    onClick={() => {
                      setEditingUser(null);
                      setAdminConfirmText("");
                    }}
                    className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => roleMutation.mutate({ uid: editingUser.id, role: targetRole })}
                    disabled={
                      roleMutation.isPending || 
                      targetRole === editingUser.role ||
                      (targetRole === "ADMIN" && editingUser.role !== "ADMIN" && adminConfirmText.trim() !== "GRANT ADMIN")
                    }
                    className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-purple-600/30"
                  >
                    {roleMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : "Save Changes"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
