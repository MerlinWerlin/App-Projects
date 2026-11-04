// Strings for followups109 (run 110). Every UI string lives in the catalogue.
// T155: run-109 follow-ups (prefix f109.).
export const followups109 = {
  // Document screen: crop an image copy to its code (shared crop editor) and the in-app PDF viewer.
  'f109.doc.cropAdd': 'Crop to the code',
  'f109.doc.cropAddHint': 'Frame the QR code or barcode on {name} so this screen shows just the code, big',
  'f109.doc.cropAdjust': 'Adjust the crop',
  'f109.doc.cropAdjustHint': 'Move or resize the frame around the code on {name}',
  'f109.doc.codeLabel': 'Code from {label}: {name}',
  'f109.doc.viewPdf': 'View {name}',
  'f109.doc.viewPdfHint': 'Shows the PDF full screen inside Satchel. It stays on this phone.',
  'f109.doc.sharePdf': 'Open in…',
  'f109.doc.sharePdfHint': 'Shows {name} in the system preview or share sheet',
  'f109.doc.pdfLabel': '{label}: {name}, PDF',
  'f109.doc.pdfBack': 'Back to the document',
  'f109.doc.pdfBackHint': 'Closes the PDF',
  'f109.doc.pdfFailed': 'This PDF can’t be shown inside Satchel on this phone. Use Open in… instead.',
  // Crop editor wording for a document copy (tickets keep the T28 wording).
  'f109.crop.docBody': 'Drag the corners so the frame fits snugly around the QR code or barcode. Drag inside the frame to move it. The document then shows just the code, big and bright. The copy itself is not changed.',
  'f109.crop.docImageLabel': 'Document image with the crop frame. Use the Smaller and Larger buttons to resize the frame.',
} as const;
