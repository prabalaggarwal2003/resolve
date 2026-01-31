'use client';

import { useAuth } from '../contexts/AuthContext';

export default function LogoutButton() {
  const { logout, user } = useAuth();

  if (!user) return null;

  return (
    <button
      onClick={logout}
      className="px-4 py-2 text-sm text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
    >
      Logout
    </button>
  );
}
