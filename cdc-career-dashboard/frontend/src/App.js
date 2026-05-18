import React, { useState, useRef } from 'react';
import StaffDashboard from './pages/StaffDashboard';
import StudentDashboard from './pages/StudentDashboard';
import PlatformsHub from './pages/PlatformsHub';
import AdminDashboard from './pages/AdminDashboard';
import './App.css';

function App() {
  const [view, setView] = useState('staff');
  const [selectedStudentId, setSelectedStudentId] = useState(null);
  const staffRefreshRef = useRef(null);

  const handleUploadComplete = () => {
    handleSetView('staff');
    setTimeout(() => {
      if (staffRefreshRef.current) staffRefreshRef.current();
    }, 100);
  };

  const navigateToStudent = (studentId) => {
    setSelectedStudentId(studentId);
    setView('student');
  };

  const handleSetView = (v) => {
    if (v !== 'student') setSelectedStudentId(null);
    setView(v);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Nav */}
      <nav className="bg-white border-b shadow-sm px-6 py-3 flex items-center gap-4">
        <span className="font-bold text-lg text-blue-700">CDC Career Dashboard</span>
        <div className="flex gap-2 ml-auto">
          <button
            onClick={() => handleSetView('staff')}
            className={`px-4 py-2 rounded text-sm font-medium ${
              view === 'staff' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Staff View
          </button>
          <button
            onClick={() => handleSetView('student')}
            className={`px-4 py-2 rounded text-sm font-medium ${
              view === 'student' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Student View
          </button>
          <button
            onClick={() => handleSetView('platforms')}
            className={`px-4 py-2 rounded text-sm font-medium ${
              view === 'platforms' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Platforms Hub
          </button>
          <button
            onClick={() => handleSetView('admin')}
            className={`px-4 py-2 rounded text-sm font-medium ${
              view === 'admin' ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Admin
          </button>
        </div>
      </nav>

      {/* Content */}
      {view === 'staff' && <StaffDashboard onViewStudent={navigateToStudent} refreshRef={staffRefreshRef} />}
      {view === 'student' && <StudentDashboard setView={handleSetView} initialStudentId={selectedStudentId} fromStaff={!!selectedStudentId} />}
      {view === 'platforms' && <PlatformsHub setView={handleSetView} />}
      {view === 'admin' && <AdminDashboard onUploadComplete={handleUploadComplete} />}
    </div>
  );
}

export default App;