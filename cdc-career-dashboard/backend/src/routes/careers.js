const express = require('express');
const router = express.Router();
const supabase = require('../config/db');

router.get('/', async (req, res, next) => {
  try {
    const { data, error } = await supabase.from('careers').select('*').order('id');
    if (error) throw error;
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const { data, error } = await supabase.from('careers').select('*').eq('id', req.params.id).single();
    if (error) return res.status(404).json({ error: 'Not found' });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
