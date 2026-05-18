const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// SEARCH students by name or email
router.get('/search', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.trim().length < 2) {
      return res.json([]);
    }

    const term = q.trim().toLowerCase();

    const { data, error } = await supabase
      .from('student_career_progress')
      .select('student_id, full_name, first_name, last_name, email, major')
      .or(`student_id.ilike.%${term}%,full_name.ilike.%${term}%,email.ilike.%${term}%,first_name.ilike.%${term}%,last_name.ilike.%${term}%`)
      .limit(8);

    if (error) return res.status(500).json({ error: error.message });

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET student profile
router.get('/profile/:studentId', async (req, res) => {
  try {
    const { studentId } = req.params;

    // Fetch from Supabase
    const { data, error } = await supabase
      .from('student_career_progress')
      .select('*')
      .eq('student_id', studentId)
      .single();

    if (error) {
      return res.status(404).json({ error: 'Student not found' });
    }

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET student events
router.get('/events/:studentId', async (req, res) => {
  try {
    const { studentId } = req.params;

    const { data, error } = await supabase
      .from('career_events')
      .select('*')
      .eq('student_id', studentId)
      .order('attended_date', { ascending: false });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET student applications
router.get('/applications/:studentId', async (req, res) => {
  try {
    const { studentId } = req.params;

    const { data, error } = await supabase
      .from('job_applications')
      .select('*')
      .eq('student_id', studentId)
      .order('applied_date', { ascending: false });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET student interviews
router.get('/interviews/:studentId', async (req, res) => {
  try {
    const { studentId } = req.params;

    const { data, error } = await supabase
      .from('interview_appointments')
      .select('*')
      .eq('student_id', studentId)
      .order('scheduled_date', { ascending: false });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;