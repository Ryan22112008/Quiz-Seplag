import { useEffect } from 'react';
import { AppRoutes } from '@/routes';
import { Toasts } from '@/components/ui/Toast';
import { useAuthStore } from '@/stores/authStore';

export default function App() {
  const initialize = useAuthStore((state) => state.initialize);
  useEffect(() => { void initialize(); }, [initialize]);
  return <><AppRoutes /><Toasts /></>;
}

