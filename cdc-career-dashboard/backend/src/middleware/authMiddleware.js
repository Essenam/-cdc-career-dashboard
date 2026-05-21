const jwt = require('jsonwebtoken');

const TOKEN_TTL = '8h';

function getSecret() {
  return process.env.JWT_SECRET;
}

function issueToken() {
  return jwt.sign({ role: 'staff' }, getSecret(), { expiresIn: TOKEN_TTL });
}

function requireStaffAuth(req, res, next) {
  const header = req.headers['authorization'];
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required. Please log in.' });
  }
  try {
    jwt.verify(header.slice(7), getSecret());
    next();
  } catch {
    return res.status(401).json({ error: 'Session expired. Please log in again.' });
  }
}

module.exports = { issueToken, requireStaffAuth };
