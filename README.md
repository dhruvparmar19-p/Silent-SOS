# Silent SOS Emergency Web App (MERN)

**M**ongoDB + **E**xpress + **R**eact (Vite) + **N**ode. Browser Geolocation API, Nodemailer (email) and Twilio (SMS).

## Run locally
Requires Node 18+ and a running MongoDB (local or Atlas).

```bash
# 1. API
cd server && cp .env.example .env     # set JWT_SECRET, MONGO_URI, ADMIN_EMAIL
npm install && npm run dev            # http://localhost:5002

# 2. Web app (new terminal)
cd client && npm install && npm run dev   # http://localhost:5173
```
Without SMTP/Twilio keys, notifications print to the API console ("dry-run") so you can test end to end.

## Try it
1. Register (use the `ADMIN_EMAIL` address to get the admin Dashboard) and add a trusted contact.
2. On Home, press and hold the plain circle for 1.5 s. Nothing visible or audible happens; a tiny dot appears bottom-center.
3. Open the `/track/<token>` link from the API console as the contact: live map, "I'm responding", "Mark resolved".
4. Dashboard shows active alerts and KPIs (delivery time, response time, acknowledgment rate).

## Requirement mapping
| PDF requirement | Where |
|---|---|
| One-click / long-press silent trigger, no sound or visible alert | `Home` in `client/src/App.jsx` |
| Live GPS sharing until resolved | `watchPosition` → `PUT /api/alerts/:id/location` |
| Contacts notified by SMS / email / in-app link | `server/utils/notify.js`, `/track/:token` page |
| Sent → acknowledged → resolved + time-stamped logs | `server/models/Alert.js`, `Log` component |
| Admin: active alerts + reporting | `/admin`, `GET /api/alerts/admin/*` |
| Fast (<2 s): response returns before notifications finish | `POST /api/alerts` |
| Mobile-responsive, secure | responsive CSS; bcrypt + JWT; unguessable tracking tokens |

## Deploy
Client → Vercel/Netlify (`VITE_API_URL=https://your-api/api`, build `npm run build`). API → AWS/Render/etc. with MongoDB Atlas; set `CLIENT_URL` to the deployed client URL. Geolocation requires HTTPS in production.

## Notes / Phase 1 limits
Native apps, police integration and AI detection are out of scope per the PDF. Location tracking runs while the page is open (browser limitation).
