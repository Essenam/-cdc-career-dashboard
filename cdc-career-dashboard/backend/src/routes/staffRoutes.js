const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// GET all students (sorted by risk level)
router.get('/students', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('student_career_progress')
      .select('*')
      .order('risk_level', { ascending: false })
      .order('engagement_score', { ascending: true });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET students by risk level
router.get('/students/risk/:level', async (req, res) => {
  try {
    const { level } = req.params;

    const { data, error } = await supabase
      .from('student_career_progress')
      .select('*')
      .eq('risk_level', level)
      .order('engagement_score', { ascending: true });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET specific student with all data
router.get('/students/:studentId', async (req, res) => {
  try {
    const { studentId } = req.params;

    // Get student profile
    const { data: student, error: studentError } = await supabase
      .from('student_career_progress')
      .select('*')
      .eq('student_id', studentId)
      .single();

    if (studentError) {
      return res.status(404).json({ error: 'Student not found' });
    }

    // Get events
    const { data: events } = await supabase
      .from('career_events')
      .select('*')
      .eq('student_id', studentId)
      .order('attended_date', { ascending: false });

    // Get applications
    const { data: applications } = await supabase
      .from('job_applications')
      .select('*')
      .eq('student_id', studentId)
      .order('applied_date', { ascending: false });

    // Get interviews
    const { data: interviews } = await supabase
      .from('interview_appointments')
      .select('*')
      .eq('student_id', studentId)
      .order('scheduled_date', { ascending: false });

    res.json({
      student,
      events: events || [],
      applications: applications || [],
      interviews: interviews || []
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET dashboard summary
router.get('/dashboard', async (req, res) => {
  try {
    // Total students
    const { data: allStudents } = await supabase
      .from('student_career_progress')
      .select('student_id, risk_level, engagement_score');

    const totalStudents = allStudents?.length || 0;
    const highRiskCount = allStudents?.filter(s => ['need outreach','high'].includes(s.risk_level?.toLowerCase())).length || 0;
    const mediumRiskCount = allStudents?.filter(s => ['developing','medium'].includes(s.risk_level?.toLowerCase())).length || 0;
    const lowRiskCount = allStudents?.filter(s => ['on track','low'].includes(s.risk_level?.toLowerCase())).length || 0;
    const avgEngagement = allStudents?.length > 0 
      ? Math.round(allStudents.reduce((sum, s) => sum + s.engagement_score, 0) / allStudents.length)
      : 0;

    res.json({
      totalStudents,
      highRiskCount,
      mediumRiskCount,
      lowRiskCount,
      avgEngagement
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET analytics — activity stats, engagement distribution, platform usage, insights
router.get('/analytics', async (req, res) => {
  try {
    const [studentsRes, apptsRes, completionsRes] = await Promise.all([
      supabase.from('student_career_progress').select('student_id, career_events_attended, job_applications_count, engagement_score, risk_level'),
      supabase.from('interview_appointments').select('student_id'),
      supabase.from('task_completions').select('student_id, completed').eq('completed', true)
    ]);

    const students = studentsRes.data || [];
    const appts = apptsRes.data || [];
    const completions = completionsRes.data || [];

    const median = (arr) => {
      if (!arr.length) return 0;
      const s = [...arr].sort((a, b) => a - b);
      const m = Math.floor(s.length / 2);
      return s.length % 2 === 0 ? Math.round((s[m - 1] + s[m]) / 2 * 10) / 10 : s[m];
    };
    const avg = (arr) => arr.length ? Math.round(arr.reduce((s, v) => s + v, 0) / arr.length * 10) / 10 : 0;

    const apptCountByStudent = {};
    for (const a of appts) apptCountByStudent[a.student_id] = (apptCountByStudent[a.student_id] || 0) + 1;

    const completionCountByStudent = {};
    for (const c of completions) completionCountByStudent[c.student_id] = (completionCountByStudent[c.student_id] || 0) + 1;

    const eventCounts  = students.map(s => s.career_events_attended || 0);
    const appCounts    = students.map(s => s.job_applications_count || 0);
    const apptCounts   = students.map(s => apptCountByStudent[s.student_id] || 0);
    const scores       = students.map(s => s.engagement_score || 0);

    const zeroEvents = students.filter(s => (s.career_events_attended || 0) === 0).length;
    const zeroApps   = students.filter(s => (s.job_applications_count || 0) === 0).length;
    const zeroAppts  = students.filter(s => !apptCountByStudent[s.student_id]).length;

    const totalEvents  = eventCounts.reduce((s, v) => s + v, 0);
    const totalApps    = appCounts.reduce((s, v) => s + v, 0);
    const totalAppts   = apptCounts.reduce((s, v) => s + v, 0);
    const studentsWithCompletions = Object.keys(completionCountByStudent).length;

    const engagementDistribution = [
      { label: 'No activity',  range: '0',      count: students.filter(s => (s.engagement_score || 0) === 0).length },
      { label: 'Need Outreach',range: '1-49',   count: students.filter(s => (s.engagement_score || 0) > 0   && (s.engagement_score || 0) < 50).length },
      { label: 'Developing',   range: '50-99',  count: students.filter(s => (s.engagement_score || 0) >= 50 && (s.engagement_score || 0) < 100).length },
      { label: 'On Track',     range: '100-199',count: students.filter(s => (s.engagement_score || 0) >= 100 && (s.engagement_score || 0) < 200).length },
      { label: 'Highly Active',range: '200+',   count: students.filter(s => (s.engagement_score || 0) >= 200).length },
    ];

    const platformUsage = [
      { name: 'Handshake — Applications', count: totalApps,    pct: 0, icon: '💼' },
      { name: 'Handshake — Events',       count: totalEvents,  pct: 0, icon: '📅' },
      { name: 'CDC Appointments',         count: totalAppts,   pct: 0, icon: '🎓' },
      { name: 'Roadmap Self-Check',       count: completions.length, pct: 0, icon: '☑️' },
    ].sort((a, b) => b.count - a.count);
    const maxUsage = Math.max(...platformUsage.map(p => p.count), 1);
    platformUsage.forEach(p => { p.pct = Math.round(p.count / maxUsage * 100); });

    const insights = [];

    if (zeroEvents > 0)
      insights.push({ type: 'warning', icon: '📅',
        message: `${zeroEvents} student${zeroEvents > 1 ? 's have' : ' has'} never attended a career event.`,
        action: 'Promote upcoming Handshake events and send targeted outreach to these students.' });

    if (zeroApps > 0)
      insights.push({ type: 'warning', icon: '💼',
        message: `${zeroApps} student${zeroApps > 1 ? 's have' : ' has'} never submitted an application.`,
        action: 'Offer a Handshake orientation or 1:1 job search coaching for this group.' });

    if (zeroAppts > 0)
      insights.push({ type: 'warning', icon: '🎓',
        message: `${zeroAppts} student${zeroAppts > 1 ? 's have' : ' has'} never booked a CDC appointment.`,
        action: 'Send a personal invitation to schedule a career planning session.' });

    const highEngagement = students.filter(s => s.engagement_score > 150).length;
    if (highEngagement > 0)
      insights.push({ type: 'success', icon: '⭐',
        message: `${highEngagement} student${highEngagement > 1 ? 's are' : ' is'} highly engaged (score 150+).`,
        action: 'Consider these students as peer mentors or CDC student ambassadors.' });

    if (studentsWithCompletions === 0)
      insights.push({ type: 'info', icon: '☑️',
        message: 'No students have self-reported milestone completions yet.',
        action: 'Walk students through the roadmap check-in feature during their next advising session.' });
    else {
      const avgC = avg(Object.values(completionCountByStudent));
      insights.push({ type: 'success', icon: '☑️',
        message: `${studentsWithCompletions} student${studentsWithCompletions > 1 ? 's have' : ' has'} self-reported progress (avg ${avgC} milestones each).`,
        action: null });
    }

    if (totalAppts > 0 && totalAppts < students.length * 0.5)
      insights.push({ type: 'info', icon: '📊',
        message: `CDC appointments are the least-used touchpoint — only ${totalAppts} total across ${students.length} students.`,
        action: 'Make appointment booking more visible on the student dashboard or during class visits.' });

    res.json({
      total_students: students.length,
      activity: {
        events:       { avg: avg(eventCounts),  median: median(eventCounts),  total: totalEvents, zero_count: zeroEvents },
        applications: { avg: avg(appCounts),    median: median(appCounts),    total: totalApps,   zero_count: zeroApps },
        appointments: { avg: avg(apptCounts),   median: median(apptCounts),   total: totalAppts,  zero_count: zeroAppts },
        milestones:   { total: completions.length, students_active: studentsWithCompletions },
      },
      engagement_score: { avg: avg(scores), median: median(scores) },
      engagement_distribution: engagementDistribution,
      platform_usage: platformUsage,
      insights
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;