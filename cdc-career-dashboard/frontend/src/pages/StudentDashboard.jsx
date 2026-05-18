import React, { useState, useEffect, useRef } from 'react';
import { getStudentProfile, getStudentEvents, getStudentApplications, getStudentInterviews, searchStudents, getTaskCompletions, saveTaskCompletion, deleteTaskCompletion } from '../services/api';

function StudentDashboard({ setView, initialStudentId, fromStaff }) {
  const [student, setStudent] = useState(null);
  const [events, setEvents] = useState([]);
  const [applications, setApplications] = useState([]);
  const [interviews, setInterviews] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedYear, setExpandedYear] = useState(3);
  const [showRecommendations, setShowRecommendations] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [studentId, setStudentId] = useState(null);
  const [lookupError, setLookupError] = useState('');
  const [manualCompletions, setManualCompletions] = useState({});
  const [proofFiles, setProofFiles] = useState({});
  const [uploadError, setUploadError] = useState('');
  const searchTimeout = useRef(null);

  const fetchData = async (id) => {
    setLoading(true);
    setLookupError('');
    setSearchResults([]);
    try {
      const [studentRes, eventsRes, appsRes, interviewsRes] = await Promise.all([
        getStudentProfile(id),
        getStudentEvents(id),
        getStudentApplications(id),
        getStudentInterviews(id)
      ]);
      setStudent(studentRes.data);
      setEvents(eventsRes.data || []);
      setApplications(appsRes.data || []);
      setInterviews(interviewsRes.data || []);
    } catch (error) {
      setStudent(null);
      setLookupError('Student not found. Please try a different name, email, or ID.');
    } finally {
      setLoading(false);
    }
  };

  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearchQuery(val);
    setLookupError('');
    clearTimeout(searchTimeout.current);
    if (val.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    searchTimeout.current = setTimeout(async () => {
      try {
        const res = await searchStudents(val.trim());
        setSearchResults(res.data || []);
      } catch {
        setSearchResults([]);
      }
    }, 300);
  };

  const handleSelectStudent = (s) => {
    setStudentId(s.student_id);
    setSearchQuery('');
    fetchData(s.student_id);
  };

  useEffect(() => {
    if (initialStudentId) {
      setStudentId(initialStudentId);
      fetchData(initialStudentId);
    }
  }, [initialStudentId]);

  useEffect(() => {
    if (!student?.student_id) return;
    setManualCompletions({});
    setProofFiles({});
    setUploadError('');

    const loadCompletions = async () => {
      try {
        const res = await getTaskCompletions(student.student_id);
        const completions = {};
        const proofs = {};
        for (const row of res.data) {
          completions[row.task_key] = row.completed;
          if (row.proof_name) {
            proofs[row.task_key] = {
              name: row.proof_name,
              type: row.proof_type,
              size: row.proof_size,
              dataUrl: row.proof_data
            };
          }
        }
        setManualCompletions(completions);
        setProofFiles(proofs);
        // keep localStorage in sync as a fast-load cache
        try {
          localStorage.setItem(`cdc_tasks_${student.student_id}`, JSON.stringify(completions));
          localStorage.setItem(`cdc_proofs_${student.student_id}`, JSON.stringify(proofs));
        } catch {}
      } catch {
        // API unavailable — fall back to localStorage cache
        try {
          const savedTasks = localStorage.getItem(`cdc_tasks_${student.student_id}`);
          const savedProofs = localStorage.getItem(`cdc_proofs_${student.student_id}`);
          if (savedTasks) setManualCompletions(JSON.parse(savedTasks));
          if (savedProofs) setProofFiles(JSON.parse(savedProofs));
        } catch {}
      }
    };

    loadCompletions();
  }, [student?.student_id]);

  const calculateYearProgress = (year) => {
    if (!student) return { pct: 0, completed: 0 };
    const currentYear = student.current_year || student.class_year || 3;
    if (year > currentYear) return { pct: 0, completed: 0 };
    const tasks = getRoadmapTasks(year);
    const completed = tasks.filter(t => isTaskCompleted(year, t.task, t.completed)).length;
    const pct = tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 0;
    return { pct, completed, total: tasks.length };
  };

  const getYearLabel = (year) => {
    const labels = ['', 'Explore', 'Research', 'Develop', 'Implement'];
    return labels[year] || `Year ${year}`;
  };

  const groupTasksBySection = (tasks) => {
    const sections = {};
    tasks.forEach(task => {
      const key = task.section || 'Tasks';
      if (!sections[key]) sections[key] = [];
      sections[key].push(task);
    });
    return sections;
  };

  const taskKey = (year, taskText) =>
    `${year}__${taskText.replace(/\W+/g, '_').slice(0, 60)}`;

  const isTaskCompleted = (year, taskText, autoCompleted) => {
    const key = taskKey(year, taskText);
    return key in manualCompletions ? manualCompletions[key] : autoCompleted;
  };

  const toggleTaskCompletion = (year, taskText, autoCompleted) => {
    const key = taskKey(year, taskText);
    const current = isTaskCompleted(year, taskText, autoCompleted);
    const nowChecked = !current;

    // Update UI immediately
    const updatedTasks = { ...manualCompletions, [key]: nowChecked };
    setManualCompletions(updatedTasks);
    try { localStorage.setItem(`cdc_tasks_${student?.student_id}`, JSON.stringify(updatedTasks)); } catch {}

    // Remove proof when unchecking
    if (current && proofFiles[key]) {
      const updatedProofs = { ...proofFiles };
      delete updatedProofs[key];
      setProofFiles(updatedProofs);
      try { localStorage.setItem(`cdc_proofs_${student?.student_id}`, JSON.stringify(updatedProofs)); } catch {}
    }

    // Persist to Supabase
    if (nowChecked) {
      saveTaskCompletion(student.student_id, key, { completed: true }).catch(() => {});
    } else {
      deleteTaskCompletion(student.student_id, key).catch(() => {});
    }

    setUploadError('');
  };

  const handleProofUpload = (year, taskText, e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError('');
    if (file.size > 1.5 * 1024 * 1024) {
      setUploadError(`"${file.name}" is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Please use a file under 1.5 MB — a compressed screenshot works great.`);
      e.target.value = '';
      return;
    }
    const key = taskKey(year, taskText);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const proof = { name: file.name, type: file.type, size: file.size, dataUrl: ev.target.result };
      const updatedProofs = { ...proofFiles, [key]: proof };
      setProofFiles(updatedProofs);
      try { localStorage.setItem(`cdc_proofs_${student?.student_id}`, JSON.stringify(updatedProofs)); } catch {}

      // Persist proof to Supabase alongside the completion
      saveTaskCompletion(student.student_id, key, {
        completed: true,
        proof_name: file.name,
        proof_type: file.type,
        proof_size: file.size,
        proof_data: ev.target.result
      }).catch(() => {});
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const removeProof = (year, taskText) => {
    const key = taskKey(year, taskText);
    const updatedProofs = { ...proofFiles };
    delete updatedProofs[key];
    setProofFiles(updatedProofs);
    try { localStorage.setItem(`cdc_proofs_${student?.student_id}`, JSON.stringify(updatedProofs)); } catch {}

    // Clear proof fields in Supabase but keep the task checked
    saveTaskCompletion(student.student_id, key, { completed: true }).catch(() => {});
  };

  const getRoadmapTasks = (year) => {
    if (!student) return [];
    const tasks = {
      1: [
        // Self-Assessment & Planning
        { task: 'Complete your PathwayU profile (Interests, Values, Personality, Workplace Preferences assessments) to explore career pathways aligned with your gifts', section: 'Self-Assessment & Planning', completed: false },
        { task: 'Create or update your resume using Jobscan resume checker for initial formatting feedback', section: 'Self-Assessment & Planning', completed: false },
        { task: 'Build your LinkedIn profile with a professional photo and headline', section: 'Self-Assessment & Planning', completed: false },
        // Activate Your Platforms
        { task: 'Log in to Handshake and complete your profile with skills, interests, and desired job/internship types', section: 'Activate Your Platforms', completed: false },
        { task: 'Activate your St. Thomas Connect account to begin exploring the alumni network and fields of interest', section: 'Activate Your Platforms', completed: false },
        { task: 'Set up automatic job feeds on Handshake tailored to your interests', section: 'Activate Your Platforms', completed: false },
        // Build Foundations Through Mentorship & Experience
        { task: 'Connect with a trusted mentor – meet with a Career Educator at the CDC to discuss your interests and goals', section: 'Build Foundations Through Mentorship & Experience', completed: false },
        { task: 'Attend introductory CDC workshops and events to build career awareness', section: 'Build Foundations Through Mentorship & Experience', completed: student.career_events_attended > 0 },
        { task: 'Explore student clubs, activities, and part-time work relevant to your career interests (building early experience)', section: 'Build Foundations Through Mentorship & Experience', completed: false },
        { task: 'Build early experience through summer jobs or volunteer opportunities to develop transferable skills', section: 'Build Foundations Through Mentorship & Experience', completed: false },
        // Use Data for Exploration
        { task: 'Use the Labor Market Tool to research job trends and growth opportunities in industries of interest', section: 'Use Data for Exploration', completed: false },
        { task: 'Explore "What Can I Do With This Major?" resources to connect academic programs with career paths', section: 'Use Data for Exploration', completed: false },
      ],
      2: [
        // Strategic Career Planning with Mentorship
        { task: 'Create an initial career plan with a Career Educator at the CDC based on your interests, skills, and values from PathwayU', section: 'Strategic Career Planning with Mentorship', completed: false },
        { task: 'Schedule regular mentoring sessions with a trusted advisor to discuss your major/minor choice and career direction', section: 'Strategic Career Planning with Mentorship', completed: false },
        { task: 'Conduct informational interviews or job shadows with professionals in your target fields to clarify your interests', section: 'Strategic Career Planning with Mentorship', completed: false },
        // Research & Network Strategically
        { task: 'Use the Labor Market Tool to identify high-demand roles, salary expectations, and growth opportunities in your target fields', section: 'Research & Network Strategically', completed: false },
        { task: "Leverage Jobscan to analyze job descriptions in roles you're targeting and identify key skills employers seek", section: 'Research & Network Strategically', completed: false },
        { task: 'Use St. Thomas Connect to find alumni in your target industries and request informational interviews', section: 'Research & Network Strategically', completed: false },
        { task: 'Search and explore internship & job postings on Handshake to understand typical qualifications and skill requirements', section: 'Research & Network Strategically', completed: student.job_applications_count > 0 },
        { task: 'Attend CDC workshops and events, including on-campus career fairs, to practice networking skills and connect with employers', section: 'Research & Network Strategically', completed: student.career_events_attended >= 3 },
        // Build Your Professional Foundation
        { task: 'Update your resume & personal statement based on Handshake job descriptions and Jobscan feedback', section: 'Build Your Professional Foundation', completed: false },
        { task: 'Have your resume reviewed at the CDC by a career professional', section: 'Build Your Professional Foundation', completed: false },
        { task: 'Establish & grow your personal and professional network—everyone counts: classmates, peers, faculty, staff, friends, family, and co-workers', section: 'Build Your Professional Foundation', completed: false },
        { task: 'Join professional associations or student organizations related to your major and career interests', section: 'Build Your Professional Foundation', completed: false },
      ],
      3: [
        // Gain Meaningful Experiential Learning
        { task: 'Find internships on Handshake using Labor Market Tool insights to identify relevant companies and industries', section: 'Gain Meaningful Experiential Learning', completed: student.job_applications_count >= 5 },
        { task: 'Apply for leadership positions, research opportunities, or part-time roles that build career-relevant skills', section: 'Gain Meaningful Experiential Learning', completed: false },
        { task: 'Gain relevant experience through internships, leadership positions, volunteer work, research, or employment', section: 'Gain Meaningful Experiential Learning', completed: false },
        { task: 'Reflect on your experiences and discuss career implications with your CDC mentor or advisor', section: 'Gain Meaningful Experiential Learning', completed: false },
        // Practice & Polish Your Professional Skills
        { task: 'Schedule a Big Interview session or mock interview with the CDC to practice in a low-stakes setting', section: 'Practice & Polish Your Professional Skills', completed: interviews.length > 0 },
        { task: 'Use Big Interview to practice interview skills with AI-powered video coaching and receive personalized feedback', section: 'Practice & Polish Your Professional Skills', completed: false },
        { task: 'Research target careers, industries, potential employers, and graduate school possibilities using Handshake and Labor Market Tool', section: 'Practice & Polish Your Professional Skills', completed: false },
        { task: 'Build & polish your brand on LinkedIn using the St. Thomas LinkedIn Optimization Guide', section: 'Practice & Polish Your Professional Skills', completed: false },
        { task: 'Optimize your Handshake profile to increase visibility to employers searching for candidates with your experience', section: 'Practice & Polish Your Professional Skills', completed: false },
        // Expand Your Professional Network
        { task: 'Connect with employers at Handshake career & opportunity fairs, both on and off-campus', section: 'Expand Your Professional Network', completed: student.career_events_attended >= 5 },
        { task: 'Use St. Thomas Connect to expand your professional network and find alumni mentors at target companies', section: 'Expand Your Professional Network', completed: false },
        { task: 'Identify and join professional associations related to your career interests (e.g., industry groups, regional chapters)', section: 'Expand Your Professional Network', completed: false },
        { task: 'Continue building relationships with peers, mentors, and professionals in your field', section: 'Expand Your Professional Network', completed: false },
        { task: 'Attend networking events, informational sessions, and industry conferences when possible', section: 'Expand Your Professional Network', completed: student.career_events_attended >= 7 },
        // Optimize Your Application Materials
        { task: "Use Jobscan to align your resume and LinkedIn profile keywords with job descriptions you're targeting", section: 'Optimize Your Application Materials', completed: false },
        { task: 'Get feedback from CDC advisors and mentors on your resume and application materials', section: 'Optimize Your Application Materials', completed: false },
        { task: 'Tailor your resume and LinkedIn profile for roles you\'re targeting', section: 'Optimize Your Application Materials', completed: applications.length >= 3 },
      ],
      4: [
        // Strategic Job Search
        { task: 'Search for full-time positions on Handshake using Labor Market Tool salary and location filters to make informed decisions', section: 'Strategic Job Search', completed: student.job_applications_count >= 7 },
        { task: 'Continually develop & refine your LinkedIn profile and resume using Jobscan feedback as you apply', section: 'Strategic Job Search', completed: false },
        { task: 'Prepare and submit applications for employment or graduate/professional schools', section: 'Strategic Job Search', completed: student.job_applications_count >= 10 },
        { task: 'Cast a wider net: use multiple job boards in addition to Handshake for maximum opportunity exposure', section: 'Strategic Job Search', completed: false },
        // Master the Interview Process
        { task: 'Use Big Interview for final interview prep before company meetings and final rounds', section: 'Master the Interview Process', completed: false },
        { task: 'Practice with CDC-facilitated mock interviews to refine your storytelling and responses', section: 'Master the Interview Process', completed: interviews.length > 0 },
        { task: 'Ask mentors or alumni for feedback on your interview approach', section: 'Master the Interview Process', completed: false },
        // Leverage Your Network & Alumni Connections
        { task: 'Nurture your network: attend student/alumni and networking events, and find chances for one-on-one informational meetings', section: 'Leverage Your Network & Alumni Connections', completed: student.career_events_attended >= 10 },
        { task: 'Use St. Thomas Connect to reconnect with alumni and request coffee chats, mentorship, or informational interviews', section: 'Leverage Your Network & Alumni Connections', completed: false },
        { task: 'Connect with employers at Handshake-hosted career fairs, company information sessions, and student club events', section: 'Leverage Your Network & Alumni Connections', completed: false },
        { task: 'Leverage Handshake messaging to follow up with recruiters and build relationships', section: 'Leverage Your Network & Alumni Connections', completed: false },
        { task: 'Activate your trusted mentors and advisors for encouragement and next-step guidance as you navigate your search', section: 'Leverage Your Network & Alumni Connections', completed: false },
        // Negotiate & Close Your Offer
        { task: 'Attend CDC workshops on negotiating salary and benefits to advocate for yourself effectively', section: 'Negotiate & Close Your Offer', completed: false },
        { task: 'Use Labor Market Tool salary data to inform your negotiation discussions', section: 'Negotiate & Close Your Offer', completed: false },
        { task: 'Consult with your mentors or CDC advisor on evaluating offers and making your decision', section: 'Negotiate & Close Your Offer', completed: false },
        { task: 'Have professional attire ready for interviews and in-person meetings', section: 'Negotiate & Close Your Offer', completed: false },
        { task: 'Close the loop by informing your network and mentors once you\'ve accepted a position', section: 'Negotiate & Close Your Offer', completed: false },
      ]
    };
    return tasks[year] || [];
  };

  const generateRecommendations = () => {
    if (!student) return [];
    const currentYear = student.current_year || student.class_year || 3;
    const yearsToCheck = currentYear > 1 ? [currentYear - 1, currentYear] : [currentYear];

    const hasIncomplete = (...sections) =>
      yearsToCheck.some(y =>
        getRoadmapTasks(y).some(
          t => sections.includes(t.section) && !isTaskCompleted(y, t.task, t.completed)
        )
      );

    const recs = [];

    if (hasIncomplete('Self-Assessment & Planning')) {
      recs.push({
        id: 'pathwayu',
        title: 'Complete Your Self-Assessment',
        description: 'Finish your PathwayU profile to discover career pathways aligned with your interests, values, and personality.',
        action: 'Start PathwayU',
        icon: '🧭',
        link: 'https://stthomas.pathwayu.com/login?next=%2Fjourney'
      });
    }

    if (hasIncomplete('Activate Your Platforms')) {
      recs.push({
        id: 'platforms',
        title: 'Activate Your Career Platforms',
        description: 'Set up your Handshake and St. Thomas Connect profiles to access job postings, events, and alumni mentors.',
        action: 'Go to Handshake',
        icon: '🚀',
        link: 'https://stthomas.joinhandshake.com'
      });
    }

    if (hasIncomplete(
      'Build Foundations Through Mentorship & Experience',
      'Strategic Career Planning with Mentorship',
      'Gain Meaningful Experiential Learning'
    )) {
      recs.push({
        id: 'cdc',
        title: 'Meet with a Career Educator',
        description: 'Schedule time at the CDC to build your career plan, reflect on your experiences, and get personalized guidance.',
        action: 'Schedule Appointment',
        icon: '🎓',
        link: 'https://stthomas.joinhandshake.com/appointments'
      });
    }

    if (hasIncomplete(
      'Research & Network Strategically',
      'Expand Your Professional Network',
      'Leverage Your Network & Alumni Connections'
    )) {
      recs.push({
        id: 'connect',
        title: 'Expand Your Network',
        description: 'Connect with St. Thomas alumni in your target industries for informational interviews and mentorship.',
        action: 'Find Alumni',
        icon: '🤝',
        link: 'https://stthomas.peoplegrove.com/hub/st-thomas-connect/home-v3'
      });
    }

    if (hasIncomplete(
      'Build Your Professional Foundation',
      'Optimize Your Application Materials',
      'Strategic Job Search'
    )) {
      recs.push({
        id: 'jobscan',
        title: 'Optimize Your Resume',
        description: 'Use Jobscan to match your resume keywords to job descriptions and increase your chances of landing interviews.',
        action: 'Open Jobscan',
        icon: '📄',
        link: 'https://www.jobscan.co'
      });
    }

    if (hasIncomplete('Use Data for Exploration', 'Research & Network Strategically')) {
      recs.push({
        id: 'events',
        title: 'Attend Career Events',
        description: `You've attended ${student.career_events_attended || 0} events. Browse upcoming career fairs and networking sessions on Handshake.`,
        action: 'Browse Events',
        icon: '📅',
        link: 'https://stthomas.joinhandshake.com/events'
      });
    }

    if (hasIncomplete('Practice & Polish Your Professional Skills', 'Master the Interview Process')) {
      recs.push({
        id: 'biginterview',
        title: 'Practice Your Interview Skills',
        description: 'Use Big Interview for AI-powered video coaching and mock interview feedback before your next real interview.',
        action: 'Practice Now',
        icon: '🎤',
        link: 'https://stthomas.biginterview.com'
      });
    }

    const appThreshold = { 1: 1, 2: 3, 3: 5, 4: 10 }[currentYear] || 5;
    if ((student.job_applications_count || 0) < appThreshold) {
      recs.push({
        id: 'apply',
        title: 'Apply to Opportunities',
        description: `You've submitted ${student.job_applications_count || 0} application${student.job_applications_count !== 1 ? 's' : ''}. Search for ${currentYear >= 3 ? 'internships and full-time roles' : 'internships and early opportunities'} on Handshake.`,
        action: 'Search Opportunities',
        icon: '💼',
        link: 'https://stthomas.joinhandshake.com/jobs'
      });
    }

    if (currentYear === 4 && hasIncomplete('Negotiate & Close Your Offer')) {
      recs.push({
        id: 'negotiate',
        title: 'Prepare to Negotiate Your Offer',
        description: 'Attend CDC workshops on salary negotiation and use the Labor Market Tool to benchmark compensation in your target field.',
        action: 'Get Guidance',
        icon: '💰',
        link: 'https://stthomas.joinhandshake.com/appointments'
      });
    }

    if (recs.length === 0) {
      recs.push({
        id: 'done',
        title: 'You\'re on Track!',
        description: `Great work — you've completed the key tasks for Year ${currentYear}. Keep building momentum and check back as you progress.`,
        action: 'View Roadmap',
        icon: '🌟',
        link: null
      });
    }

    return recs;
  };

  if (!studentId || (!loading && !student)) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-purple-50 via-pink-50 to-blue-50">
        <div className="bg-white rounded-2xl shadow-lg border-2 border-purple-200 p-10 w-full max-w-md">
          <h1 className="text-3xl font-bold text-purple-800 mb-2">Student Journey</h1>
          <p className="text-gray-600 mb-8">Enter your student ID or name to view your career dashboard.</p>

          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={handleSearchChange}
              placeholder="Enter your student ID or name..."
              className="w-full border-2 border-purple-200 rounded-lg px-4 py-3 text-gray-900 focus:outline-none focus:border-purple-600"
              autoFocus
            />

            {searchResults.length > 0 && (
              <ul className="absolute z-10 w-full bg-white border-2 border-purple-200 rounded-lg mt-1 shadow-lg overflow-hidden">
                {searchResults.map((s) => (
                  <li key={s.student_id}>
                    <button
                      onClick={() => handleSelectStudent(s)}
                      className="w-full text-left px-4 py-3 hover:bg-purple-50 transition border-b border-purple-100 last:border-0"
                    >
                      <p className="font-semibold text-gray-900">{s.full_name || s.student_id}</p>
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

          {lookupError && <p className="mt-4 text-red-600 text-sm">{lookupError}</p>}
          {loading && <p className="mt-4 text-purple-600 text-sm text-center">Loading your dashboard...</p>}
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-purple-50 to-blue-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-purple-800 mb-4"></div>
          <p className="text-gray-700 font-medium">Loading your journey...</p>
        </div>
      </div>
    );
  }

  const currentYear = student.current_year || student.class_year || 3;
  const graduationYear = student.graduation_date ? new Date(student.graduation_date).getFullYear() : 'TBD';
  const recommendations = generateRecommendations();

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 via-pink-50 to-blue-50">

      {fromStaff && (
        <div className="sticky top-0 z-50 bg-amber-50 border-b-2 border-amber-400 px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-amber-600 text-xl">⚠️</span>
            <div>
              <p className="font-semibold text-amber-900 text-sm">
                Staff Preview: You are viewing this dashboard as <span className="underline">{student.full_name}</span>
              </p>
              <p className="text-amber-700 text-xs mt-0.5">
                Any action taken from this view (opening platforms, scheduling appointments, or following links) will be performed on behalf of this student. Proceed with caution.
              </p>
            </div>
          </div>
          <button
            onClick={() => setView && setView('staff')}
            className="shrink-0 text-xs font-semibold bg-amber-400 hover:bg-amber-500 text-amber-900 px-4 py-2 rounded-lg transition"
          >
            Exit to Staff Dashboard
          </button>
        </div>
      )}

      {/* Header */}
      <div className="border-b border-purple-200 bg-white">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-4xl font-bold text-purple-800 mb-1">Guided Student Journey</h1>
              <p className="text-gray-700">
                Welcome back, <span className="font-semibold">{student.first_name || student.full_name || 'Student'}</span> · {student.major || 'Undeclared'} · {getYearLabel(currentYear)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600 mb-1">Class of {graduationYear}</p>
              {fromStaff ? (
                <button
                  onClick={() => setView && setView('staff')}
                  className="text-xs text-blue-600 hover:text-blue-800 underline font-medium"
                >
                  Back to Staff Dashboard
                </button>
              ) : (
                <button
                  onClick={() => { setStudent(null); setStudentId(null); setSearchQuery(''); setSearchResults([]); }}
                  className="text-xs text-purple-500 hover:text-purple-800 underline"
                >
                  Switch Student
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Year Progress Cards */}
        <div className="mb-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
            <span>⏱️</span> Your Career Progress
          </h2>
          <div className="bg-white border-2 border-purple-800 rounded-xl p-8 shadow-lg">
            <div className="grid grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((year) => {
                const { pct, completed, total } = calculateYearProgress(year);
                const isCurrent = year === currentYear;
                return (
                  <div
                    key={year}
                    className={`p-5 rounded-lg border-2 ${
                      isCurrent
                        ? 'bg-gradient-to-br from-purple-200 to-pink-200 border-purple-700 shadow-lg relative'
                        : 'bg-gradient-to-br from-purple-50 to-pink-50 border-purple-300'
                    }`}
                  >
                    {isCurrent && (
                      <div className="absolute -top-3 right-3 bg-purple-700 text-white text-xs font-bold px-3 py-1 rounded shadow-lg">
                        CURRENT
                      </div>
                    )}
                    <p className="text-xs font-bold text-purple-800 uppercase mb-2">Year {year}</p>
                    <p className="text-3xl font-bold text-purple-900 mb-3">{pct}%</p>
                    <div className="w-full h-2 bg-purple-200 rounded-full overflow-hidden mb-2">
                      <div
                        className="h-full bg-gradient-to-r from-green-500 to-emerald-500"
                        style={{ width: `${pct}%` }}
                      ></div>
                    </div>
                    <p className="text-xs text-gray-700">{completed} of {total} complete</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Roadmap */}
          <div className="lg:col-span-2">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Your Roadmap</h2>
            <div className="space-y-4">
              {[1, 2, 3, 4].map((year) => (
                <div key={year}>
                  <button
                    onClick={() => setExpandedYear(expandedYear === year ? null : year)}
                    className={`w-full p-4 rounded-lg border-2 font-semibold flex justify-between items-center transition ${
                      expandedYear === year
                        ? 'bg-gradient-to-r from-purple-100 to-pink-100 border-purple-700'
                        : 'bg-white border-purple-800 hover:border-purple-600'
                    }`}
                  >
                    <span className="text-lg text-gray-900">Year {year}: {getYearLabel(year)}</span>
                    <span className={`transition-transform ${expandedYear === year ? 'rotate-180' : ''}`}>▼</span>
                  </button>

                  {expandedYear === year && (
                    <div className="mt-3 space-y-5">
                      {uploadError && (
                        <div className="flex items-start gap-2 bg-red-50 border border-red-300 text-red-700 text-xs rounded-lg px-3 py-2">
                          <span className="mt-0.5">⚠️</span>
                          <span>{uploadError}</span>
                          <button onClick={() => setUploadError('')} className="ml-auto font-bold hover:text-red-900">✕</button>
                        </div>
                      )}
                      {Object.entries(groupTasksBySection(getRoadmapTasks(year))).map(([sectionName, sectionTasks]) => (
                        <div key={sectionName}>
                          <p className="text-xs font-bold text-purple-700 uppercase tracking-wider mb-2 px-1">{sectionName}</p>
                          <div className="space-y-2">
                            {sectionTasks.map((task, idx) => {
                              const key = taskKey(year, task.task);
                              const completed = isTaskCompleted(year, task.task, task.completed);
                              const proof = proofFiles[key];
                              return (
                                <div key={idx} className="border-2 border-purple-200 rounded-lg overflow-hidden bg-gradient-to-r from-purple-50 to-pink-50">
                                  <button
                                    onClick={() => toggleTaskCompletion(year, task.task, task.completed)}
                                    className="w-full p-4 flex gap-4 text-left hover:bg-purple-100 transition"
                                  >
                                    <span className="text-xl flex-shrink-0 mt-0.5">{completed ? '✅' : '⭕'}</span>
                                    <p className={`text-sm leading-snug flex-1 ${completed ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                                      {task.task}
                                    </p>
                                  </button>

                                  {completed && (
                                    <div className="px-4 py-2 bg-white border-t border-purple-100 flex items-center gap-3 flex-wrap">
                                      {proof ? (
                                        <>
                                          {proof.type?.startsWith('image/') ? (
                                            <a href={proof.dataUrl} target="_blank" rel="noopener noreferrer">
                                              <img src={proof.dataUrl} alt="proof" className="h-9 w-9 object-cover rounded border border-purple-200 hover:opacity-80 transition" />
                                            </a>
                                          ) : (
                                            <span className="text-purple-500 text-base">📎</span>
                                          )}
                                          <span className="text-xs text-green-700 font-medium truncate max-w-[200px]">{proof.name}</span>
                                          <span className="text-xs text-gray-400">({(proof.size / 1024).toFixed(0)} KB)</span>
                                          <button
                                            onClick={() => removeProof(year, task.task)}
                                            className="ml-auto text-xs text-red-400 hover:text-red-600 font-medium"
                                          >
                                            Remove
                                          </button>
                                        </>
                                      ) : (
                                        <label className="flex items-center gap-1.5 text-xs text-purple-600 hover:text-purple-800 cursor-pointer font-medium py-1">
                                          <span>📎</span> Attach proof (optional)
                                          <input
                                            type="file"
                                            accept="image/*,.pdf,.doc,.docx"
                                            className="hidden"
                                            onChange={(e) => handleProofUpload(year, task.task, e)}
                                          />
                                        </label>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-bold text-gray-900 mb-4">Your Stats</h3>
              <div className="space-y-3">
                <div className="bg-white border-2 border-purple-200 rounded-lg p-4">
                  <p className="text-sm text-gray-600 font-medium">Events Attended</p>
                  <p className="text-3xl font-bold text-purple-800 mt-2">{student.career_events_attended || 0}</p>
                </div>
                <div className="bg-white border-2 border-purple-200 rounded-lg p-4">
                  <p className="text-sm text-gray-600 font-medium">Applications</p>
                  <p className="text-3xl font-bold text-purple-800 mt-2">{student.job_applications_count || 0}</p>
                </div>
                {interviews.length > 0 && (
                  <div className="bg-white border-2 border-purple-200 rounded-lg p-4">
                    <p className="text-sm text-gray-600 font-medium">Interviews</p>
                    <p className="text-3xl font-bold text-purple-800 mt-2">{interviews.length}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <button
                onClick={() => setShowRecommendations(true)}
                className="w-full bg-gradient-to-r from-purple-700 to-pink-600 text-white font-bold py-4 rounded-lg hover:shadow-lg transition flex items-center justify-center gap-2"
              >
                <span>💬</span> Get Recommendations
              </button>

              {setView && (
                <button
                  onClick={() => setView('platforms')}
                  className="block w-full bg-gradient-to-br from-purple-700 to-purple-900 text-white rounded-lg p-6 hover:shadow-lg transition text-center"
                >
                  <p className="text-2xl mb-2">🔗</p>
                  <h3 className="font-bold mb-1">Access All Platforms</h3>
                  <p className="text-sm text-purple-100">View Handshake, Connect, and more tools</p>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {showRecommendations && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-purple-200 p-6 flex justify-between items-center">
              <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <span>✨</span> Recommendations
              </h2>
              <button onClick={() => setShowRecommendations(false)} className="text-gray-500 hover:text-gray-700 text-2xl font-bold">
                ✕
              </button>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {recommendations.map((rec) => (
                  <div key={rec.id} className="bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-200 rounded-xl p-6 hover:shadow-lg transition">
                    <p className="text-4xl mb-3">{rec.icon}</p>
                    <h3 className="font-bold text-gray-900 mb-2">{rec.title}</h3>
                    <p className="text-sm text-gray-600 mb-4">{rec.description}</p>
                    {rec.link ? (
                      <a
                        href={rec.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-purple-700 font-semibold text-sm hover:text-purple-900"
                      >
                        {rec.action} →
                      </a>
                    ) : (
                      <span className="text-green-600 font-semibold text-sm">{rec.action}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-purple-200 p-6 bg-gray-50 flex justify-end">
              <button
                onClick={() => setShowRecommendations(false)}
                className="px-6 py-2 bg-gray-200 text-gray-800 font-semibold rounded-lg hover:bg-gray-300 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default StudentDashboard;
