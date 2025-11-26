const jwt = require('jsonwebtoken');
const User = require('../models/User');

module.exports = async function(req, res, next) {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader) return res.status(401).json({ success:false, error: 'No token provided' });
    const parts = authHeader.split(' ');
    if (parts.length !== 2) return res.status(401).json({ success:false, error: 'Token error' });
    const scheme = parts[0];
    const token = parts[1];
    if (!/^Bearer$/i.test(scheme)) return res.status(401).json({ success:false, error: 'Token malformatted' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: decoded.id, email: decoded.email };
    return next();
  } catch (err) {
    return res.status(401).json({ success:false, error: 'Token invalid or expired' });
  }
}
