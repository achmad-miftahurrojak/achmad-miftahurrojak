/**
 * Splits a long string into chunks ≤ maxLen characters,
 * preferring paragraph breaks, then newlines, then spaces.
 */
export function splitLong(text: string, maxLen = 1900): string[] {
  text = text.trim();
  if (!text) return [];
  if (text.length <= maxLen) return [text];

  const parts: string[] = [];
  let sisa = text;

  while (sisa.length > maxLen) {
    const jendela = sisa.substring(0, maxLen);
    let titik = jendela.lastIndexOf('\n\n');
    if (titik < maxLen / 3) titik = jendela.lastIndexOf('\n');
    if (titik < maxLen / 3) titik = jendela.lastIndexOf(' ');
    if (titik < maxLen / 3) titik = maxLen;

    parts.push(sisa.substring(0, titik).trimEnd());
    sisa = sisa.substring(titik).trimStart();
  }

  if (sisa) parts.push(sisa);
  return parts;
}
