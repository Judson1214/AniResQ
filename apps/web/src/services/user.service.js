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
  const updateData = {};
  if (data.displayName !== undefined) updateData.display_name = data.displayName;
  if (data.phone !== undefined) updateData.phone = data.phone;
  if (data.avatarUrl !== undefined) updateData.avatar_url = data.avatarUrl;
  // NOTE: role is strictly excluded to prevent privilege escalation from the browser

  const { error } = await supabase
    .from('users')
    .update(updateData)
    .eq('id', uid);

  if (error) throw error;
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
