import api from "@/lib/api";

export const getSystemSettings = async () => {
  const response = await api.get("/settings");
  return response.data;
};

export const updateSystemSettings = async (payload) => {
  const response = await api.patch("/settings", payload);
  return response.data;
};
