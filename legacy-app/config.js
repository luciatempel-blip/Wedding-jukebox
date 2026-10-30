// ============================================================
//  WEDDING JUKEBOX - SETTINGS
//  This is the ONLY file you need to edit.
//  Keep the quote marks "like this" around every value.
// ============================================================

window.JUKEBOX_CONFIG = {

  // Shown at the top of the guest page, e.g. "Lucia & Thabo's Wedding"
  coupleNames: "Rudi and Lucia",

  // The heading at the top of the menu on every page.
  siteTitle: "Scheepers JukeBox",

  // A song that has already played can be requested again after this many minutes.
  // Use 0 to never allow a repeat.
  replayAfterMinutes: 30,

  // STEP A (from the guide): your Firebase database address.
  // Looks like: "https://your-project-default-rtdb.firebaseio.com"
  // While this is empty the site runs in PREVIEW mode (nothing is shared between phones).
  firebaseDbUrl: "https://wedding-jukebox-ce2d4-default-rtdb.firebaseio.com/",

  // STEP B (from the guide): your YouTube API key. Looks like "AIzaSy..."
  // While this is empty, the player only pretends to play (demo mode).
  youtubeApiKey: "AIzaSyD3ueltkzjq0b3pVigd0bIXGbxhOtfsMF8",

  // STEP C (from the guide): your base playlist. You can paste the whole
  // playlist link or just the part after "list=". It must be set to
  // "Public" or "Unlisted" in YouTube / YouTube Music.
  basePlaylistId: "https://www.youtube.com/watch?v=Nkmmoq1UHIg&list=PLC9pq_EfiiU0",

  // The password for the admin page (skip / remove songs). Change it!
  adminPin: "20260106",

  // How many songs one guest (one phone) may add. Use 0 for no limit.
  maxSongsPerGuest: 0,

  // true = hide songs marked "explicit" in guest search results.
  blockExplicit: false,

  // Songs whose title or artist contains any of these words cannot be added.
  // Example: ["baby shark", "macarena"]
  bannedWords: ["celine dion"],

  // Two-letter country code. Helps search find songs available where you live.
  regionCode: "ZA",

  // true = YouTube lookups only look at videos in the "Music" category.
  musicOnly: false,

  // Optional: artists you love. The guest page's "Ideas for you" mixes songs by these
  // artists with ones from your base playlist and the songs guests request.
  // Example: ["Beyonce", "Ed Sheeran", "Johnny Clegg"]
  suggestionArtists: [],

  // How many seconds one song overlaps the next so they flow into each other.
  // Longer = smoother blend (try 6 to 12). Use 0 for no overlap.
  crossfadeSeconds: 8,

  // How long the blend lasts when someone presses Skip.
  skipFadeSeconds: 3
};
