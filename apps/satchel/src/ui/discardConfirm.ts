// Leaving a form with unsaved changes asks first (FLOWS §2.2 Cancel and §13): Keep editing (stays, values kept) or
// Discard. Covers the header back button, Android back and the form's own Cancel. While there are unsaved changes
// the screen's swipe-to-dismiss gesture is turned off (see `gestureEnabled` below), because a native swipe can
// close the sheet before the question could be asked.
// Used by item-edit, trip-edit, emergency-edit, doc-edit and the packing list (a typed item or an open rename).
// To confirm on a device (T31): with changes, swipe-down on a modal form must not close it and header back / Cancel
// must ask. React Navigation 7 recommends `usePreventRemove` from @react-navigation/native for this (it also
// handles the native-stack swipe properly, so swipe could stay on and ask instead of being turned off). That
// package is not a direct dependency of Satchel (it comes through expo-router), so this keeps `beforeRemove`; switch
// to usePreventRemove only if @react-navigation/native is ever added to package.json.
import { useNavigation } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import { useApp } from '../state/app.tsx';

/**
 * `dirty`: the form differs from where it started. Returns `leaving()`: call it just before navigating away on
 * purpose (after Save or Delete) so the question is skipped.
 */
export function useDiscardConfirm(dirty: boolean): { leaving: () => void; gestureEnabled: boolean } {
  const navigation = useNavigation();
  const { t } = useApp();
  const skip = useRef(false);

  useEffect(
    () =>
      navigation.addListener('beforeRemove', (e) => {
        if (!dirty || skip.current) return;
        e.preventDefault();
        Alert.alert(t('spec.form.discardTitle'), t('spec.form.discardBody'), [
          { text: t('spec.form.keepEditing'), style: 'cancel' },
          {
            text: t('spec.form.discard'),
            style: 'destructive',
            onPress: () => {
              skip.current = true;
              navigation.dispatch(e.data.action);
            },
          },
        ]);
      }),
    [navigation, dirty, t],
  );

  return {
    leaving: () => {
      skip.current = true;
    },
    gestureEnabled: !dirty,
  };
}
