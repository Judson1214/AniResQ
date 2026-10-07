import { create } from "zustand";
const useAuthStore = create((set) => ({
  user: null,
  sessionUser: null,
  isLoading: true,
  isAuthenticated: false,
  setUser: (user) => set({ user, isAuthenticated: !!user }),
  setSessionUser: (sessionUser) => set({ sessionUser }),
  setLoading: (isLoading) => set({ isLoading }),
  clearAuth: () => set({ user: null, sessionUser: null, isAuthenticated: false, isLoading: false }),
  logout: () => set({ user: null, sessionUser: null, isAuthenticated: false })
}));
export {
  useAuthStore
};
