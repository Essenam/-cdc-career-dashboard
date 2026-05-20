import React, { useState } from 'react';
import { uploadCSV, resyncStudents, resetAllData, getAdminRoadmap, createRoadmapTask, updateRoadmapTask, deleteRoadmapTask } from '../services/api';
import api from '../services/api';

function AdminDashboard({ onUploadComplete }) {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);

  const [previewFile, setPreviewFile] = useState(null);
  const [previewing, setPreviewing] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [resyncing, setResyncing] = useState(false);
  const [resyncResult, setResyncResult] = useState(null);
  const [resetting, setResetting] = useState(false);
  const [resetConfirm, setResetConfirm] = useState(false);
  const [resetResult, setResetResult] = useState(null);

  const [milestones, setMilestones] = useState([]);
  const [milestonesOpen, setMilestonesOpen] = useState(false);
  const [milestonesLoading, setMilestonesLoading] = useState(false);
  const [activeYear, setActiveYear] = useState(1);
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');
  const [editSection, setEditSection] = useState('');
  const [editTrigger, setEditTrigger] = useState('');
  const [addingToSection, setAddingToSection] = useState(null);
  const [addText, setAddText] = useState('');
  const [newSectionName, setNewSectionName] = useState('');
  const [addingNewSection, setAddingNewSection] = useState(false);
  const [milestoneError, setMilestoneError] = useState('');

  const handleFileChange = (e) => {
    setFiles(Array.from(e.target.files));
    setResult(null);
    setPreviewData(null);
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (files.length === 0) return;

    setUploading(true);
    setResult(null);

    try {
      const response = await uploadCSV(files);
      setResult({ type: response.data.recordsProcessed > 0 ? 'success' : 'warning', data: response.data });
      if (response.data.recordsProcessed > 0) {
        setFiles([]);
        document.getElementById('fileInput').value = '';
      }
    } catch (error) {
      const msg = error.response?.data?.error || error.message || 'Upload failed';
      setResult({ type: 'error', message: msg });
    } finally {
      setUploading(false);
    }
  };

  const handlePreview = async () => {
    if (!previewFile) return;
    setPreviewing(true);
    setPreviewData(null);
    try {
      const formData = new FormData();
      formData.append('file', previewFile);
      const res = await api.post('/api/admin/preview-csv', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setPreviewData(res.data);
    } catch {
      setPreviewData({ error: 'Could not read file headers.' });
    } finally {
      setPreviewing(false);
    }
  };

  const loadMilestones = async () => {
    setMilestonesLoading(true);
    setMilestoneError('');
    try {
      const res = await getAdminRoadmap();
      setMilestones(res.data || []);
    } catch { setMilestoneError('Failed to load milestones.'); }
    finally { setMilestonesLoading(false); }
  };

  const handleToggleMilestones = () => {
    if (!milestonesOpen && milestones.length === 0) loadMilestones();
    setMilestonesOpen(o => !o);
  };

  const startEdit = (task) => {
    setEditingId(task.id);
    setEditText(task.task_text);
    setEditSection(task.section);
    setEditTrigger(task.trigger || '');
  };

  const saveEdit = async (id) => {
    try {
      const res = await updateRoadmapTask(id, { task_text: editText, section: editSection, trigger: editTrigger || null });
      setMilestones(ms => ms.map(m => m.id === id ? res.data : m));
      setEditingId(null);
    } catch { setMilestoneError('Failed to save changes.'); }
  };

  const handleDelete = async (id) => {
    try {
      await deleteRoadmapTask(id);
      setMilestones(ms => ms.filter(m => m.id !== id));
    } catch { setMilestoneError('Failed to delete task.'); }
  };

  const handleAddTask = async (section) => {
    if (!addText.trim()) return;
    try {
      const maxOrder = milestones.filter(m => m.year === activeYear && m.section === section).length;
      const res = await createRoadmapTask({ year: activeYear, section, task_text: addText.trim(), order_index: maxOrder });
      setMilestones(ms => [...ms, res.data]);
      setAddText('');
      setAddingToSection(null);
    } catch { setMilestoneError('Failed to add task.'); }
  };

  const handleAddNewSection = async () => {
    if (!newSectionName.trim() || !addText.trim()) return;
    try {
      const res = await createRoadmapTask({ year: activeYear, section: newSectionName.trim(), task_text: addText.trim(), order_index: 0 });
      setMilestones(ms => [...ms, res.data]);
      setAddText('');
      setNewSectionName('');
      setAddingNewSection(false);
    } catch { setMilestoneError('Failed to add task.'); }
  };

  const yearTasks = milestones.filter(m => m.year === activeYear);
  const yearSections = [...new Set(yearTasks.map(m => m.section))];
  const yearLabels = { 1: 'Explore', 2: 'Research', 3: 'Develop', 4: 'Implement' };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100">
      <div className="max-w-4xl mx-auto px-6 py-12">

        <div className="mb-8">
          <h1 className="text-4xl font-bold text-blue-900 mb-2">Admin Dashboard</h1>
          <p className="text-gray-600">Upload CSV files exported from Handshake to populate the database</p>
        </div>

        {/* Upload Card */}
        <div className="bg-white rounded-lg shadow-lg p-8 border-2 border-blue-200 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Upload Career Data</h2>

          <form onSubmit={handleUpload} className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                Select CSV Files
              </label>
              <input
                id="fileInput"
                type="file"
                multiple
                accept=".csv"
                onChange={handleFileChange}
                className="block w-full text-sm text-gray-500
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-lg file:border-0
                  file:text-sm file:font-semibold
                  file:bg-blue-600 file:text-white
                  hover:file:bg-blue-700 cursor-pointer"
              />
              <p className="text-xs text-gray-500 mt-2">
                Filename must include: <span className="font-medium">students</span>, <span className="font-medium">applications</span>, <span className="font-medium">fair</span>, <span className="font-medium">events</span>, or <span className="font-medium">appointments</span>
              </p>
            </div>

            {files.length > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm font-semibold text-gray-700 mb-2">Selected files:</p>
                <ul className="space-y-1">
                  {files.map((file, idx) => (
                    <li key={idx} className="text-sm text-gray-600">
                      {file.name} ({(file.size / 1024).toFixed(1)} KB)
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Result feedback */}
            {result && (
              <div className={`p-4 rounded-lg border-2 space-y-3 ${
                result.type === 'success' ? 'bg-green-50 border-green-300 text-green-800'
                : result.type === 'warning' ? 'bg-amber-50 border-amber-300 text-amber-800'
                : 'bg-red-50 border-red-300 text-red-800'
              }`}>
                <p className="font-semibold">
                  {result.type === 'success' && `${result.data.recordsProcessed} records imported successfully.`}
                  {result.type === 'warning' && '0 records were imported.'}
                  {result.type === 'error' && `Error: ${result.message}`}
                </p>
                {result.data?.warnings?.length > 0 && (
                  <ul className="text-sm space-y-1 list-disc list-inside">
                    {result.data.warnings.map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                )}
                {result.type === 'warning' && (
                  <p className="text-sm">Use the CSV Header Inspector below to check if your column names match what the system expects.</p>
                )}
                {result.type === 'success' && (
                  <button
                    onClick={() => onUploadComplete && onUploadComplete()}
                    className="mt-1 w-full py-2 bg-green-700 hover:bg-green-800 text-white font-semibold rounded-lg text-sm transition"
                  >
                    View Updated Staff Dashboard →
                  </button>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={uploading || files.length === 0}
              className={`w-full py-3 px-4 rounded-lg font-bold text-white transition ${
                uploading || files.length === 0
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 cursor-pointer'
              }`}
            >
              {uploading ? 'Uploading...' : 'Upload CSV Files'}
            </button>
          </form>
        </div>

        {/* Resync */}
        <div className="bg-white rounded-lg shadow-lg p-8 border-2 border-purple-200 mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-2">Resync Dashboards</h2>
          <p className="text-sm text-gray-600 mb-4">
            If records are visible in Supabase but not showing in the Staff or Student dashboards, click this to force a resync of all student scores and activity counts.
          </p>
          <button
            onClick={async () => {
              setResyncing(true);
              setResyncResult(null);
              try {
                const res = await resyncStudents();
                setResyncResult({ success: true, count: res.data.students?.length });
                onUploadComplete && onUploadComplete();
              } catch {
                setResyncResult({ success: false });
              } finally {
                setResyncing(false);
              }
            }}
            disabled={resyncing}
            className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition disabled:opacity-50"
          >
            {resyncing ? 'Syncing...' : 'Resync Now'}
          </button>
          {resyncResult && (
            <p className={`mt-3 text-sm font-medium ${resyncResult.success ? 'text-green-700' : 'text-red-600'}`}>
              {resyncResult.success
                ? `Synced ${resyncResult.count} students. Dashboards updated.`
                : 'Resync failed. Check the server logs.'}
            </p>
          )}
        </div>

        {/* CSV Header Inspector */}
        <div className="bg-white rounded-lg shadow-lg p-8 border-2 border-yellow-200 mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-2">CSV Header Inspector</h2>
          <p className="text-sm text-gray-600 mb-4">
            If your upload returns 0 records, use this to see what column headers are in your file and compare them to what the system expects.
          </p>
          <div className="flex gap-3 items-center">
            <input
              type="file"
              accept=".csv"
              onChange={(e) => setPreviewFile(e.target.files[0])}
              className="text-sm text-gray-500 file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-yellow-100 file:text-yellow-800 hover:file:bg-yellow-200 cursor-pointer"
            />
            <button
              onClick={handlePreview}
              disabled={!previewFile || previewing}
              className="px-4 py-2 bg-yellow-400 hover:bg-yellow-500 text-yellow-900 font-semibold rounded-lg text-sm disabled:opacity-50 transition"
            >
              {previewing ? 'Reading...' : 'Inspect Headers'}
            </button>
          </div>

          {previewData && !previewData.error && (
            <div className="mt-4 space-y-3">
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-1">Columns found in your file:</p>
                <div className="flex flex-wrap gap-2">
                  {previewData.headers.map((h, i) => (
                    <span key={i} className="bg-gray-100 text-gray-800 text-xs px-2 py-1 rounded border">{h}</span>
                  ))}
                </div>
              </div>
            </div>
          )}
          {previewData?.error && <p className="mt-3 text-sm text-red-600">{previewData.error}</p>}
        </div>

        {/* Danger Zone — Reset */}
        <div className="bg-white rounded-lg shadow-lg p-8 border-2 border-red-200 mb-8">
          <h2 className="text-xl font-bold text-red-800 mb-2">Reset All Data</h2>
          <p className="text-sm text-gray-600 mb-4">
            Permanently deletes all students, applications, events, and appointments. Use this to clear test data before uploading real Handshake exports.
          </p>
          {!resetConfirm ? (
            <button
              onClick={() => setResetConfirm(true)}
              className="px-6 py-3 bg-red-100 hover:bg-red-200 text-red-800 font-semibold rounded-lg transition border border-red-300"
            >
              Reset All Data
            </button>
          ) : (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-red-700">This cannot be undone. Are you sure?</p>
              <div className="flex gap-3">
                <button
                  onClick={async () => {
                    setResetting(true);
                    setResetResult(null);
                    try {
                      await resetAllData();
                      setResetResult('success');
                      setResetConfirm(false);
                      onUploadComplete && onUploadComplete();
                    } catch {
                      setResetResult('error');
                    } finally {
                      setResetting(false);
                    }
                  }}
                  disabled={resetting}
                  className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition disabled:opacity-50"
                >
                  {resetting ? 'Resetting...' : 'Yes, delete everything'}
                </button>
                <button
                  onClick={() => setResetConfirm(false)}
                  className="px-6 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold rounded-lg transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
          {resetResult === 'success' && (
            <p className="mt-3 text-sm font-medium text-green-700">All data cleared. You can now upload your real files.</p>
          )}
          {resetResult === 'error' && (
            <p className="mt-3 text-sm font-medium text-red-600">Reset failed. Check the server logs.</p>
          )}
        </div>

        {/* Manage Milestones */}
        <div className="bg-white rounded-lg shadow-lg border-2 border-purple-200 mb-8">
          <button
            onClick={handleToggleMilestones}
            className="w-full flex items-center justify-between px-8 py-5 text-left"
          >
            <div>
              <h2 className="text-xl font-bold text-gray-900">Manage Milestones</h2>
              <p className="text-sm text-gray-500 mt-0.5">Add, edit, or remove tasks from the student roadmap</p>
            </div>
            <span className={`text-gray-400 text-xl transition-transform ${milestonesOpen ? 'rotate-180' : ''}`}>▼</span>
          </button>

          {milestonesOpen && (
            <div className="border-t border-purple-100 px-8 pb-8 pt-6">
              {milestoneError && (
                <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2 flex justify-between">
                  <span>{milestoneError}</span>
                  <button onClick={() => setMilestoneError('')} className="font-bold ml-4">✕</button>
                </div>
              )}

              {/* Year tabs */}
              <div className="flex gap-2 mb-6">
                {[1, 2, 3, 4].map(y => (
                  <button
                    key={y}
                    onClick={() => setActiveYear(y)}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${activeYear === y ? 'bg-purple-700 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                  >
                    Year {y}: {yearLabels[y]}
                  </button>
                ))}
              </div>

              {milestonesLoading ? (
                <p className="text-sm text-gray-400 text-center py-8">Loading...</p>
              ) : (
                <div className="space-y-6">
                  {yearSections.map(section => (
                    <div key={section}>
                      <p className="text-xs font-bold text-purple-700 uppercase tracking-wider mb-2">{section}</p>
                      <div className="space-y-2">
                        {yearTasks.filter(t => t.section === section).map(task => (
                          <div key={task.id} className="bg-purple-50 border border-purple-200 rounded-lg">
                            {editingId === task.id ? (
                              <div className="p-3 space-y-2">
                                <input
                                  value={editSection}
                                  onChange={e => setEditSection(e.target.value)}
                                  className="w-full border border-purple-300 rounded px-3 py-1.5 text-xs text-gray-700 focus:outline-none focus:border-purple-600"
                                  placeholder="Section name"
                                />
                                <textarea
                                  value={editText}
                                  onChange={e => setEditText(e.target.value)}
                                  rows={2}
                                  className="w-full border border-purple-300 rounded px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:border-purple-600 resize-none"
                                />
                                <select
                                  value={editTrigger}
                                  onChange={e => setEditTrigger(e.target.value)}
                                  className="w-full border border-purple-300 rounded px-3 py-1.5 text-xs text-gray-700 focus:outline-none focus:border-purple-600"
                                >
                                  <option value="">No auto-trigger (manual only)</option>
                                  <optgroup label="Events">
                                    <option value="event:any">Any event attended</option>
                                    <option value="event:career_fair">Career fair attended</option>
                                    <option value="event:negotiation">Salary/negotiation workshop</option>
                                  </optgroup>
                                  <optgroup label="Appointments">
                                    <option value="appointment:any">Any CDC appointment</option>
                                    <option value="appointment:resume">Resume review appointment</option>
                                    <option value="appointment:mock">Mock interview appointment</option>
                                    <option value="appointment:offer">Offer evaluation appointment</option>
                                  </optgroup>
                                  <optgroup label="Applications">
                                    <option value="application:any">Any application submitted</option>
                                    <option value="application:accepted">Application accepted</option>
                                  </optgroup>
                                  <optgroup label="Documents">
                                    <option value="document:resume">Resume uploaded to Handshake</option>
                                  </optgroup>
                                </select>
                                <div className="flex gap-2">
                                  <button onClick={() => saveEdit(task.id)} className="px-3 py-1 bg-purple-700 text-white text-xs font-semibold rounded hover:bg-purple-800 transition">Save</button>
                                  <button onClick={() => setEditingId(null)} className="px-3 py-1 bg-gray-200 text-gray-700 text-xs font-semibold rounded hover:bg-gray-300 transition">Cancel</button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-start gap-3 px-4 py-3">
                                <div className="flex-1">
                                  <p className="text-sm text-gray-800 leading-snug">{task.task_text}</p>
                                  {task.trigger && (
                                    <span className="inline-block mt-1 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                                      auto: {task.trigger}
                                    </span>
                                  )}
                                </div>
                                <div className="flex gap-1 shrink-0">
                                  <button onClick={() => startEdit(task)} className="text-xs text-purple-600 hover:text-purple-900 font-medium px-2 py-1 rounded hover:bg-purple-100 transition">Edit</button>
                                  <button onClick={() => handleDelete(task.id)} className="text-xs text-red-400 hover:text-red-700 font-medium px-2 py-1 rounded hover:bg-red-50 transition">Delete</button>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}

                        {/* Add task to existing section */}
                        {addingToSection === section ? (
                          <div className="border border-dashed border-purple-300 rounded-lg p-3 space-y-2">
                            <textarea
                              value={addText}
                              onChange={e => setAddText(e.target.value)}
                              rows={2}
                              placeholder="New task description..."
                              className="w-full border border-purple-300 rounded px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:border-purple-600 resize-none"
                              autoFocus
                            />
                            <div className="flex gap-2">
                              <button onClick={() => handleAddTask(section)} className="px-3 py-1 bg-purple-700 text-white text-xs font-semibold rounded hover:bg-purple-800 transition">Add</button>
                              <button onClick={() => { setAddingToSection(null); setAddText(''); }} className="px-3 py-1 bg-gray-200 text-gray-700 text-xs font-semibold rounded hover:bg-gray-300 transition">Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => { setAddingToSection(section); setAddText(''); setAddingNewSection(false); }}
                            className="w-full text-left text-xs text-purple-500 hover:text-purple-800 font-medium py-1 px-1"
                          >
                            + Add task to this section
                          </button>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Add new section */}
                  {addingNewSection ? (
                    <div className="border-2 border-dashed border-purple-300 rounded-lg p-4 space-y-2">
                      <input
                        value={newSectionName}
                        onChange={e => setNewSectionName(e.target.value)}
                        placeholder="New section name..."
                        className="w-full border border-purple-300 rounded px-3 py-2 text-sm font-semibold text-gray-800 focus:outline-none focus:border-purple-600"
                        autoFocus
                      />
                      <textarea
                        value={addText}
                        onChange={e => setAddText(e.target.value)}
                        rows={2}
                        placeholder="First task in this section..."
                        className="w-full border border-purple-300 rounded px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:border-purple-600 resize-none"
                      />
                      <div className="flex gap-2">
                        <button onClick={handleAddNewSection} className="px-3 py-1 bg-purple-700 text-white text-xs font-semibold rounded hover:bg-purple-800 transition">Create Section</button>
                        <button onClick={() => { setAddingNewSection(false); setAddText(''); setNewSectionName(''); }} className="px-3 py-1 bg-gray-200 text-gray-700 text-xs font-semibold rounded hover:bg-gray-300 transition">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setAddingNewSection(true); setAddingToSection(null); setAddText(''); }}
                      className="w-full border-2 border-dashed border-purple-200 rounded-lg py-3 text-sm text-purple-500 hover:text-purple-800 hover:border-purple-400 font-medium transition"
                    >
                      + Add new section to Year {activeYear}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Expected Format */}
        <div className="bg-gray-50 border-2 border-gray-200 rounded-lg p-6">
          <h3 className="text-xl font-bold text-gray-900 mb-4">Expected Column Headers</h3>
          <p className="text-xs text-gray-500 mb-4">Filename must include the keyword shown. All files are tab-separated exports from Handshake.</p>
          <div className="space-y-4 text-sm">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="font-semibold text-blue-900 mb-1">students.csv <span className="font-normal text-blue-700">— upload first. One row per document; students with multiple docs appear multiple times.</span></p>
              <code className="block bg-white border border-gray-300 p-3 rounded text-xs text-gray-700 overflow-x-auto">
                Students Card Id · Students First Name · Students Last Name · Students Email - Primary · School Year Name · Majors Name · Colleges Name · Students Self-Reported Graduation Date · Document Types Name · Documents Document Name
              </code>
            </div>
            <div>
              <p className="font-semibold text-gray-900 mb-1">applications.csv</p>
              <code className="block bg-white border border-gray-300 p-3 rounded text-xs text-gray-700 overflow-x-auto">
                Applicant (student) Card Id · Applicant (student) First Name · Applicant (student) Last Name · Applicant (student) Email - Institution · Applications Application Type · Employer Name · Job Title · Applications Status · Job External Apply? (Yes / No)
              </code>
            </div>
            <div>
              <p className="font-semibold text-gray-900 mb-1">fair.csv — career fair attendees</p>
              <code className="block bg-white border border-gray-300 p-3 rounded text-xs text-gray-700 overflow-x-auto">
                Student Attendees Card Id · Student Attendees First Name · Student Attendees Last Name · Student Attendees Email - Institution · Career Fairs Name · Career Fair Dates and Times Start Date · Student Attendee Majors Name · Student Attendee School Year (at Fair Time) Name
              </code>
            </div>
            <div>
              <p className="font-semibold text-gray-900 mb-1">events.csv — general events &amp; info sessions</p>
              <code className="block bg-white border border-gray-300 p-3 rounded text-xs text-gray-700 overflow-x-auto">
                Student Attendees Card Id · Student Attendees First Name · Student Attendees Last Name · Student Attendees Email - Institution · Events Name · Events Start Date Date · Student Attendee Majors Name · Event Type Name · Attendees Checked In? (Yes / No) · Student Attendee School Years Name
              </code>
            </div>
            <div>
              <p className="font-semibold text-gray-900 mb-1">appointments.csv — CDC advising appointments</p>
              <code className="block bg-white border border-gray-300 p-3 rounded text-xs text-gray-700 overflow-x-auto">
                Student Card Id · Student First Name · Student Last Name · Appointments Start Date Date · Staff Member First Name · Staff Member Last Name · Student Majors (at Appt. Time) Name List · Student School Year (at Appt. Time) Name List · Appointment Types Name List · Appointments Description
              </code>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

export default AdminDashboard;
