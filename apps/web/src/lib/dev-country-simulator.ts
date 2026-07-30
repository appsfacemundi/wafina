/**
 * Development-only hook to test the switch-country prompt without real GPS,
 * a VPN, or a fake-location app — see Settings' "Opções de Programador"
 * section (only rendered when NODE_ENV !== 'production', never in a real
 * build). Publishes an ISO code that SwitchCountryPrompt treats exactly like
 * a real GPS detection.
 */
type Listener = (isoCode: string) => void;

let listeners: Listener[] = [];

export function simulateCountryDetection(isoCode: string): void {
  listeners.forEach((listener) => listener(isoCode));
}

export function onSimulatedCountryDetection(listener: Listener): () => void {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}
