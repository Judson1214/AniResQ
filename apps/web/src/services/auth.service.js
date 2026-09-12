import api from "@/lib/api";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  onAuthStateChanged
} from "firebase/auth";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { auth, db } from "@/config/firebase";
const signUp = async (email, password, displayName, role, phone) => {
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  const user = userCredential.user;
  await updateProfile(user, { displayName });
  const newUser = {
    uid: user.uid,
    email: user.email,
    displayName,
    role,
    phone: phone || "",
  };
  
  // Create profile via Python backend
  await api.post("/users", newUser);
  
  return { ...newUser, avatarUrl: "", isVerified: false, createdAt: new Date() };
};
const signIn = async (email, password) => {
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  return userCredential.user;
};
const signOutUser = async () => {
  await signOut(auth);
};
const getUserProfile = async (uid) => {
  try {
    // Fetch profile from our Python backend (which uses firebase-admin and bypasses rules)
    const response = await api.get(`/users/${uid}`);
    return response.data;
  } catch (error) {
    if (error.response?.status === 404) {
      return null;
    }
    throw error;
  }
};
const updateUserProfile = async (uid, data) => {
  const response = await api.patch(`/users/${uid}`, data);
  return response.data;
};
const onAuthChange = (callback) => {
  return onAuthStateChanged(auth, callback);
};
export {
  getUserProfile,
  onAuthChange,
  signIn,
  signOutUser,
  signUp,
  updateUserProfile
};
