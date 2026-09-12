import { create } from "zustand";
const useAuthStore = create((set) => ({
  user: null,
  firebaseUser: null,
  isLoading: true,
  isAuthenticated: false,
  setUser: (user) => set({ user, isAuthenticated: !!user }),
  setFirebaseUser: (firebaseUser) => set({ firebaseUser }),
  setLoading: (isLoading) => set({ isLoading }),
  clearAuth: () => set({ user: null, firebaseUser: null, isAuthenticated: false, isLoading: false }),
  logout: () => set({ user: null, firebaseUser: null, isAuthenticated: false })
}));
export {
  useAuthStore
};
