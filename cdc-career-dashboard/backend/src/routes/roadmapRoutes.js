const express = require('express');
const router = express.Router();
const { supabase, supabaseAdmin } = require('../config/db');

// GET active tasks — used by student dashboard
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('roadmap_tasks')
      .select('id, year, section, task_text, order_index')
      .eq('active', true)
      .order('year')
      .order('order_index');
    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET all tasks including inactive — admin only
router.get('/admin', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('roadmap_tasks')
      .select('*')
      .order('year')
      .order('order_index');
    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create task
router.post('/', async (req, res) => {
  try {
    const { year, section, task_text, order_index } = req.body;
    if (!year || !section?.trim() || !task_text?.trim()) {
      return res.status(400).json({ error: 'year, section, and task_text are required.' });
    }
    const { data, error } = await supabaseAdmin
      .from('roadmap_tasks')
      .insert({ year, section: section.trim(), task_text: task_text.trim(), order_index: order_index ?? 0, active: true })
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update task
router.put('/:id', async (req, res) => {
  try {
    const updates = { updated_at: new Date().toISOString() };
    const fields = ['task_text', 'section', 'year', 'order_index', 'active'];
    for (const f of fields) {
      if (req.body[f] !== undefined) updates[f] = typeof req.body[f] === 'string' ? req.body[f].trim() : req.body[f];
    }
    const { data, error } = await supabaseAdmin
      .from('roadmap_tasks')
      .update(updates)
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE task
router.delete('/:id', async (req, res) => {
  try {
    const { error } = await supabaseAdmin
      .from('roadmap_tasks')
      .delete()
      .eq('id', req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
