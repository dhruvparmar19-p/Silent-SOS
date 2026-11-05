const router = require('express').Router(), bcrypt = require('bcryptjs');
const User = require('../models/User'), { sign, requireAuth, isAdmin } = require('../utils/auth');
const pub = u => ({ id: u._id, name: u.name, email: u.email, phone: u.phone, isAdmin: isAdmin(u), contacts: u.contacts });

router.post('/register', async (req, res) => {
  const { name, email, phone, password } = req.body;
  if (!name || !email || !password || password.length < 6)
    return res.status(400).json({ error: 'Name, email and a password of 6+ characters are required' });
  if (await User.findOne({ email: email.toLowerCase() }))
    return res.status(409).json({ error: 'That email is already registered' });
  const u = await User.create({ name, email, phone, password: await bcrypt.hash(password, 10),
    isAdmin: !!process.env.ADMIN_EMAIL && email.toLowerCase() === process.env.ADMIN_EMAIL.toLowerCase() });
  res.json({ token: sign(u), user: pub(u) });
});
router.post('/login', async (req, res) => {
  const u = await User.findOne({ email: (req.body.email || '').toLowerCase() });
  if (!u || !(await bcrypt.compare(req.body.password || '', u.password)))
    return res.status(401).json({ error: 'Email or password is incorrect' });
  res.json({ token: sign(u), user: pub(u) });
});
router.get('/me', requireAuth, (req, res) => res.json(pub(req.user)));
router.put('/contacts', requireAuth, async (req, res) => {
  const list = (req.body.contacts || []).filter(c => c.name && (c.email || c.phone)).slice(0, 10);
  req.user.contacts = list; await req.user.save();
  res.json(pub(req.user));
});
module.exports = router;
