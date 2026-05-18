import React, { useState, useRef } from 'react';
import { searchStudents, loginStaff } from '../services/api';

function LoginPage({ onLogin }) {
  const [role, setRole] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const searchTimeout = useRef(null);

  const reset = () => {
    setRole(null);
    setError('');
    setSearchQuery('');
    setSearchResults([]);
    setPassword('');
  };

  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearchQuery(val);
    setError('');
    clearTimeout(searchTimeout.current);
    if (val.trim().length < 2) { setSearchResults([]); return; }
    searchTimeout.current = setTimeout(async () => {
      try {
        const res = await searchStudents(val.trim());
        setSearchResults(res.data || []);
      } catch { setSearchResults([]); }
    }, 300);
  };

  const handleStudentSelect = (s) => {
    onLogin({
      role: 'student',
      studentId: s.student_id,
      name: s.first_name || s.full_name
    });
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
            <p className="text-gray-500 text-sm mb-6">Search by your name or student ID</p>

            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={handleSearchChange}
                placeholder="Enter your name or student ID..."
                className="w-full border-2 border-purple-200 rounded-lg px-4 py-3 text-gray-900 focus:outline-none focus:border-purple-600"
                autoFocus
              />
              {searchResults.length > 0 && (
                <ul className="absolute z-10 w-full bg-white border-2 border-purple-200 rounded-lg mt-1 shadow-lg overflow-hidden">
                  {searchResults.map((s) => (
                    <li key={s.student_id}>
                      <button
                        onClick={() => handleStudentSelect(s)}
                        className="w-full text-left px-4 py-3 hover:bg-purple-50 transition border-b border-purple-100 last:border-0"
                      >
                        <p className="font-semibold text-gray-900">{s.full_name}</p>
                        <p className="text-sm text-gray-500">{s.student_id}{s.major ? ` · ${s.major}` : ''}</p>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {searchQuery.length >= 2 && searchResults.length === 0 && !loading && (
                <p className="mt-2 text-sm text-gray-500">No students found. Try a different search.</p>
              )}
            </div>
            {error && <p className="mt-4 text-red-600 text-sm">{error}</p>}
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
