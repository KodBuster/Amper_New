/** SVG-иконки как в AMPER A v14.2 */
const PATHS: Record<string, string> = {
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  bag: '<path d="M5 8h14l-1 13H6L5 8Z"/><path d="M9 9V6a3 3 0 0 1 6 0v3"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  x: '<path d="M5 5l14 14M19 5 5 19"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  heart:
    '<path d="M20 8c0 4-8 11-8 11S4 12 4 8a4.5 4.5 0 0 1 8-2 4.5 4.5 0 0 1 8 2Z"/>',
  file: '<path d="M7 3h7l4 4v14H7z"/><path d="M14 3v5h5M10 13h5M10 16h5"/>',
  check: '<path d="m5 12 5 5L20 7"/>',
  grid: '<rect x="3" y="3" width="8" height="8"/><rect x="13" y="3" width="8" height="8"/><rect x="3" y="13" width="8" height="8"/><rect x="13" y="13" width="8" height="8"/>',
  truck:
    '<path d="M3 7h11v11H3zM14 11h4l3 3v4h-7z"/><circle cx="7" cy="19" r="2"/><circle cx="18" cy="19" r="2"/>',
  spark: '<path d="m13 2-8 11h7l-1 9 8-12h-7z"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
  chev: '<path d="m9 5 7 7-7 7"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 10v8M12 7h.01"/>',
  filter: '<path d="M4 7h16M7 12h10M10 17h4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
}

export function Icon({ name }: { name: keyof typeof PATHS | string }) {
  const body = PATHS[name] || PATHS.arrow
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      dangerouslySetInnerHTML={{ __html: body }}
    />
  )
}
