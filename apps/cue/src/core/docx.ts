/**
 * Word (.docx) document.xml -> Cue script text. Pure TS (the zip is opened by src/native/importFile.ts).
 * Heading styles become "# " sections, bold runs become *emphasis*, paragraphs stay paragraphs.
 */
function decode(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, '&');
}

export function docxXmlToScript(xml: string): string {
  const out: string[] = [];
  const paras = xml.match(/<w:p[ >][\s\S]*?<\/w:p>/g) ?? [];
  for (const p of paras) {
    const isHeading = /<w:pStyle w:val="(Heading|Title)[^"]*"/i.test(p);
    let line = '';
    const runs = p.match(/<w:r[ >][\s\S]*?<\/w:r>/g) ?? [];
    for (const r of runs) {
      const bold = /<w:b(?:\s+w:val="(?:1|true)")?\s*\/>/.test(r) && !/<w:b\s+w:val="(?:0|false)"/.test(r);
      const text = (r.match(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g) ?? []).map((tt) => decode(tt.replace(/<[^>]+>/g, ''))).join('');
      const tabs = /<w:tab\/>/.test(r) ? ' ' : '';
      const brk = /<w:br\/>/.test(r) ? ' ' : '';
      if (!text) {
        line += tabs + brk;
        continue;
      }
      line += bold && !isHeading && text.trim() ? text.replace(/^(\s*)(.*?)(\s*)$/, '$1*$2*$3') : text;
    }
    line = line.replace(/\s+/g, ' ').trim();
    if (!line) {
      out.push('');
      continue;
    }
    out.push(isHeading ? `# ${line}` : line);
    out.push('');
  }
  return out
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
