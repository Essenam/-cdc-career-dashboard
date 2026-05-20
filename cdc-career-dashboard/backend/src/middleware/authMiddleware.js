const crypto = require('crypto');

// In-memory token store: token → expiry timestamp
// Tokens are cleared when the server restarts (acceptable for an internal tool).
const tokenStore = new Map();
const TOKEN_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours

function issueToken() {
  const token = crypto.randomBytes(32).toString('hex');
  tokenStore.set(token, Date.now() + TOKEN_TTL_MS);
  return token;
}

function requireStaffAuth(req, res, next) {
  const header = req.headers['authorization'];
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required. Please log in.' });
  }
  const token = header.slice(7);
  const expiresAt = tokenStore.get(token);
  if (!expiresAt || expiresAt < Date.now()) {
    tokenStore.delete(token);
    return res.status(401).json({ error: 'Session expired. Please log in again.' });
  }
  next();
}

module.exports = { issueToken, requireStaffAuth };
