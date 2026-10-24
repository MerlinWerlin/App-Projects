import { docxXmlToScript } from './docx';
import { parseScript } from './script';

const xml = `<w:document><w:body>
<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Opening</w:t></w:r></w:p>
<w:p><w:r><w:t xml:space="preserve">Hello </w:t></w:r><w:r><w:rPr><w:b/></w:rPr><w:t>everyone</w:t></w:r><w:r><w:t xml:space="preserve"> &amp; welcome.</w:t></w:r></w:p>
<w:p></w:p>
<w:p><w:r><w:t>Second para</w:t></w:r></w:p>
</w:body></w:document>`;

describe('docx import', () => {
  it('keeps headings, bold and paragraphs', () => {
    const s = docxXmlToScript(xml);
    expect(s).toBe('# Opening\n\nHello *everyone* & welcome.\n\nSecond para');
    const p = parseScript(s);
    expect(p.sections[0]!.title).toBe('Opening');
    expect(p.words).toEqual(['hello', 'everyone', 'welcome', 'second', 'para']);
  });
  it('empty input', () => {
    expect(docxXmlToScript('')).toBe('');
  });
});
