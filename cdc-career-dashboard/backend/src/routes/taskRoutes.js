const express = require('express');
const router = express.Router();
const { supabase, supabaseAdmin } = require('../config/db');

// GET all completions for a student
router.get('/:studentId', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('task_completions')
      .select('task_key, completed, proof_name, proof_type, proof_size, proof_data')
      .eq('student_id', req.params.studentId);

    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT (upsert) a completion — body: { completed, proof_name?, proof_type?, proof_size?, proof_data? }
router.put('/:studentId/:taskKey', async (req, res) => {
  try {
    const { studentId, taskKey } = req.params;
    const { completed, proof_name, proof_type, proof_size, proof_data } = req.body;

    const { error } = await supabaseAdmin
      .from('task_completions')
      .upsert(
        {
          student_id: studentId,
          task_key: taskKey,
          completed: completed ?? true,
          proof_name: proof_name || null,
          proof_type: proof_type || null,
          proof_size: proof_size || null,
          proof_data: proof_data || null,
          updated_at: new Date().toISOString()
        },
        { onConflict: 'student_id,task_key' }
      );

    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE a completion (uncheck with no proof)
router.delete('/:studentId/:taskKey', async (req, res) => {
  try {
    const { studentId, taskKey } = req.params;

    const { error } = await supabaseAdmin
      .from('task_completions')
      .delete()
      .eq('student_id', studentId)
      .eq('task_key', taskKey);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
