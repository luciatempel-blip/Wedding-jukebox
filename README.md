# Wedding Jukebox · Rudi & Lucia

Interactive wedding jukebox with guest song requests, refined responsive DJ console, background playback, lockscreen media controls, and Vercel-ready deployment.

## Features
- **Guest Song Requests**: Guests scan a QR code with their mobile phone (iPhone/Android) and add songs to the live wedding queue.
- **YouTube Integration**: Direct YouTube Data API v3 integration with video playback and high-resolution album artwork.
- **House & Afrikaans Curated Suggestions**: Filterable by House & Dance, Afrikaans Treffers, Party Favourites, and Stadige Dans (Love Songs).
- **Refined DJ Console CSS Grid**: Dedicated 2-column studio layout with dual turntable deck animations, equal-power crossfader, and sticky queue manager.
- **Persistent Audio Engine**: Built as a Single Page Application (SPA)—navigating between views never interrupts or resets audio playback.
- **Lock Screen Media Controls**: Full MediaSession API support with live track artwork and play/pause/skip controls on iPhone, iPad, Android, and macOS.
- **Screen Wake Lock**: Keep display awake toggle so the iPad/laptop screen never sleeps during the party.
- **Printable Wedding QR Sign**: Elegant, printable table sign with QR code and instructions for guests.
- **Admin Security**: PIN-protected administration for queue moderation, remote controls, and banned song filters.

---

## Deploying to Vercel (Step-by-Step)

### Option 1: Via GitHub (Recommended)
1. Push this project folder to your GitHub repository (e.g. `wedding-jukebox`).
2. Log into [vercel.com](https://vercel.com).
3. Click **"Add New..."** > **"Project"**.
4. Select your GitHub repository and click **"Import"**.
5. Vercel automatically detects Vite:
   - **Framework Preset**: `Vite`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
6. Click **"Deploy"**. Your live wedding site will be online in ~45 seconds!

### Option 2: Via Vercel CLI (Direct from Terminal)
1. In this project folder, install the Vercel CLI:
   ```bash
   npm install -g vercel
   ```
2. Log in:
   ```bash
   vercel login
   ```
3. Deploy to production:
   ```bash
   vercel --prod
   ```

---

## Local Development
To run locally:
```bash
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

To test production build:
```bash
npm run build
npm run preview
```
