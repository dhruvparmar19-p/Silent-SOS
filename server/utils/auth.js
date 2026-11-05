const jwt = require('jsonwebtoken'), User = require('../models/User');
const secret = () => process.env.JWT_SECRET || 'dev-secret';
exports.sign = u => jwt.sign({ id: u._id }, secret(), { expiresIn: '7d' });
exports.requireAuth = async (req, res, next) => {
  try {
    const t = (req.headers.authorization || '').replace('Bearer ', '');
    req.user = await User.findById(jwt.verify(t, secret()).id);
    if (!req.user) throw 0;
    next();
  } catch { res.status(401).json({ error: 'Please sign in' }); }
};
exports.requireAdmin = (req, res, next) =>
  req.user.isAdmin ? next() : res.status(403).json({ error: 'Admins only' });
