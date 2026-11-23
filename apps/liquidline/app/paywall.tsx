import { Screen } from '../src/ui/kit.tsx';
import { Paywall } from '../src/ui/Paywall.tsx';

export default function PaywallScreen() {
  return (
    <Screen tab={false}>
      <Paywall />
    </Screen>
  );
}
