import { useEffect, useRef, useState, useCallback } from 'react';
import { Routes, Route, Navigate, Link, useNavigate, useParams } from 'react-router-dom';
import { api, getToken } from './api.js';

const fmtTime = d => (d ? new Date(d).toLocaleTimeString() : '–');
const fmtDur = ms => (ms == null ? '–' : ms < 1000 ? ms + ' ms' : (ms / 1000).toFixed(ms < 60000 ? 1 : 0) + ' s');
const mapLink = l => `https://www.google.com/maps?q=${l.lat},${l.lng}`;

function Log({ log }) {
  return <ol className="log">{log.map((e, i) => <li key={i}><time>{fmtTime(e.at)}</time> {e.event}</li>)}</ol>;
}

/* ---------- Sign in / register ---------- */
function Auth({ onAuth }) {
  const [mode, setMode] = useState('login');
  const [f, setF] = useState({ name: '', email: '', phone: '', password: '' });
  const [err, setErr] = useState('');
  const set = k => e => setF({ ...f, [k]: e.target.value });
  const submit = async e => {
    e.preventDefault(); setErr('');
    try {
      const d = await api('/auth/' + mode, { method: 'POST', body: f });
      localStorage.setItem('sos_token', d.token); onAuth(d.user);
    } catch (x) { setErr(x.message); }
  };
  return (
    <main className="narrow">
      <h1>{mode === 'login' ? 'Sign in' : 'Create your account'}</h1>
      <form onSubmit={submit} className="stack">
        {mode === 'register' && <>
          <label>Name<input value={f.name} onChange={set('name')} required /></label>
          <label>Phone<input value={f.phone} onChange={set('phone')} type="tel" /></label></>}
        <label>Email<input value={f.email} onChange={set('email')} type="email" required /></label>
        <label>Password<input value={f.password} onChange={set('password')} type="password" minLength={6} required /></label>
        {err && <p className="error" role="alert">{err}</p>}
        <button className="primary">{mode === 'login' ? 'Sign in' : 'Create account'}</button>
      </form>
      <button className="link" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
        {mode === 'login' ? 'New here? Create an account' : 'Already registered? Sign in'}
      </button>
    </main>
  );
}

/* ---------- Home: silent SOS button ---------- */
const HOLD_MS = 1500;
function Home({ user }) {
  const [alert, setAlert] = useState(null);
  const [msg, setMsg] = useState('');
  const timer = useRef(null), watch = useRef(null), lastSent = useRef(0), alertRef = useRef(null);
  alertRef.current = alert;

  const startWatch = useCallback(() => {
    if (!navigator.geolocation || watch.current != null) return;
    watch.current = navigator.geolocation.watchPosition(p => {
      const a = alertRef.current;
      if (!a || Date.now() - lastSent.current < 5000) return;
      lastSent.current = Date.now();
      api(`/alerts/${a.id}/location`, { method: 'PUT',
        body: { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy } }).catch(() => {});
    }, () => {}, { enableHighAccuracy: true, maximumAge: 2000 });
  }, []);
  const stopWatch = () => { if (watch.current != null) navigator.geolocation.clearWatch(watch.current); watch.current = null; };

  const refresh = useCallback(async () => {
    const list = await api('/alerts/mine').catch(() => []);
    const active = list.find(a => a.status !== 'resolved') || null;
    setAlert(active); active ? startWatch() : stopWatch();
  }, [startWatch]);
  useEffect(() => { refresh(); const t = setInterval(refresh, 10000); return () => { clearInterval(t); stopWatch(); }; }, [refresh]);

  const trigger = () => {
    const send = async pos => {
      try {
        const c = pos?.coords;
        const a = await api('/alerts', { method: 'POST', body: c ? { lat: c.latitude, lng: c.longitude, accuracy: c.accuracy } : {} });
        setAlert(a); startWatch();
      } catch (e) { setMsg(e.message); }
    };
    // Don't wait long for GPS: send immediately if it is slow, location follows via updates.
    if (!navigator.geolocation) return send(null);
    navigator.geolocation.getCurrentPosition(send, () => send(null), { timeout: 1500, maximumAge: 10000, enableHighAccuracy: true });
  };
  const down = () => { if (alert) return; timer.current = setTimeout(trigger, HOLD_MS); };
  const up = () => clearTimeout(timer.current);
  const resolve = async () => { await api(`/alerts/${alert.id}/resolve`, { method: 'PUT' }); setAlert(null); stopWatch(); };

  return (
    <main className="home">
      <p className="hint">{user.contacts.length ? 'Press and hold the circle for 1.5 seconds. Nothing will show or sound.'
        : <>Add at least one trusted contact first. <Link to="/contacts">Add contacts</Link></>}</p>
      {/* Deliberately no visual or audio feedback on trigger. */}
      <button className="sos" aria-label="Hold to send silent alert"
        onPointerDown={down} onPointerUp={up} onPointerLeave={up} onPointerCancel={up}
        onContextMenu={e => e.preventDefault()} />
      {msg && <p className="error">{msg}</p>}
      <footer className="quiet">
        {alert && <><span className="dot" title={`Alert ${alert.status}`} /> <button className="link" onClick={resolve}>I'm safe</button></>}
      </footer>
    </main>
  );
}

/* ---------- Contacts ---------- */
function Contacts({ user, setUser }) {
  const [list, setList] = useState(user.contacts.map(({ name, email, phone }) => ({ name, email, phone })));
  const [saved, setSaved] = useState(false);
  const edit = (i, k) => e => { const n = [...list]; n[i] = { ...n[i], [k]: e.target.value }; setList(n); setSaved(false); };
  const save = async () => { setUser(await api('/auth/contacts', { method: 'PUT', body: { contacts: list } })); setSaved(true); };
  return (
    <main className="narrow">
      <h1>Trusted contacts</h1>
      <p>They get your live location link by email and SMS when you send an alert.</p>
      {list.map((c, i) => (
        <fieldset key={i} className="stack">
          <label>Name<input value={c.name || ''} onChange={edit(i, 'name')} /></label>
          <label>Email<input type="email" value={c.email || ''} onChange={edit(i, 'email')} /></label>
          <label>Phone (with country code)<input type="tel" value={c.phone || ''} onChange={edit(i, 'phone')} /></label>
          <button className="link" onClick={() => setList(list.filter((_, j) => j !== i))}>Remove contact</button>
        </fieldset>))}
      <div className="row">
        <button onClick={() => setList([...list, { name: '', email: '', phone: '' }])}>Add contact</button>
        <button className="primary" onClick={save}>Save contacts</button>
      </div>
      {saved && <p role="status">Contacts saved.</p>}
    </main>
  );
}

/* ---------- Alert history (user) ---------- */
function History() {
  const [list, setList] = useState([]);
  useEffect(() => { api('/alerts/mine').then(setList); }, []);
  return (
    <main className="narrow">
      <h1>Alert history</h1>
      {!list.length && <p>No alerts yet. When you send one, its timeline appears here.</p>}
      {list.map(a => (
        <details key={a.id} className="card"><summary>{new Date(a.createdAt).toLocaleString()} · <b className={'s-' + a.status}>{a.status}</b></summary>
          <p>Delivery time: {fmtDur(a.deliveryMs)} · Response time: {fmtDur(a.responseMs)}</p><Log log={a.log} /></details>))}
    </main>
  );
}

/* ---------- Public tracking page for contacts ---------- */
function Track() {
  const { token } = useParams();
  const [a, setA] = useState(null), [err, setErr] = useState('');
  const load = useCallback(() => api(`/alerts/track/${token}`).then(setA).catch(e => setErr(e.message)), [token]);
  useEffect(() => { load(); const t = setInterval(load, 5000); return () => clearInterval(t); }, [load]);
  const act = p => api(`/alerts/track/${token}/${p}`, { method: 'POST' }).then(setA);
  if (err) return <main className="narrow"><p className="error">{err}</p></main>;
  if (!a) return <main className="narrow"><p>Loading…</p></main>;
  return (
    <main className="narrow">
      <h1>{a.user?.name} needs help</h1>
      <p>Status: <b className={'s-' + a.status}>{a.status}</b>{a.user?.phone && <> · <a href={'tel:' + a.user.phone}>Call {a.user.phone}</a></>}</p>
      {a.location ? <>
        <iframe title="Live location" className="map" loading="lazy"
          src={`https://maps.google.com/maps?q=${a.location.lat},${a.location.lng}&z=16&output=embed`} />
        <p>Last update {fmtTime(a.location.at)} (accuracy ±{Math.round(a.location.accuracy || 0)} m) · <a href={mapLink(a.location)} target="_blank" rel="noreferrer">Open in Maps</a></p></>
        : <p>Waiting for the first location fix…</p>}
      <div className="row">
        {a.status === 'sent' && <button className="primary" onClick={() => act('ack')}>I'm responding</button>}
        {a.status !== 'resolved' && <button onClick={() => act('resolve')}>Mark resolved</button>}
      </div>
      <h2>Activity</h2><Log log={a.log} />
    </main>
  );
}

/* ---------- Admin dashboard ---------- */
function Admin() {
  const [alerts, setAlerts] = useState([]), [stats, setStats] = useState(null), [err, setErr] = useState('');
  const load = useCallback(() => {
    api('/alerts/admin/active').then(setAlerts).catch(e => setErr(e.message));
    api('/alerts/admin/stats').then(setStats).catch(() => {});
  }, []);
  useEffect(() => { load(); const t = setInterval(load, 5000); return () => clearInterval(t); }, [load]);
  if (err) return <main className="narrow"><p className="error">{err}</p></main>;
  return (
    <main>
      <h1>Alert dashboard</h1>
      {stats && <dl className="stats">
        <div><dt>Active now</dt><dd>{stats.active}</dd></div>
        <div><dt>Total alerts</dt><dd>{stats.total}</dd></div>
        <div><dt>Acknowledged</dt><dd>{stats.acknowledgedRate}%</dd></div>
        <div><dt>Avg delivery</dt><dd>{fmtDur(stats.avgDeliveryMs)}</dd></div>
        <div><dt>Avg response</dt><dd>{fmtDur(stats.avgResponseMs)}</dd></div></dl>}
      <h2>Active alerts</h2>
      {!alerts.length && <p>No active alerts.</p>}
      <div className="scroll"><table>
        {alerts.length > 0 && <thead><tr><th>Person</th><th>Status</th><th>Triggered</th><th>Last location</th><th>Link</th></tr></thead>}
        <tbody>{alerts.map(a => (
          <tr key={a.id}><td>{a.user?.name}</td><td><b className={'s-' + a.status}>{a.status}</b></td><td>{fmtTime(a.createdAt)}</td>
            <td>{a.location ? <a href={mapLink(a.location)} target="_blank" rel="noreferrer">{a.location.lat.toFixed(4)}, {a.location.lng.toFixed(4)}</a> : '–'}</td>
            <td><Link to={'/track/' + a.token}>Open</Link></td></tr>))}</tbody>
      </table></div>
    </main>
  );
}

/* ---------- Shell ---------- */
export default function App() {
  const [user, setUser] = useState(null), [ready, setReady] = useState(!getToken());
  const nav = useNavigate();
  useEffect(() => { if (getToken()) api('/auth/me').then(setUser).catch(() => localStorage.removeItem('sos_token')).finally(() => setReady(true)); }, []);
  const logout = () => { localStorage.removeItem('sos_token'); setUser(null); nav('/'); };
  if (!ready) return null;
  return (
    <>
      {user && <nav><Link to="/">Home</Link><Link to="/contacts">Contacts</Link><Link to="/history">History</Link>
        {user.isAdmin && <Link to="/admin">Dashboard</Link>}<button className="link" onClick={logout}>Sign out</button></nav>}
      <Routes>
        <Route path="/track/:token" element={<Track />} />
        {!user ? <Route path="*" element={<Auth onAuth={setUser} />} /> : <>
          <Route path="/" element={<Home user={user} />} />
          <Route path="/contacts" element={<Contacts user={user} setUser={setUser} />} />
          <Route path="/history" element={<History />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="*" element={<Navigate to="/" />} /></>}
      </Routes>
    </>
  );
}
