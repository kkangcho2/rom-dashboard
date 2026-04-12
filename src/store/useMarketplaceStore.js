import { create } from 'zustand';
import { getMyProfile } from '../services/marketplace-api';

const useMarketplaceStore = create((set, get) => ({
  // 프로필 상태
  profile: null,
  creatorProfile: null,
  advertiserProfile: null,
  profileLoading: false,

  // 장바구니 (검색 -> 시뮬레이션)
  cart: [],

  // 로드 프로필
  loadProfile: async () => {
    if (get().profileLoading) return;
    set({ profileLoading: true });
    try {
      const data = await getMyProfile();
      set({
        profile: data.user,
        creatorProfile: data.creator,
        advertiserProfile: data.advertiser,
        profileLoading: false,
      });
    } catch {
      set({ profileLoading: false });
    }
  },

  // 장바구니 관리
  addToCart: (creator) => {
    const cart = get().cart;
    if (!cart.find(c => c.id === creator.id)) {
      set({ cart: [...cart, creator] });
    }
  },

  removeFromCart: (creatorId) => {
    set({ cart: get().cart.filter(c => c.id !== creatorId) });
  },

  toggleCartItem: (creator) => {
    const cart = get().cart;
    if (cart.find(c => c.id === creator.id)) {
      set({ cart: cart.filter(c => c.id !== creator.id) });
    } else {
      set({ cart: [...cart, creator] });
    }
  },

  clearCart: () => set({ cart: [] }),

  // 상태 리셋
  reset: () => set({
    profile: null,
    creatorProfile: null,
    advertiserProfile: null,
    profileLoading: false,
    cart: [],
  }),
}));

export default useMarketplaceStore;
