import React, { useState, useRef } from 'react';
import StaffDashboard from './pages/StaffDashboard';
import StudentDashboard from './pages/StudentDashboard';
import PlatformsHub from './pages/PlatformsHub';
import AdminDashboard from './pages/AdminDashboard';
import LoginPage from './pages/LoginPage';
import ErrorBoundary from './ErrorBoundary';
import './App.css';

function App() {
  const [auth, setAuth] = useState(() => {
    try {
      const saved = sessionStorage.getItem('cdc_auth');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });

  const [view, setView] = useState('staff');
  const [selectedStudentId, setSelectedStudentId] = useState(null);
  const staffRefreshRef = useRef(null);

  const handleLogin = (authData) => {
    setAuth(authData);
    try { sessionStorage.setItem('cdc_auth', JSON.stringify(authData)); } catch {}
    setView(authData.role === 'student' ? 'student' : 'staff');
  };

  const handleLogout = () => {
    setAuth(null);
    try { sessionStorage.removeItem('cdc_auth'); } catch {}
    setView('staff');
    setSelectedStudentId(null);
  };

  const handleUploadComplete = () => {
    handleSetView('staff');
    setTimeout(() => { if (staffRefreshRef.current) staffRefreshRef.current(); }, 100);
  };

  const navigateToStudent = (studentId) => {
    setSelectedStudentId(studentId);
    setView('student');
  };

  const handleSetView = (v) => {
    if (v !== 'student') setSelectedStudentId(null);
    setView(v);
  };

  if (!auth) {
    return <ErrorBoundary><LoginPage onLogin={handleLogin} /></ErrorBoundary>;
  }

  const isStudent = auth.role === 'student';
  const isStaff = auth.role === 'staff';

  return (
    <ErrorBoundary>
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b shadow-sm px-6 py-3 flex items-center gap-4">
        <span className="font-bold text-lg text-purple-800">CDC Career Dashboard</span>

        <div className="flex gap-2 ml-auto items-center">
          {isStaff && (
            <>
              <button
                onClick={() => handleSetView('staff')}
                className={`px-4 py-2 rounded text-sm font-medium ${view === 'staff' ? 'bg-purple-700 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
              >
                Staff View
              </button>
              <button
                onClick={() => handleSetView('student')}
                className={`px-4 py-2 rounded text-sm font-medium ${view === 'student' ? 'bg-purple-700 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
              >
                Student View
              </button>
            </>
          )}

          <button
            onClick={() => handleSetView('platforms')}
            className={`px-4 py-2 rounded text-sm font-medium ${view === 'platforms' ? 'bg-purple-700 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >
            Platforms Hub
          </button>

          {isStaff && (
            <button
              onClick={() => handleSetView('admin')}
              className={`px-4 py-2 rounded text-sm font-medium ${view === 'admin' ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              Admin
            </button>
          )}

          <div className="ml-2 pl-3 border-l border-gray-200 flex items-center gap-3">
            <span className="text-xs text-gray-500 font-medium">
              {isStudent ? auth.name : 'Staff'}
            </span>
            <button
              onClick={handleLogout}
              className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-red-50 hover:text-red-600 text-gray-600 rounded font-medium transition"
            >
              Log out
            </button>
          </div>
        </div>
      </nav>

      {isStaff && view === 'staff' && (
        <StaffDashboard onViewStudent={navigateToStudent} refreshRef={staffRefreshRef} />
      )}
      {view === 'student' && (
        <StudentDashboard
          setView={handleSetView}
          initialStudentId={isStudent ? auth.studentId : selectedStudentId}
          fromStaff={isStaff && !!selectedStudentId}
          locked={isStudent}
        />
      )}
      {view === 'platforms' && <PlatformsHub setView={handleSetView} />}
      {isStaff && view === 'admin' && <AdminDashboard onUploadComplete={handleUploadComplete} />}
    </div>
    </ErrorBoundary>
  );
}

export default App;
