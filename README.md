# Swiftline

The marketing site for Swiftline, an AI receptionist for med spas.

## What's wired up

- ✅ Cal.com booking link (`cal.com/eman-swiftline/15min`) is hooked into all 4 demo buttons
- ✅ Contact form posts to `/api/lead` and emails `eman@getswiftline.com` via Resend
- ✅ Plausible analytics for `getswiftline.com`
- ✅ SEO meta tags, Open Graph, Twitter cards
- ✅ Favicon and social share image
- ✅ Privacy policy and terms pages

## What's still placeholder

- ⚠️ Phone number `(855) 555 5555` (2 instances in `index.html`) — replace with your real demo number when you have one

## Project structure

```
swiftline-build/
├── api/
│   └── lead.js              ← Serverless function for the contact form
├── public/
│   ├── favicon.svg          ← Browser tab icon
│   ├── og-image.png         ← Social share preview (used by iMessage/LinkedIn/etc)
│   ├── og-image.svg         ← Source for OG image
│   ├── robots.txt           ← SEO
│   └── sitemap.xml          ← SEO
├── .env.example             ← Template for environment variables
├── .gitignore               ← Files git should ignore
├── index.html               ← Main marketing page
├── package.json             ← Node dependencies
├── privacy.html             ← Privacy policy page
├── README.md                ← This file
├── terms.html               ← Terms of service page
└── vercel.json              ← Deploy config + security headers
```

---

## Deployment guide (do this in order)

### Step 1 — Push the project to GitHub

```bash
cd swiftline-build
git init
git add .
git commit -m "Initial Swiftline launch"
git branch -M main
```

Then create a new repo on github.com (private is fine), and:

```bash
git remote add origin https://github.com/YOUR_USERNAME/swiftline.git
git push -u origin main
```

### Step 2 — Connect to Vercel

1. Go to [vercel.com](https://vercel.com) and sign in (use your GitHub email for easiest connection)
2. Click **"Add New" → "Project"**
3. Import the `swiftline` repo
4. Vercel auto-detects everything. Click **Deploy**.

You'll get a live URL like `swiftline-xyz.vercel.app` in about 30 seconds.

### Step 3 — Set up Resend (for the contact form)

1. Sign up at [resend.com](https://resend.com)
2. In Resend, add `getswiftline.com` as a domain
3. Resend gives you DNS records (TXT/MX). Add them at your domain registrar.
4. Wait a few minutes for verification, then go to **API Keys** and create one
5. **Copy the key** — you'll paste it into Vercel in the next step (don't save it anywhere else)

### Step 4 — Add environment variables in Vercel

In your Vercel project: **Settings → Environment Variables**, add:

| Name | Value |
|------|-------|
| `RESEND_API_KEY` | `re_xxxxxxxxxx` (the key from Resend) |
| `LEAD_NOTIFICATION_EMAIL` | `eman@getswiftline.com` |
| `LEAD_FROM_EMAIL` | `notifications@getswiftline.com` |

After adding all three, go to the **Deployments** tab and click **Redeploy** on the latest deployment so the new variables take effect.

### Step 5 — Set up email forwarding (eman@getswiftline.com → getswiftline@gmail.com)

Email forwarding is set up at your **domain registrar**, not in the code. The exact steps depend on where you registered `getswiftline.com`:

- **Namecheap**: Domain List → Manage → Advanced DNS → Mail Settings → "Email Forwarding"
- **GoDaddy**: My Products → Email Forwarding → Add forwarding
- **Cloudflare**: Email Routing (free) → Add address → Forward `eman@getswiftline.com` to `getswiftline@gmail.com`
- **Google Domains/Squarespace**: Email forwarding section under DNS settings

For most registrars: add a forwarding rule that sends mail to `eman@getswiftline.com` to `getswiftline@gmail.com`.

**Recommended:** If your registrar doesn't offer free forwarding, move your DNS to **Cloudflare** (free) — they offer unlimited email forwarding and it's the cleanest setup.

⚠️ **Note:** Email forwarding only handles incoming mail. To **send** from `eman@getswiftline.com`, you'd need a real mailbox (Google Workspace at $6/mo, or Fastmail). For now, replies will come from your `getswiftline@gmail.com` Gmail.

### Step 6 — Connect your domain to Vercel

1. In Vercel: **Settings → Domains**
2. Add `getswiftline.com` and `www.getswiftline.com`
3. Vercel gives you DNS records (an A record and a CNAME)
4. Add them at your domain registrar (don't remove the email forwarding records from step 5)
5. Wait a few minutes — your site will be live at `getswiftline.com`

### Step 7 — Set up Plausible analytics

1. Sign up at [plausible.io](https://plausible.io) (10-day trial, then $9/mo)
2. Add `getswiftline.com` as a site
3. The tracking script is already in the page — no code changes needed
4. Traffic will start showing up within an hour

### Step 8 — Test everything end-to-end

1. Visit your live site
2. Click a "Book a demo" button — Cal.com modal should open
3. Fill out the contact form with a test message — you should get an email at `getswiftline@gmail.com` within 30 seconds
4. Share the URL in iMessage or paste it on LinkedIn — confirm the OG image preview shows up correctly
5. Check Plausible dashboard — your visit should appear

If something doesn't work, check:
- Vercel **Deployments → Logs** for backend errors
- Browser console for frontend errors
- Resend **Logs** to see if emails are being attempted

---

## Day-to-day operations

### Updating content

Edit `index.html` directly. Push to GitHub. Vercel auto-deploys in ~30 seconds.

### Updating the OG share image

Replace `public/og-image.png`. After updating, debug it at [opengraph.dev](https://opengraph.dev/) and [LinkedIn Post Inspector](https://www.linkedin.com/post-inspector/) to force the cache to refresh.

### Adding the demo phone number

When you have a real Twilio/Retell number for the "Hear it live" button:

1. Open `index.html`
2. Find both instances of `(855) 555 5555` and replace with your real number (display format)
3. Find both instances of `tel:+18555555555` and replace with your real number (E.164 format, e.g. `tel:+14155551234`)
4. Push to GitHub

### Running locally for development

```bash
npm install
npx vercel dev
```

Site runs at `http://localhost:3000`. Create a `.env.local` file (copy from `.env.example`) with your real values to test the form locally.
