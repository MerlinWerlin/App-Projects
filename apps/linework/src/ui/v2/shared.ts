// Small shared bits for the design v2 components (docs/DESIGN_V2.md §4, §6).
import type { ComponentProps } from 'react';
import type { ViewStyle } from 'react-native';
import { Feather } from '@expo/vector-icons';

export type FeatherName = ComponentProps<typeof Feather>['name'];

/** iOS continuous ("squircle") corners; other platforms ignore it. */
export const squircle: ViewStyle = { borderCurve: 'continuous' };
