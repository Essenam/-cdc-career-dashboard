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
    const highRiskCount = allStudents?.filter(s => s.risk_level?.toLowerCase() === 'high').length || 0;
    const mediumRiskCount = allStudents?.filter(s => s.risk_level?.toLowerCase() === 'medium').length || 0;
    const lowRiskCount = allStudents?.filter(s => s.risk_level?.toLowerCase() === 'low').length || 0;
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

module.exports = router;