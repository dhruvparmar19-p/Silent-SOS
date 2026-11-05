const router = require('express').Router(), crypto = require('crypto');
const Alert = require('../models/Alert'), { requireAuth, requireAdmin } = require('../utils/auth');
const { notifyContacts } = require('../utils/notify');
const client = () => process.env.CLIENT_URL || 'http://localhost:5173';
const view = a => ({ id: a._id, token: a.token, status: a.status, location: a.location, path: a.path,
  log: a.log, createdAt: a.createdAt, acknowledgedAt: a.acknowledgedAt, resolvedAt: a.resolvedAt,
  responseMs: a.responseMs, deliveryMs: a.deliveryMs, user: a.user && a.user.name ? { name: a.user.name, phone: a.user.phone } : undefined });
const stamp = (a, event, by = 'user') => a.log.push({ event, by, at: new Date() });

// Trigger SOS (reuses an active alert so repeat presses don't spam contacts)
router.post('/', requireAuth, async (req, res) => {
  const t0 = Date.now();
  let a = await Alert.findOne({ user: req.user._id, status: { $ne: 'resolved' } });
  if (a) return res.json(view(a));
  const { lat, lng, accuracy } = req.body, at = new Date();
  a = new Alert({ user: req.user._id, token: crypto.randomBytes(16).toString('hex') });
  if (lat != null) { a.location = { lat, lng, accuracy, at }; a.path.push({ lat, lng, at }); }
  stamp(a, 'Alert triggered');
  await a.save();
  res.json(view(a));                                   // respond first: speed matters
  const n = await notifyContacts(req.user, `${client()}/track/${a.token}`);
  stamp(a, `Notifications: ${n.sent} sent, ${n.failed.length} failed (${n.mode})`, 'system');
  n.failed.forEach(m => stamp(a, 'Failed: ' + m, 'system'));
  a.deliveryMs = Date.now() - t0; await a.save();
});
router.get('/mine', requireAuth, async (req, res) => {
  const list = await Alert.find({ user: req.user._id }).sort('-createdAt').limit(20);
  res.json(list.map(view));
});
router.put('/:id/location', requireAuth, async (req, res) => {
  const { lat, lng, accuracy } = req.body, at = new Date();
  const a = await Alert.findOne({ _id: req.params.id, user: req.user._id, status: { $ne: 'resolved' } });
  if (!a) return res.status(404).json({ error: 'No active alert' });
  a.location = { lat, lng, accuracy, at }; a.path.push({ lat, lng, at });
  if (a.path.length > 500) a.path.shift();
  await a.save(); res.json({ ok: true });
});
router.put('/:id/resolve', requireAuth, async (req, res) => {
  const a = await Alert.findOne({ _id: req.params.id, user: req.user._id });
  if (!a) return res.status(404).json({ error: 'Not found' });
  if (a.status !== 'resolved') { a.status = 'resolved'; a.resolvedAt = new Date(); stamp(a, 'Marked safe by user'); await a.save(); }
  res.json(view(a));
});

// Public tracking link for trusted contacts (the unguessable token is the credential)
const byToken = async (req, res, next) => {
  req.alert = await Alert.findOne({ token: req.params.token }).populate('user', 'name phone');
  req.alert ? next() : res.status(404).json({ error: 'Link not found' });
};
router.get('/track/:token', byToken, (req, res) => res.json(view(req.alert)));
router.post('/track/:token/ack', byToken, async (req, res) => {
  const a = req.alert;
  if (a.status === 'sent') {
    a.status = 'acknowledged'; a.acknowledgedAt = new Date();
    a.responseMs = a.acknowledgedAt - a.createdAt; stamp(a, 'Acknowledged by contact', 'contact'); await a.save();
  }
  res.json(view(a));
});
router.post('/track/:token/resolve', byToken, async (req, res) => {
  const a = req.alert;
  if (a.status !== 'resolved') { a.status = 'resolved'; a.resolvedAt = new Date(); stamp(a, 'Resolved by contact', 'contact'); await a.save(); }
  res.json(view(a));
});

// Admin monitoring
router.get('/admin/active', requireAuth, requireAdmin, async (_q, res) => {
  const list = await Alert.find({ status: { $ne: 'resolved' } }).populate('user', 'name phone').sort('-createdAt');
  res.json(list.map(view));
});
router.get('/admin/stats', requireAuth, requireAdmin, async (_q, res) => {
  const all = await Alert.find({}, 'status deliveryMs responseMs');
  const avg = k => { const v = all.map(a => a[k]).filter(Number.isFinite); return v.length ? Math.round(v.reduce((s, x) => s + x, 0) / v.length) : null; };
  res.json({ total: all.length, active: all.filter(a => a.status !== 'resolved').length,
    acknowledgedRate: all.length ? Math.round(100 * all.filter(a => a.status !== 'sent').length / all.length) : 0,
    avgDeliveryMs: avg('deliveryMs'), avgResponseMs: avg('responseMs') });
});
module.exports = router;
