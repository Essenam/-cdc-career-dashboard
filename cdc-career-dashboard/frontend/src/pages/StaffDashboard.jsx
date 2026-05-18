import React, { useState, useEffect } from 'react';
import { getAllStudents, getStudentsByRisk, getDashboardSummary, getStaffAnalytics } from '../services/api';

function StaffDashboard({ onViewStudent, refreshRef }) {
  const [allStudents, setAllStudents] = useState([]);
  const [summary, setSummary] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [showAnalytics, setShowAnalytics] = useState(false);
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

  const handleToggleAnalytics = async () => {
    if (!analytics) {
      try {
        const res = await getStaffAnalytics();
        setAnalytics(res.data);
      } catch { /* silently fail — analytics are non-critical */ }
    }
    setShowAnalytics(v => !v);
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
        <div className="grid grid-cols-5 gap-4 mb-4">
          <div className="bg-blue-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600">Total Students</p>
            <p className="text-2xl font-bold">{summary.totalStudents}</p>
          </div>
          <div className="bg-red-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600">High Risk</p>
            <p className="text-2xl font-bold text-red-700">{summary.highRiskCount}</p>
          </div>
          <div className="bg-yellow-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600">Medium Risk</p>
            <p className="text-2xl font-bold text-yellow-700">{summary.mediumRiskCount}</p>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600">Low Risk</p>
            <p className="text-2xl font-bold text-green-700">{summary.lowRiskCount}</p>
          </div>
          <button
            onClick={handleToggleAnalytics}
            className="bg-purple-50 hover:bg-purple-100 p-4 rounded-lg text-left transition border-2 border-transparent hover:border-purple-300"
          >
            <p className="text-sm text-gray-600">Avg Engagement</p>
            <p className="text-2xl font-bold text-purple-700">{summary.avgEngagement}</p>
            <p className="text-xs text-purple-500 mt-1">{showAnalytics ? 'Hide analytics ▲' : 'View analytics ▼'}</p>
          </button>
        </div>
      )}

      {/* Analytics Panel */}
      {showAnalytics && analytics && (
        <div className="mb-6 bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
            <h2 className="font-bold text-gray-900 text-lg">Analytics & Insights</h2>
            <button onClick={() => setShowAnalytics(false)} className="text-gray-400 hover:text-gray-600 text-xl font-bold">✕</button>
          </div>

          <div className="p-6 space-y-8">

            {/* Activity Stats */}
            <div>
              <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">Activity Across All Students</h3>
              <div className="grid grid-cols-4 gap-4">
                {[
                  { label: 'Events Attended', icon: '📅', data: analytics.activity.events, color: 'blue' },
                  { label: 'Applications', icon: '💼', data: analytics.activity.applications, color: 'green' },
                  { label: 'CDC Appointments', icon: '🎓', data: analytics.activity.appointments, color: 'purple' },
                  { label: 'Milestone Check-ins', icon: '☑️', data: null, total: analytics.activity.milestones.total, active: analytics.activity.milestones.students_active, color: 'orange' },
                ].map(({ label, icon, data, total, active, color }) => (
                  <div key={label} className={`bg-${color}-50 border border-${color}-100 rounded-xl p-4`}>
                    <p className="text-xs font-semibold text-gray-500 mb-2">{icon} {label}</p>
                    {data ? (
                      <>
                        <div className="flex gap-4 mb-2">
                          <div><p className="text-xs text-gray-400">Avg</p><p className="text-xl font-bold text-gray-800">{data.avg}</p></div>
                          <div><p className="text-xs text-gray-400">Median</p><p className="text-xl font-bold text-gray-800">{data.median}</p></div>
                          <div><p className="text-xs text-gray-400">Total</p><p className="text-xl font-bold text-gray-800">{data.total}</p></div>
                        </div>
                        {data.zero_count > 0 && (
                          <p className="text-xs text-red-500 font-medium">{data.zero_count} with none</p>
                        )}
                      </>
                    ) : (
                      <>
                        <p className="text-xl font-bold text-gray-800 mb-1">{total}</p>
                        <p className="text-xs text-gray-500">{active} student{active !== 1 ? 's' : ''} active</p>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-8">
              {/* Engagement Distribution */}
              <div>
                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">
                  Engagement Distribution
                  <span className="ml-2 font-normal text-gray-400 normal-case">Avg {analytics.engagement_score.avg} · Median {analytics.engagement_score.median}</span>
                </h3>
                <div className="space-y-2">
                  {analytics.engagement_distribution.map(({ label, range, count }) => {
                    const pct = analytics.total_students > 0 ? Math.round(count / analytics.total_students * 100) : 0;
                    const barColor = label === 'No activity' || label === 'Minimal' ? 'bg-red-400' : label === 'Developing' ? 'bg-yellow-400' : label === 'Active' ? 'bg-blue-400' : 'bg-green-500';
                    return (
                      <div key={label} className="flex items-center gap-3">
                        <div className="w-24 text-right">
                          <p className="text-xs text-gray-600 font-medium">{label}</p>
                          <p className="text-xs text-gray-400">{range}</p>
                        </div>
                        <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden">
                          <div className={`h-full ${barColor} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                        </div>
                        <p className="text-sm font-bold text-gray-700 w-6 text-right">{count}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Platform Usage */}
              <div>
                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">Platform Usage (Most → Least)</h3>
                <div className="space-y-3">
                  {analytics.platform_usage.map(({ name, count, pct, icon }, i) => (
                    <div key={name} className="flex items-center gap-3">
                      <span className="text-base w-5">{icon}</span>
                      <div className="flex-1">
                        <div className="flex justify-between mb-1">
                          <p className="text-xs font-medium text-gray-700">{name}</p>
                          <p className="text-xs font-bold text-gray-600">{count}</p>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${i === 0 ? 'bg-blue-500' : i === 1 ? 'bg-blue-400' : i === 2 ? 'bg-blue-300' : 'bg-gray-300'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Actionable Insights */}
            <div>
              <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">Actionable Insights</h3>
              <div className="space-y-3">
                {analytics.insights.map((insight, i) => (
                  <div key={i} className={`flex gap-4 p-4 rounded-xl border ${
                    insight.type === 'warning' ? 'bg-red-50 border-red-200' :
                    insight.type === 'success' ? 'bg-green-50 border-green-200' :
                    'bg-blue-50 border-blue-200'
                  }`}>
                    <span className="text-xl flex-shrink-0">{insight.icon}</span>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{insight.message}</p>
                      {insight.action && <p className="text-xs text-gray-600 mt-1">→ {insight.action}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>

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
