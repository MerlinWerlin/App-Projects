// Pets tab (T186, owner-1101 #4). A thin wrapper: the one Island pets screen is app/pets.tsx
// (T188 builds the living pets there), so /pets links and this tab show the same screen. The tab
// layout gives it a plain title header (app/(tabs)/_layout.tsx), since the screen itself starts
// below the status bar only inside a stack.
export { default } from '../pets';
