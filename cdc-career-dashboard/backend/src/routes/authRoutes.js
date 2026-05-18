const express = require('express');
const router = express.Router();

router.post('/staff', (req, res) => {
  const { password } = req.body;
  const staffPassword = process.env.STAFF_PASSWORD;

  if (!staffPassword) {
    return res.status(500).json({ error: 'Staff password not configured on the server.' });
  }
  if (password === staffPassword) {
    res.json({ success: true });
  } else {
    res.status(401).json({ error: 'Incorrect password.' });
  }
});

module.exports = router;
