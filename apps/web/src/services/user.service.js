import { supabase } from "@/config/supabase";
import api from "@/lib/api";

const mapUserToCamelCase = (dbData) => ({
  uid: dbData.id,
  id: dbData.id,
  email: dbData.email,
  displayName: dbData.display_name,
  role: dbData.role,
  requestedRole: dbData.requested_role,
  phone: dbData.phone,
  avatarUrl: dbData.avatar_url || "",
  createdAt: dbData.created_at
});

const getUserById = async (uid) => {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', uid)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // 404
    throw error;
  }
  return mapUserToCamelCase(data);
};

const getUsersByRole = async (role) => {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('role', role);

  if (error) throw error;
  return data.map(mapUserToCamelCase);
};

const updateUserProfile = async (uid, data) => {
  const payload = {};
  if (data.displayName !== undefined) payload.displayName = data.displayName;
  if (data.phone !== undefined) {
    payload.phoneNumber = data.phone;
    payload.phone = data.phone;
  }
  if (data.phoneNumber !== undefined) {
    payload.phoneNumber = data.phoneNumber;
    payload.phone = data.phoneNumber;
  }
  if (data.avatarUrl !== undefined) payload.avatarUrl = data.avatarUrl;
  if (data.address !== undefined) payload.address = data.address;
  if (data.bio !== undefined) payload.bio = data.bio;
  // NOTE: role is strictly excluded to prevent privilege escalation from the browser

  const response = await api.patch(`/users/${uid}`, payload);
  return response.data;
};

const searchUsers = async (searchQuery) => {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .ilike('display_name', `%${searchQuery}%`);

  if (error) throw error;
  return data.map(mapUserToCamelCase);
};

const getUsers = async (params) => {
  const response = await api.get('/users', { params });
  return response.data;
};

const updateUserRole = async (uid, role) => {
  const response = await api.patch(`/users/${uid}/role`, { role });
  return response.data;
};

export {
  getUserById,
  getUsers,
  getUsersByRole,
  searchUsers,
  updateUserProfile,
  updateUserRole
};
