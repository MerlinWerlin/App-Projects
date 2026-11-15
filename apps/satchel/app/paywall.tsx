// 1.0.0: the free trial and one-time unlock screen, opened from Settings or from a share button after the trial.
import { Screen } from '../src/ui/kit.tsx';
import { Paywall } from '../src/ui/Paywall.tsx';

export default function PaywallScreen() {
  return (
    <Screen>
      <Paywall />
    </Screen>
  );
}
