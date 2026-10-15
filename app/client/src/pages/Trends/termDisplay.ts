/**
 * How a tracked term reads on screen. Gold spells every term in lower case
 * so the SQL can match it; acronyms and brand names get their usual
 * capitals here, for the link text only. The route keeps the raw term.
 */
const DISPLAY: Record<string, string> = {
  ndaa: 'NDAA',
  pfas: 'PFAS',
  lng: 'LNG',
  tiktok: 'TikTok',
  '340b': '340B',
  ai: 'AI',
  esg: 'ESG',
  fda: 'FDA',
  sec: 'SEC',
  faa: 'FAA',
  epa: 'EPA',
  nih: 'NIH',
  usda: 'USDA',
  medicare: 'Medicare',
  medicaid: 'Medicaid',
};

export function termDisplay(term: string): string {
  const key = term.trim().toLowerCase();
  if (DISPLAY[key]) return DISPLAY[key];
  // A multi-word term with an acronym inside it, for example `ndaa reauthorization`.
  return key
    .split(' ')
    .map((word) => DISPLAY[word] ?? word)
    .join(' ');
}
