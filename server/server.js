require('dotenv').config();
const express = require('express'), mongoose = require('mongoose'), cors = require('cors');
const app = express();
app.use(cors({ origin: process.env.CLIENT_URL || '*' }));
app.use(express.json());
app.get('/api/health', (_q, r) => r.json({ ok: true }));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/alerts', require('./routes/alerts'));
app.use((err, _q, res, _n) => { console.error(err); res.status(500).json({ error: 'Server error' }); });
const PORT = process.env.PORT || 5000;
mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/silent-sos')
  .then(() => app.listen(PORT, () => console.log('API on :' + PORT)))
  .catch(e => { console.error('MongoDB connection failed', e.message); process.exit(1); });
