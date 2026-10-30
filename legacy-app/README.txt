WEDDING JUKEBOX
===============
Guests scan a QR code, search a song, tap Add. Your iPad/laptop plays the queue,
and your base playlist fills the gaps.

Open the "Wedding Jukebox - Setup Guide" document for the step-by-step instructions.

Files:
  config.js            <- the ONLY file you edit (database address, YouTube key, playlist, PIN,
                          crossfadeSeconds = how long songs blend, skipFadeSeconds = blend on Skip,
                          siteTitle = heading of the menu, replayAfterMinutes = how long a guest waits
                          before a song that already played can be requested again)
  index.html           guest page (what the QR code opens)
  player.html          open this on the iPad/laptop that plays the music
  admin.html           skip / remove songs, pause requests, print the QR sign
  firebase-rules.json  paste into Firebase "Rules" (Step 2 of the guide)
  everything else      supporting files - leave them alone

Every page has a burger menu (top left) that lists the Guest, Player and Admin pages.
Player and Admin show a padlock until the admin PIN (from config.js) is typed in on that device.

Note: iPads/iPhones do not let a web page change video volume, so on an iPad the songs play one after
another (no blend) and the volume slider is off. Run the player page on a laptop to get the blend.

Leave config.js with empty "" values to try everything in PREVIEW mode:
double-click index.html (nothing is shared between phones in preview mode).
