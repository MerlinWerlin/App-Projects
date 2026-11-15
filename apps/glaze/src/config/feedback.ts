// Where "Send feedback" emails go (owner requirement, docs/feedback/2026-10-12-feedback-email.md).
// This is the ONLY place the address may appear in code (src/core/feedback.test.ts guards it).
// The owner's own address is the support address for now; a dedicated one can replace it here later.
// Pure data: no React Native / Expo imports, so src/core tests can read it too.
export const FEEDBACK_ADDRESS = 'jared.bradley272@gmail.com';
