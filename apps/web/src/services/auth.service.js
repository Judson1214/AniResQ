import { supabase } from "@/config/supabase";
import api from "@/lib/api";

const signUp = async (email, password, displayName, role = "CITIZEN", phone = "") => {
  // Prevent users from requesting ADMIN role via signup metadata
  const requestedRole = (role && role.toUpperCase() !== "ADMIN" && ["VOLUNTEER", "NGO", "SHELTER", "VET"].includes(role.toUpperCase()))
    ? role.toUpperCase()
    : null;

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        display_name: displayName,
        phone: phone || "",
        requested_role: requestedRole,
      }
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
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
};

const getUserProfile = async (uid) => {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', uid)
    .single();
  
  if (error) {
    if (error.code === 'PGRST116') return null; // 404 Not Found equivalent
    throw error;
  }
  
  return {
    uid: data.id,
    id: data.id,
    email: data.email,
    displayName: data.display_name,
    role: data.role,
    phone: data.phone,
    avatarUrl: data.avatar_url || "",
    isVerified: data.is_verified || false,
    createdAt: data.created_at
  };
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
