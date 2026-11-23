/** Writes a template PDF to the app's cache folder, then prints it (AirPrint) or opens the share sheet. */
import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import type { PdfDoc } from '../core/pdf.ts';

function writePdf(doc: PdfDoc, fileName: string): string {
  const safe = fileName.replace(/[^A-Za-z0-9._ -]/g, '').replace(/\s+/g, '-').slice(0, 80) || 'Rootpass-template';
  const f = new File(Paths.cache, `${safe}.pdf`);
  if (f.exists) f.delete();
  f.create();
  f.write(doc.toBytes());
  return f.uri;
}

export async function printPdf(doc: PdfDoc, fileName: string): Promise<void> {
  const uri = writePdf(doc, fileName);
  await Print.printAsync({ uri });
}

export async function sharePdf(doc: PdfDoc, fileName: string): Promise<void> {
  const uri = writePdf(doc, fileName);
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device');
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: 'Save or share the template' });
}
