// Usage: node test-email.js you@example.com
require('dotenv').config();
const n = require('nodemailer');
if (!process.env.SMTP_HOST) { console.log('SMTP_HOST is empty: .env not found in this folder or not filled in.'); process.exit(1); }
const t = n.createTransport({ host: process.env.SMTP_HOST, port: +process.env.SMTP_PORT || 587,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } });
t.verify().then(() => { console.log('SMTP login OK'); return t.sendMail({ from: process.env.SMTP_FROM, to: process.argv[2],
  subject: 'Silent SOS test', text: 'It works.' }); })
 .then(i => console.log('Sent:', i.response)).catch(e => console.error('FAILED:', e.message));
