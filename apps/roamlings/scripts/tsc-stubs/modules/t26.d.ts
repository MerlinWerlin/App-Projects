// Stubs added by T26 (see ../README.md). expo-router re-exports React Navigation 7's useNavigation; only the members
// Satchel uses for the discard-changes check: addListener('beforeRemove') (returns an unsubscribe function),
// event.preventDefault(), event.data.action and dispatch().
declare module 'expo-router' {
  export type NavigationAction = { type: string; payload?: object; source?: string; target?: string };
  export type BeforeRemoveEvent = { preventDefault: () => void; defaultPrevented?: boolean; data: { action: NavigationAction } };
  export type NavigationProp = {
    addListener: (type: 'beforeRemove', callback: (e: BeforeRemoveEvent) => void) => () => void;
    dispatch: (action: NavigationAction) => void;
    goBack: () => void;
    canGoBack: () => boolean;
    isFocused: () => boolean;
  };
  export function useNavigation<T = NavigationProp>(): T;
}
