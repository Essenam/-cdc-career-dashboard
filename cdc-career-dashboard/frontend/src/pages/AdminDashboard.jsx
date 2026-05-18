import React, { useState } from 'react';
import { uploadCSV, resyncStudents, resetAllData } from '../services/api';
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
                File name must include "students", "roster", "applications", "events", or "appointments"
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

        {/* Expected Format */}
        <div className="bg-gray-50 border-2 border-gray-200 rounded-lg p-6">
          <h3 className="text-xl font-bold text-gray-900 mb-4">Expected Column Headers</h3>
          <div className="space-y-4 text-sm">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="font-semibold text-blue-900 mb-1">students.csv or roster.csv <span className="font-normal text-blue-700">(upload this first to register student names)</span></p>
              <code className="block bg-white border border-gray-300 p-3 rounded text-xs text-gray-700 overflow-x-auto">
                Card Id, First Name, Last Name, Email, Major, Graduation Date
              </code>
            </div>
            <div>
              <p className="font-semibold text-gray-900 mb-1">applications.csv</p>
              <code className="block bg-white border border-gray-300 p-3 rounded text-xs text-gray-700 overflow-x-auto">
                Applicant (student) Card Id, Applicant (student) First Name, Applicant (student) Last Name, Employer Name, Job Title, Applications Created At Date, Applications Status, Applications Fully Qualified? (Yes / No), Job External Apply? (Yes / No)
              </code>
            </div>
            <div>
              <p className="font-semibold text-gray-900 mb-1">events.csv</p>
              <code className="block bg-white border border-gray-300 p-3 rounded text-xs text-gray-700 overflow-x-auto">
                Card Id, Content, Start Date Date, Staff Name
              </code>
            </div>
            <div>
              <p className="font-semibold text-gray-900 mb-1">appointments.csv</p>
              <code className="block bg-white border border-gray-300 p-3 rounded text-xs text-gray-700 overflow-x-auto">
                Card Id, Content, Start Date Time, Minutes Advising Time, Staff Name
              </code>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

export default AdminDashboard;
