import api from "@/lib/api";

export const getAuditLogs = async (params = {}) => {
  const response = await api.get("/audit-logs", { params });
  return response.data;
};

export const auditService = {
  getAuditLogs,
};

export default auditService;
