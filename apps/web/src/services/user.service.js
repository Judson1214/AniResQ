import api from "@/lib/api";

const mapUserToCamelCase = (dbData) => ({
  uid: dbData.id,
  id: dbData.id,
  email: dbData.email,
  displayName: dbData.display_name || dbData.displayName,
  role: dbData.role,
  requestedRole: dbData.requested_role || dbData.requestedRole,
  phone: dbData.phone || dbData.phoneNumber,
  avatarUrl: dbData.avatar_url || dbData.avatarUrl || "",
  createdAt: dbData.created_at || dbData.createdAt
});

const getUserById = async (uid) => {
  try {
    const response = await api.get(`/users/${uid}`);
    return mapUserToCamelCase(response.data);
  } catch (error) {
    if (error.response?.status === 404) return null;
    throw error;
  }
};

const getUsersByRole = async (role) => {
  const response = await api.get('/users', { params: { role } });
  return response.data.map(mapUserToCamelCase);
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
  const response = await api.get('/users', { params: { search: searchQuery } });
  return response.data.map(mapUserToCamelCase);
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
