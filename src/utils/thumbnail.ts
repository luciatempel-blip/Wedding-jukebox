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
    </defs>
    <rect width="96" height="96" rx="14" fill="url(#background)"/>
    <circle cx="48" cy="49" r="31" fill="#35491c"/>
    <circle cx="48" cy="49" r="26" fill="none" stroke="#fff" stroke-opacity=".14"/>
    <circle cx="48" cy="49" r="21" fill="none" stroke="#fff" stroke-opacity=".14"/>
    <circle cx="48" cy="49" r="16" fill="url(#label)"/>
    <path d="M51 39v17.5a5 5 0 1 1-3-4.58V43l12-2.5v13a5 5 0 1 1-3-4.58V37z" fill="#fff4e8"/>
    <path d="m22 27 1.5 4.5L28 33l-4.5 1.5L22 39l-1.5-4.5L16 33l4.5-1.5zM72 61l1.5 4.5L78 67l-4.5 1.5L72 73l-1.5-4.5L66 67l4.5-1.5z" fill="#fff4e8" fill-opacity=".85"/>
  </svg>
`;

export const MUSIC_PLACEHOLDER_ART = `data:image/svg+xml,${encodeURIComponent(musicPlaceholderSvg)}`;
