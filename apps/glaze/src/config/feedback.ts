// Where "Send feedback" emails go (owner requirement, docs/feedback/2026-10-12-feedback-email.md).
// This is the ONLY place the address may appear in code (src/core/feedback.test.ts guards it).
// TODO before store release: switch to a dedicated support address.
// Pure data: no React Native / Expo imports, so src/core tests can read it too.
export const FEEDBACK_ADDRESS = 'jared.bradley272@gmail.com';
