import React, { useState, useEffect } from 'react';
import { getAllStudents, getStudentsByRisk, getDashboardSummary } from '../services/api';

function StaffDashboard({ onViewStudent, refreshRef }) {
  const [allStudents, setAllStudents] = useState([]);
  const [summary, setSummary] = useState(null);
  const [filterRisk, setFilterRisk] = useState(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const [studentsRes, summaryRes] = await Promise.all([
        getAllStudents(),
        getDashboardSummary()
      ]);
      setAllStudents(studentsRes.data);
      setSummary(summaryRes.data);
    } catch (err) {
      setError('Failed to load dashboard. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    if (refreshRef) refreshRef.current = fetchData;
  }, []);

  const handleFilterRisk = async (level) => {
    setFilterRisk(level);
    setSearch('');
    setError('');
    try {
      const res = level === null ? await getAllStudents() : await getStudentsByRisk(level);
      setAllStudents(res.data);
    } catch (err) {
      setError('Failed to filter students. Please try again.');
    }
  };

  const getRiskColor = (level) => {
    const l = level?.toLowerCase();
    if (l === 'high') return 'bg-red-100 text-red-800';
    if (l === 'medium') return 'bg-yellow-100 text-yellow-800';
    return 'bg-green-100 text-green-800';
  };

  const filteredStudents = allStudents.filter((s) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      s.full_name?.toLowerCase().includes(q) ||
      s.email?.toLowerCase().includes(q) ||
      s.major?.toLowerCase().includes(q)
    );
  });

  if (loading) return <div className="p-4">Loading...</div>;
  if (error) return <div className="p-6 text-center text-red-600 font-medium">{error}</div>;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Staff Dashboard</h1>
        <button
          onClick={fetchData}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition disabled:opacity-50"
        >
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Summary Stats */}
      {summary && (
        <div className="grid grid-cols-5 gap-4 mb-6">
          <div className="bg-blue-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600">Total Students</p>
            <p className="text-2xl font-bold">{summary.totalStudents}</p>
          </div>
          <div className="bg-red-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600">High Risk</p>
            <p className="text-2xl font-bold">{summary.highRiskCount}</p>
          </div>
          <div className="bg-yellow-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600">Medium Risk</p>
            <p className="text-2xl font-bold">{summary.mediumRiskCount}</p>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600">Low Risk</p>
            <p className="text-2xl font-bold">{summary.lowRiskCount}</p>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600">Avg Engagement</p>
            <p className="text-2xl font-bold">{summary.avgEngagement}</p>
          </div>
        </div>
      )}

      {/* Filters + Search */}
      <div className="mb-6 flex flex-wrap gap-3 items-center">
        <div className="flex gap-2">
          <button
            onClick={() => handleFilterRisk(null)}
            className={`px-4 py-2 rounded ${filterRisk === null ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
          >
            All
          </button>
          <button
            onClick={() => handleFilterRisk('high')}
            className={`px-4 py-2 rounded ${filterRisk === 'high' ? 'bg-red-500 text-white' : 'bg-gray-200'}`}
          >
            High Risk
          </button>
          <button
            onClick={() => handleFilterRisk('medium')}
            className={`px-4 py-2 rounded ${filterRisk === 'medium' ? 'bg-yellow-500 text-white' : 'bg-gray-200'}`}
          >
            Medium Risk
          </button>
          <button
            onClick={() => handleFilterRisk('low')}
            className={`px-4 py-2 rounded ${filterRisk === 'low' ? 'bg-green-500 text-white' : 'bg-gray-200'}`}
          >
            Low Risk
          </button>
        </div>

        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, email, or major..."
          className="ml-auto border border-gray-300 rounded-lg px-4 py-2 text-sm w-72 focus:outline-none focus:border-blue-400"
        />
      </div>

      {/* Students Table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-100">
              <th className="border p-3 text-left">Name</th>
              <th className="border p-3 text-left">Email</th>
              <th className="border p-3 text-left">Major</th>
              <th className="border p-3 text-center">Engagement</th>
              <th className="border p-3 text-center">Risk</th>
              <th className="border p-3 text-center">Events</th>
              <th className="border p-3 text-center">Apps</th>
              <th className="border p-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredStudents.length === 0 && (
              <tr>
                <td colSpan={8} className="border p-6 text-center text-gray-500">
                  No students match your search.
                </td>
              </tr>
            )}
            {filteredStudents.map((student) => (
              <tr
                key={student.student_id}
                className="hover:bg-blue-50 cursor-pointer transition"
                onClick={() => onViewStudent && onViewStudent(student.student_id)}
              >
                <td className="border p-3 font-medium text-blue-700">{student.full_name}</td>
                <td className="border p-3 text-gray-600">
                  {student.email || <span className="text-gray-300 italic text-xs">not available</span>}
                </td>
                <td className="border p-3">{student.major || <span className="text-gray-300 italic text-xs">not available</span>}</td>
                <td className="border p-3 text-center">{student.engagement_score}</td>
                <td className="border p-3 text-center">
                  <span className={`px-3 py-1 rounded text-sm font-semibold ${getRiskColor(student.risk_level)}`}>
                    {student.risk_level?.toUpperCase()}
                  </span>
                </td>
                <td className="border p-3 text-center">{student.career_events_attended}</td>
                <td className="border p-3 text-center">{student.job_applications_count}</td>
                <td className="border p-3 text-center">
                  <button
                    onClick={(e) => { e.stopPropagation(); onViewStudent && onViewStudent(student.student_id); }}
                    className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition"
                  >
                    View Journey →
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default StaffDashboard;
