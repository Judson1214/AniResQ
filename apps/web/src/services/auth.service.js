import { supabase } from "@/config/supabase";

const signUp = async (email, password, displayName, role = "CITIZEN", phone = "") => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        display_name: displayName,
        phone: phone || "",
        requested_role: role,
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
  const dbData = {};
  if (updateData.displayName !== undefined) dbData.display_name = updateData.displayName;
  if (updateData.phone !== undefined) dbData.phone = updateData.phone;
  if (updateData.avatarUrl !== undefined) dbData.avatar_url = updateData.avatarUrl;
  // NOTE: role is strictly excluded to prevent privilege escalation from the browser

  const { data, error } = await supabase
    .from('users')
    .update(dbData)
    .eq('id', uid)
    .select()
    .single();
    
  if (error) throw error;
  return data;
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
