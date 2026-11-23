/**
 * Store-screenshot build only (EXPO_PUBLIC_WATTLE_CAPTURE=1 at bundle time, set by
 * .github/workflows/wattle-store-capture.yml). Store builds never set it, so CAPTURE is false and this is dead code.
 * It opens every calculator (as during the trial), hides the first-launch notice and pre-fills example inputs.
 */
export const CAPTURE = process.env.EXPO_PUBLIC_WATTLE_CAPTURE === '1';

export const DEMO = {
  bend: { rise: '150', angle: '30', to: '1200', centre: '45', angle4: '45', height: '110', width: '300', to4: '900', kRise: '60', kAngle: '15', stub: '350', take: '125', radius: '100' },
  drop: { current: '32', length: '45', mv: '9.5', area: '10', temp: '75', pf: '1' },
  power: { v: '400', pf: '0.85', x: '15' },
  runs: [
    { id: 'r1', label: 'Kitchen GPOs', length: '28', qty: '2' },
    { id: 'r2', label: 'Shed sub-main', length: '46', qty: '1' },
    { id: 'r3', label: 'Lights', length: '18', qty: '3' },
  ],
  drums: [{ id: 'd1', label: 'Drum 1', length: '100' }, { id: 'd2', label: 'Drum 2', length: '100' }],
};
