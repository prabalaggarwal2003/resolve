'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('reporter');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const base = process.env.NEXT_PUBLIC_API_URL || '';
      const url = base ? `${base}/api/auth/register` : '/api/auth/register';
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name, role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Registration failed');
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      window.location.href = '/dashboard';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-gray-800 p-8 rounded-xl shadow-sm border border-gray-700">
        <h1 className="text-xl font-bold mb-2 text-gray-100">Create account</h1>
        <p className="text-gray-400 mb-6">For school or college staff — first user can be Admin</p>
        <form onSubmit={handleSubmit}>
          {error && <p className="mb-4 p-3 bg-red-900/20 border border-red-800 text-red-400 rounded-lg text-sm">{error}</p>}
          <label className="block mb-2 font-medium text-gray-300">Name</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} required
            className="w-full px-3 py-2.5 border border-gray-700 bg-gray-900 text-gray-200 rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-gray-600 focus:border-transparent" />
          <label className="block mb-2 font-medium text-gray-300">Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
            className="w-full px-3 py-2.5 border border-gray-700 bg-gray-900 text-gray-200 rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-gray-600 focus:border-transparent" />
          <label className="block mb-2 font-medium text-gray-300">Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6}
            className="w-full px-3 py-2.5 border border-gray-700 bg-gray-900 text-gray-200 rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-gray-600 focus:border-transparent" />
          <label className="block mb-2 font-medium text-gray-300">Role</label>
          <select value={role} onChange={(e) => setRole(e.target.value)}
            className="w-full px-3 py-2.5 border border-gray-700 bg-gray-900 text-gray-200 rounded-lg mb-6 focus:outline-none focus:ring-2 focus:ring-gray-600 focus:border-transparent">
            <option value="admin">Admin</option>
            <option value="manager">Manager</option>
            <option value="reporter">Reporter</option>
          </select>
          <button type="submit" disabled={loading}
            className="w-full py-3 bg-gray-700 text-white rounded-lg font-semibold disabled:opacity-60 hover:bg-gray-600">
            {loading ? 'Creating…' : 'Create account'}
          </button>
        </form>
        <p className="mt-6 text-gray-400 text-sm">
          Already have an account? <Link href="/login" className="text-gray-300 hover:text-white no-underline">Sign in</Link>
        </p>
      </div>
    </main>
  );
}
