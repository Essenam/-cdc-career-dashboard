import React, { useState } from 'react';
import { getStudentProfile, loginStaff } from '../services/api';

function LoginPage({ onLogin }) {
  const [role, setRole] = useState(null);
  const [studentId, setStudentId] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const reset = () => {
    setRole(null);
    setError('');
    setStudentId('');
    setPassword('');
  };

  const handleStudentLogin = async (e) => {
    e.preventDefault();
    const id = studentId.trim();
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const res = await getStudentProfile(id);
      const s = res.data;
      onLogin({ role: 'student', studentId: s.student_id, name: s.first_name || s.full_name });
    } catch {
      setError('Student ID not found. Please check your ID and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleStaffLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await loginStaff(password);
      onLogin({ role: 'staff' });
    } catch (err) {
      setError(err.response?.data?.error || 'Incorrect password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 via-pink-50 to-blue-50 flex items-center justify-center p-6">
      <div className="w-full max-w-lg">

        <div className="text-center mb-10">
          <p className="text-5xl mb-4">🎓</p>
          <h1 className="text-3xl font-bold text-purple-800 mb-1">CDC Career Dashboard</h1>
          <p className="text-gray-500 text-sm">University of St. Thomas · Career Development Center</p>
        </div>

        {/* Role selection */}
        {!role && (
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => setRole('student')}
              className="bg-white border-2 border-purple-200 rounded-2xl p-8 hover:border-purple-600 hover:shadow-lg transition text-left"
            >
              <p className="text-4xl mb-4">🎒</p>
              <h2 className="text-xl font-bold text-gray-900 mb-1">I'm a Student</h2>
              <p className="text-sm text-gray-500">View your career journey and track your progress</p>
            </button>
            <button
              onClick={() => setRole('staff')}
              className="bg-white border-2 border-purple-200 rounded-2xl p-8 hover:border-purple-600 hover:shadow-lg transition text-left"
            >
              <p className="text-4xl mb-4">💼</p>
              <h2 className="text-xl font-bold text-gray-900 mb-1">I'm Staff</h2>
              <p className="text-sm text-gray-500">Access the full dashboard and all student profiles</p>
            </button>
          </div>
        )}

        {/* Student login */}
        {role === 'student' && (
          <div className="bg-white border-2 border-purple-200 rounded-2xl p-8 shadow-lg">
            <button onClick={reset} className="text-sm text-purple-500 hover:text-purple-700 mb-6 flex items-center gap-1">
              ← Back
            </button>
            <h2 className="text-2xl font-bold text-gray-900 mb-1">Student Login</h2>
            <p className="text-gray-500 text-sm mb-6">Enter your student ID to access your dashboard</p>

            <form onSubmit={handleStudentLogin} className="space-y-4">
              <input
                type="text"
                value={studentId}
                onChange={(e) => { setStudentId(e.target.value); setError(''); }}
                placeholder="Your student ID (e.g. STU001)"
                className="w-full border-2 border-purple-200 rounded-lg px-4 py-3 text-gray-900 focus:outline-none focus:border-purple-600"
                autoFocus
              />
              {error && <p className="text-red-600 text-sm">{error}</p>}
              <button
                type="submit"
                disabled={loading || !studentId.trim()}
                className="w-full bg-gradient-to-r from-purple-700 to-pink-600 text-white font-bold py-3 rounded-lg hover:shadow-lg transition disabled:opacity-50"
              >
                {loading ? 'Looking up...' : 'Continue'}
              </button>
            </form>
          </div>
        )}

        {/* Staff login */}
        {role === 'staff' && (
          <div className="bg-white border-2 border-purple-200 rounded-2xl p-8 shadow-lg">
            <button onClick={reset} className="text-sm text-purple-500 hover:text-purple-700 mb-6 flex items-center gap-1">
              ← Back
            </button>
            <h2 className="text-2xl font-bold text-gray-900 mb-1">Staff Login</h2>
            <p className="text-gray-500 text-sm mb-6">Enter your staff password to continue</p>

            <form onSubmit={handleStaffLogin} className="space-y-4">
              <input
                type="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(''); }}
                placeholder="Staff password"
                className="w-full border-2 border-purple-200 rounded-lg px-4 py-3 text-gray-900 focus:outline-none focus:border-purple-600"
                autoFocus
              />
              {error && <p className="text-red-600 text-sm">{error}</p>}
              <button
                type="submit"
                disabled={loading || !password}
                className="w-full bg-gradient-to-r from-purple-700 to-pink-600 text-white font-bold py-3 rounded-lg hover:shadow-lg transition disabled:opacity-50"
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>
          </div>
        )}

      </div>
    </div>
  );
}

export default LoginPage;
