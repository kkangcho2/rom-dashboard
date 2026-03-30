import { create } from 'zustand';

const useAuthStore = create((set) => ({
  isLoggedIn: (() => {
    try { return localStorage.getItem('lp_loggedIn') === 'true'; } catch { return false; }
  })(),
  userRole: (() => {
    try { return localStorage.getItem('lp_role') || 'user'; } catch { return 'user'; }
  })(),

  login: (role) => {
    set({ isLoggedIn: true, userRole: role });
    try {
      localStorage.setItem('lp_loggedIn', 'true');
      localStorage.setItem('lp_role', role);
    } catch {}
  },

  logout: () => {
    set({ isLoggedIn: false, userRole: 'user' });
    try {
      localStorage.removeItem('lp_loggedIn');
      localStorage.removeItem('lp_role');
    } catch {}
  },
}));

export default useAuthStore;
