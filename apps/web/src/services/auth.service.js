import { supabase } from "@/config/supabase";
import api from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { useAuthStore } from "@/store/authStore";

const signUp = async (
  email,
  password,
  displayName,
  phone = ""
) => {
  // All signups create a standard CITIZEN account with NO pending role request in metadata.
  // Role upgrades with ID verification must be requested post-registration via /api/users/request-clearance.
  const metadata = {
    display_name: displayName,
    phone: phone || "",
  };

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: metadata
    }
  });

  if (error) throw error;
  
  const user = data.user;
  const newUser = {
    uid: user.id,
    email: user.email,
    displayName,
    role: "CITIZEN", // Default role enforced by backend database trigger
    phone: phone || "",
  };

  return { ...newUser, id: user.id, avatarUrl: "", isVerified: false, createdAt: new Date() };
};

const signIn = async (email, password) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });
  if (error) throw error;
  return data.user;
};

const signOutUser = async () => {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  } finally {
    useAuthStore.getState().clearAuth();
    queryClient.clear();
  }
};

const getUserProfile = async (uid) => {
  try {
    const response = await api.get(`/users/${uid}`);
    const data = response.data;
    return {
      uid: data.id || data.uid,
      id: data.id || data.uid,
      email: data.email,
      displayName: data.displayName || data.display_name,
      role: data.role,
      phone: data.phoneNumber || data.phone,
      avatarUrl: data.avatarUrl || data.avatar_url || "",
      isVerified: data.isVerified || data.is_verified || false,
      requestedRole: data.requestedRole || data.requested_role || null,
      latitude: data.latitude ?? null,
      longitude: data.longitude ?? null,
      serviceRadiusKm: data.serviceRadiusKm ?? data.service_radius_km ?? 15,
      alertsEnabled: data.alertsEnabled ?? data.alerts_enabled ?? true,
      createdAt: data.createdAt || data.created_at
    };
  } catch (error) {
    if (error?.response?.status === 404) return null;
    throw error;
  }
};

const updateUserProfile = async (uid, updateData) => {
  const payload = {};
  if (updateData.displayName !== undefined) payload.displayName = updateData.displayName;
  if (updateData.phone !== undefined) {
    payload.phoneNumber = updateData.phone;
    payload.phone = updateData.phone;
  }
  if (updateData.phoneNumber !== undefined) {
    payload.phoneNumber = updateData.phoneNumber;
    payload.phone = updateData.phoneNumber;
  }
  if (updateData.avatarUrl !== undefined) payload.avatarUrl = updateData.avatarUrl;
  if (updateData.address !== undefined) payload.address = updateData.address;
  if (updateData.bio !== undefined) payload.bio = updateData.bio;
  if (updateData.latitude !== undefined) payload.latitude = updateData.latitude;
  if (updateData.longitude !== undefined) payload.longitude = updateData.longitude;
  if (updateData.serviceRadiusKm !== undefined) payload.serviceRadiusKm = updateData.serviceRadiusKm;
  if (updateData.alertsEnabled !== undefined) payload.alertsEnabled = updateData.alertsEnabled;
  // NOTE: role is strictly excluded to prevent privilege escalation from the browser

  const response = await api.patch(`/users/${uid}`, payload);
  return response.data;
};

const onAuthChange = (callback) => {
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    callback(session?.user || null);
  });
  
  return () => {
    data.subscription.unsubscribe();
  };
};

export {
  getUserProfile,
  onAuthChange,
  signIn,
  signOutUser,
  signUp,
  updateUserProfile
};
