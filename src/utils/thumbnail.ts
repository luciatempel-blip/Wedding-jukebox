const musicPlaceholderSvg = `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">
    <defs>
      <linearGradient id="background" x1="0" y1="0" x2="1" y2="1">
        <stop stop-color="#f9e8d7"/>
        <stop offset="1" stop-color="#eeb8a6"/>
      </linearGradient>
      <linearGradient id="label" x1="0" y1="0" x2="1" y2="1">
        <stop stop-color="#d8456f"/>
        <stop offset="1" stop-color="#b85433"/>
      </linearGradient>
      <radialGradient id="shine" cx=".28" cy=".2" r=".9">
        <stop stop-color="#fff" stop-opacity=".16"/>
        <stop offset="1" stop-color="#fff" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="96" height="96" rx="14" fill="url(#background)"/>
    <circle cx="48" cy="49" r="32" fill="#35491c"/>
    <circle cx="48" cy="49" r="28" fill="none" stroke="#fff" stroke-opacity=".12"/>
    <circle cx="48" cy="49" r="24" fill="none" stroke="#fff" stroke-opacity=".12"/>
    <circle cx="48" cy="49" r="20" fill="none" stroke="#fff" stroke-opacity=".12"/>
    <circle cx="48" cy="49" r="16" fill="url(#label)"/>
    <circle cx="48" cy="49" r="32" fill="url(#shine)"/>
    <path d="M51 39v17.5a5 5 0 1 1-3-4.58V43l12-2.5v13a5 5 0 1 1-3-4.58V37z" fill="#fff4e8"/>
    <path d="m22 24 1.5 4.5L28 30l-4.5 1.5L22 36l-1.5-4.5L16 30l4.5-1.5zM74 62l1.5 4.5L80 68l-4.5 1.5L74 74l-1.5-4.5L68 68l4.5-1.5z" fill="#fff4e8" fill-opacity=".9"/>
    <circle cx="72" cy="27" r="2" fill="#fff4e8" fill-opacity=".8"/>
  </svg>
`;

export const MUSIC_PLACEHOLDER_ART = `data:image/svg+xml,${encodeURIComponent(musicPlaceholderSvg)}`;