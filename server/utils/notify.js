const nodemailer = require('nodemailer');
const mailer = process.env.SMTP_HOST && nodemailer.createTransport({
  host: process.env.SMTP_HOST, port: +process.env.SMTP_PORT || 587,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
});
async function sms(to, body) {
  const { TWILIO_SID: sid, TWILIO_TOKEN: tok, TWILIO_FROM: from } = process.env;
  if (!sid || !tok || !from) return console.log(`[SMS dry-run] ${to}: ${body}`);
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: { Authorization: 'Basic ' + Buffer.from(`${sid}:${tok}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ To: to, From: from, Body: body })
  });
  if (!res.ok) throw new Error('Twilio ' + res.status + ': ' + (await res.text()).slice(0, 200));
}
async function email(to, subject, text) {
  if (!mailer) return console.log(`[Email dry-run] ${to}: ${subject}\n${text}`);
  await mailer.sendMail({ from: process.env.SMTP_FROM, to, subject, text });
}
// Sends to every contact on every channel they have; never throws.
exports.notifyContacts = async (user, link) => {
  const text = `${user.name} sent a silent SOS and may be in danger. Live location and status: ${link}`;
  const jobs = [];
  for (const c of user.contacts) {
    if (c.email) jobs.push(email(c.email, `SOS from ${user.name}`, text));
    if (c.phone) jobs.push(sms(c.phone, text));
  }
  const r = await Promise.allSettled(jobs);
  const failed = r.filter(x => x.status === 'rejected').map(x => String(x.reason && x.reason.message || x.reason));
  failed.forEach(m => console.error('[notify] FAILED:', m));
  const mode = (mailer ? 'email live' : 'email NOT configured (dry-run)');
  return { sent: r.length - failed.length, failed, mode };
};
