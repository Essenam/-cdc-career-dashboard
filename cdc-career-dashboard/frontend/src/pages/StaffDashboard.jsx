import React, { useState, useEffect } from 'react';
import { getAllStudents, getStudentsByRisk, getDashboardSummary, getStaffAnalytics } from '../services/api';

function StaffDashboard({ onViewStudent, refreshRef }) {
  const [allStudents, setAllStudents] = useState([]);
  const [summary, setSummary] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [filterRisk, setFilterRisk]           = useState(null);
  const [filterYear, setFilterYear]           = useState(null);
  const [filterMajor, setFilterMajor]         = useState('');
  const [filterSort, setFilterSort]           = useState('default');
  const [filterAppStatus, setFilterAppStatus] = useState(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 25;

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFilterRisk = (level) => {
    setFilterRisk(level === filterRisk ? null : level);
    setCurrentPage(1);
  };

  const clearAllFilters = () => {
    setFilterRisk(null);
    setFilterYear(null);
    setFilterMajor('');
    setFilterSort('default');
    setFilterAppStatus(null);
    setSearch('');
    setCurrentPage(1);
  };

  const hasActiveFilters = filterRisk || filterYear || filterMajor || filterAppStatus || filterSort !== 'default' || search.trim();

  const majors = [...new Set(allStudents.map(s => s.major).filter(Boolean))].sort();

  const getRiskColor = (level) => {
    const l = level?.toLowerCase();
    if (l === 'need outreach') return 'bg-red-100 text-red-800';
    if (l === 'developing')   return 'bg-yellow-100 text-yellow-800';
    if (l === 'engaged')      return 'bg-green-100 text-green-800';
    return 'bg-gray-100 text-gray-600';
  };

  const filteredStudents = allStudents
    .filter(s => {
      if (filterRisk && s.risk_level !== filterRisk) return false;
      if (filterYear && s.current_year !== filterYear) return false;
      if (filterMajor && s.major !== filterMajor) return false;
      if (filterAppStatus === 'interviewing' && !s.has_interview) return false;
      if (filterAppStatus === 'accepted' && !s.has_accepted) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        if (!s.full_name?.toLowerCase().includes(q) && !s.email?.toLowerCase().includes(q) && !s.major?.toLowerCase().includes(q)) return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (filterSort === 'name')       return (a.full_name || '').localeCompare(b.full_name || '');
      if (filterSort === 'score_desc') return (b.engagement_score || 0) - (a.engagement_score || 0);
      if (filterSort === 'score_asc')  return (a.engagement_score || 0) - (b.engagement_score || 0);
      if (filterSort === 'events')     return (b.career_events_attended || 0) - (a.career_events_attended || 0);
      if (filterSort === 'apps')       return (b.job_applications_count || 0) - (a.job_applications_count || 0);
      return 0;
    });

  const exportCSV = () => {
    const headers = ['Name', 'Email', 'Major', 'Year', 'Status', 'Activity Score', 'Events', 'Applications', 'Interviewing', 'Accepted Offer'];
    const rows = filteredStudents.map(s => [
      s.full_name || '',
      s.email || '',
      s.major || '',
      s.current_year ? `Year ${s.current_year}` : '',
      s.risk_level || '',
      s.engagement_score ?? '',
      s.career_events_attended ?? '',
      s.job_applications_count ?? '',
      s.has_interview ? 'Yes' : 'No',
      s.has_accepted  ? 'Yes' : 'No',
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `cdc-students-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className="p-4">Loading...</div>;
  if (error) return <div className="p-6 text-center text-red-600 font-medium">{error}</div>;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Staff Dashboard</h1>
        <div className="flex gap-2">
          <button
            onClick={exportCSV}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold rounded-lg transition border border-gray-300"
          >
            Export CSV
          </button>
          <button
            onClick={fetchData}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition disabled:opacity-50"
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      {summary && (
        <>
          <div className="grid grid-cols-4 gap-4 mb-2">
            <div className="bg-blue-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600 font-medium">Total Students</p>
              <p className="text-3xl font-bold text-blue-800">{summary.totalStudents}</p>
            </div>
            <div className="bg-red-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600 font-medium">Need Outreach</p>
              <p className="text-3xl font-bold text-red-700">{summary.highRiskCount}</p>
              <p className="text-xs text-red-400 mt-1">Low or no platform activity</p>
            </div>
            <div className="bg-yellow-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600 font-medium">Developing</p>
              <p className="text-3xl font-bold text-yellow-700">{summary.mediumRiskCount}</p>
              <p className="text-xs text-yellow-500 mt-1">Some activity, needs encouragement</p>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600 font-medium">Engaged</p>
              <p className="text-3xl font-bold text-green-700">{summary.lowRiskCount}</p>
              <p className="text-xs text-green-500 mt-1">Active on Handshake and CDC platforms</p>
            </div>
          </div>
          <div className="flex items-center justify-between mb-6">
            <p className="text-xs text-gray-400">
              Activity score = events (×20) + applications (×15) + CDC appointments (×10) from Handshake imports.
              Need Outreach &lt; 33 · Developing 33–66 · Engaged 67+
            </p>
            <button
              onClick={handleToggleAnalytics}
              className="flex items-center gap-2 px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white text-sm font-semibold rounded-lg transition"
            >
              <span>📊</span> {showAnalytics ? 'Hide Analytics' : 'Analytics & Insights'}
            </button>
          </div>
        </>
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
                  Milestone Completion
                  <span className="ml-2 font-normal text-gray-400 normal-case">Avg {analytics.engagement_score.avg}% · Median {analytics.engagement_score.median}%</span>
                </h3>
                <div className="space-y-2">
                  {analytics.engagement_distribution.map(({ label, range, count }) => {
                    const pct = analytics.total_students > 0 ? Math.round(count / analytics.total_students * 100) : 0;
                    const barColor = label === 'Need Outreach' ? 'bg-red-400' : label === 'Developing' ? 'bg-yellow-400' : label === 'Engaged' ? 'bg-green-500' : 'bg-gray-300';
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

            {/* Top Employers */}
            {analytics.top_employers?.length > 0 && (
              <div>
                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">
                  Top Employers
                  <span className="ml-2 font-normal text-gray-400 normal-case">by application volume</span>
                </h3>
                <div className="space-y-2">
                  {analytics.top_employers.map((company) => {
                    const maxTotal = analytics.top_employers[0].total;
                    const pct = Math.round(company.total / maxTotal * 100);
                    return (
                      <button
                        key={company.name}
                        onClick={() => setSelectedCompany(company)}
                        className="w-full text-left p-3 rounded-xl border border-gray-100 hover:border-blue-200 hover:bg-blue-50 transition group"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-semibold text-gray-800 group-hover:text-blue-700">{company.name}</span>
                          <div className="flex items-center gap-3 text-xs">
                            {company.accepted > 0 && <span className="text-green-600 font-semibold">{company.accepted} accepted</span>}
                            {company.interviewing > 0 && <span className="text-blue-600 font-semibold">{company.interviewing} interviewing</span>}
                            <span className="text-gray-500">{company.total} app{company.total !== 1 ? 's' : ''} · {company.student_count} student{company.student_count !== 1 ? 's' : ''}</span>
                          </div>
                        </div>
                        <div className="flex gap-1 h-2">
                          {company.accepted > 0 && <div className="bg-green-400 rounded-full" style={{ width: `${company.accepted / company.total * pct}%` }} />}
                          {company.interviewing > 0 && <div className="bg-blue-400 rounded-full" style={{ width: `${company.interviewing / company.total * pct}%` }} />}
                          {company.pending > 0 && <div className="bg-yellow-300 rounded-full" style={{ width: `${company.pending / company.total * pct}%` }} />}
                          {company.declined > 0 && <div className="bg-gray-300 rounded-full" style={{ width: `${company.declined / company.total * pct}%` }} />}
                        </div>
                      </button>
                    );
                  })}
                  <p className="text-xs text-gray-400 mt-1">Green = accepted · Blue = interviewing · Yellow = pending · Gray = declined. Click any employer to see students.</p>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {/* Company detail modal */}
      {selectedCompany && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4" onClick={() => setSelectedCompany(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900">{selectedCompany.name}</h2>
                <p className="text-sm text-gray-500">{selectedCompany.total} application{selectedCompany.total !== 1 ? 's' : ''} · {selectedCompany.student_count} student{selectedCompany.student_count !== 1 ? 's' : ''}</p>
              </div>
              <button onClick={() => setSelectedCompany(null)} className="text-gray-400 hover:text-gray-600 text-xl font-bold">✕</button>
            </div>
            <div className="overflow-y-auto p-6 space-y-3">
              {selectedCompany.applications
                .sort((a, b) => {
                  const order = { accepted: 0, interviewing: 1, pending: 2, declined: 3 };
                  return (order[a.status] ?? 4) - (order[b.status] ?? 4);
                })
                .map((app, i) => {
                  const statusColor = app.status === 'accepted' ? 'bg-green-100 text-green-700' :
                    app.status === 'interviewing' ? 'bg-blue-100 text-blue-700' :
                    app.status === 'declined' ? 'bg-red-100 text-red-600' :
                    'bg-yellow-100 text-yellow-700';
                  return (
                    <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="text-sm font-semibold text-gray-800">{app.student_name}</p>
                        <p className="text-xs text-gray-500">{app.job_title || 'Position not specified'}{app.applied_date ? ` · Applied ${new Date(app.applied_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''}</p>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${statusColor}`}>
                        {app.status.charAt(0).toUpperCase() + app.status.slice(1)}
                      </span>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* Filters + Search */}
      <div className="mb-6 space-y-3">
        {/* Row 1: Status + Year */}
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide mr-1">Status</span>
          {[
            { label: 'Need Outreach', value: 'need outreach', active: 'bg-red-500 text-white', inactive: 'bg-gray-100 hover:bg-red-50 text-gray-700' },
            { label: 'Developing',    value: 'developing',    active: 'bg-yellow-500 text-white', inactive: 'bg-gray-100 hover:bg-yellow-50 text-gray-700' },
            { label: 'Engaged',       value: 'engaged',       active: 'bg-green-500 text-white', inactive: 'bg-gray-100 hover:bg-green-50 text-gray-700' },
          ].map(({ label, value, active, inactive }) => (
            <button key={value} onClick={() => handleFilterRisk(value)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${filterRisk === value ? active : inactive}`}>
              {label}
            </button>
          ))}

          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide mx-2">Year</span>
          {[1, 2, 3, 4].map(y => (
            <button key={y}
              onClick={() => { setFilterYear(filterYear === y ? null : y); setCurrentPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${filterYear === y ? 'bg-blue-500 text-white' : 'bg-gray-100 hover:bg-blue-50 text-gray-700'}`}>
              Y{y}
            </button>
          ))}
        </div>

        {/* Row 2: Major + Sort + App Status + Search + Clear */}
        <div className="flex flex-wrap gap-2 items-center">
          <select
            value={filterMajor}
            onChange={e => { setFilterMajor(e.target.value); setCurrentPage(1); }}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:border-blue-400 bg-white"
          >
            <option value="">All Majors</option>
            {majors.map(m => <option key={m} value={m}>{m}</option>)}
          </select>

          <select
            value={filterSort}
            onChange={e => setFilterSort(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:border-blue-400 bg-white"
          >
            <option value="default">Sort: Default</option>
            <option value="name">Name A → Z</option>
            <option value="score_desc">Score: High → Low</option>
            <option value="score_asc">Score: Low → High</option>
            <option value="events">Most Events</option>
            <option value="apps">Most Applications</option>
          </select>

          {[
            { label: 'Interviewing', value: 'interviewing', color: 'bg-blue-500 text-white' },
            { label: 'Accepted Offer', value: 'accepted', color: 'bg-green-500 text-white' },
          ].map(({ label, value, color }) => (
            <button key={value}
              onClick={() => { setFilterAppStatus(filterAppStatus === value ? null : value); setCurrentPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${filterAppStatus === value ? color : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}>
              {label}
            </button>
          ))}

          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
            placeholder="Search name, email, major…"
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-56 focus:outline-none focus:border-blue-400 ml-auto"
          />

          {hasActiveFilters && (
            <button onClick={clearAllFilters}
              className="px-3 py-1.5 rounded-lg text-sm font-medium text-red-500 hover:bg-red-50 border border-red-200 transition">
              Clear all
            </button>
          )}
        </div>

        {/* Active filter summary */}
        {hasActiveFilters && (
          <p className="text-xs text-gray-500">
            Showing <span className="font-semibold text-gray-800">{filteredStudents.length}</span> of {allStudents.length} students
            {filterRisk && <span> · Status: <span className="font-medium capitalize">{filterRisk}</span></span>}
            {filterYear && <span> · Year {filterYear}</span>}
            {filterMajor && <span> · {filterMajor}</span>}
            {filterAppStatus === 'interviewing' && <span> · Currently interviewing</span>}
            {filterAppStatus === 'accepted' && <span> · Accepted offer</span>}
            {search.trim() && <span> · Search: "{search}"</span>}
          </p>
        )}
      </div>

      {/* Students Table */}
      {(() => {
        const totalPages = Math.ceil(filteredStudents.length / PAGE_SIZE);
        const pageStudents = filteredStudents.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
        return (
          <>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border p-3 text-left">Name</th>
                    <th className="border p-3 text-left">Email</th>
                    <th className="border p-3 text-left">Major</th>
                    <th className="border p-3 text-center">Activity Score</th>
                    <th className="border p-3 text-center">Status</th>
                    <th className="border p-3 text-center">Events</th>
                    <th className="border p-3 text-center">Apps</th>
                    <th className="border p-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pageStudents.length === 0 && (
                    <tr>
                      <td colSpan={8} className="border p-6 text-center text-gray-500">No students match your search.</td>
                    </tr>
                  )}
                  {pageStudents.map((student) => (
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
                      <td className="border p-3 text-center text-gray-600">{student.engagement_score}</td>
                      <td className="border p-3 text-center">
                        <span className={`px-3 py-1 rounded text-xs font-semibold ${getRiskColor(student.risk_level)}`}>
                          {student.risk_level ? student.risk_level.charAt(0).toUpperCase() + student.risk_level.slice(1) : '—'}
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

            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 text-sm text-gray-600">
                <p>
                  Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filteredStudents.length)} of {filteredStudents.length} students
                </p>
                <div className="flex gap-1">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1 rounded border bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    ←
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                    <button
                      key={p}
                      onClick={() => setCurrentPage(p)}
                      className={`px-3 py-1 rounded border ${p === currentPage ? 'bg-blue-600 text-white border-blue-600' : 'bg-white hover:bg-gray-50'}`}
                    >
                      {p}
                    </button>
                  ))}
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 rounded border bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    →
                  </button>
                </div>
              </div>
            )}
          </>
        );
      })()}
    </div>
  );
}

export default StaffDashboard;
