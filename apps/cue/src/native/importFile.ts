/**
 * Import a script from Files: .txt/.md/.rtf-as-text free, .docx with Plus. Everything is read on the phone.
 * Errors are thrown with readable messages; the caller shows them (no silent failures).
 */
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import JSZip from 'jszip';
import { docxXmlToScript } from '../core/docx';

export async function importScriptFile(canDocx: boolean): Promise<{ title: string; body: string } | null | 'locked'> {
  const res = await DocumentPicker.getDocumentAsync({
    type: ['text/plain', 'text/markdown', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', '*/*'],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (res.canceled || !res.assets?.[0]) return null;
  const a = res.assets[0];
  const name = a.name ?? 'Script';
  const title = name.replace(/\.[^.]+$/, '');
  const file = new File(a.uri);
  if (/\.docx$/i.test(name) || a.mimeType?.includes('wordprocessingml')) {
    if (!canDocx) return 'locked';
    const zip = await JSZip.loadAsync(await file.bytes());
    const doc = zip.file('word/document.xml');
    if (!doc) throw new Error('This .docx has no document text');
    return { title, body: docxXmlToScript(await doc.async('string')) };
  }
  if (/\.(pdf|pages|doc)$/i.test(name)) throw new Error('Cue reads .txt, .md and .docx files. Copy the text and paste it instead.');
  const body = (await file.text()).replace(/\u0000/g, '');
  if (!body.trim()) throw new Error('The file is empty');
  return { title, body };
}
