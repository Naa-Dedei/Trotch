/* Global Jest setup: mocks for native modules that don't exist in the Node test environment. */
import mockAsyncStorage from '@react-native-async-storage/async-storage/jest/async-storage-mock';

jest.mock('@react-native-async-storage/async-storage', () => mockAsyncStorage);

jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  return {
    getItemAsync: jest.fn(async (k: string) => store.get(k) ?? null),
    setItemAsync: jest.fn(async (k: string, v: string) => void store.set(k, v)),
    deleteItemAsync: jest.fn(async (k: string) => void store.delete(k)),
  };
});

jest.mock('expo-location', () => ({
  Accuracy: { Balanced: 3 },
  getForegroundPermissionsAsync: jest.fn(async () => ({ status: 'undetermined', canAskAgain: true })),
  requestForegroundPermissionsAsync: jest.fn(async () => ({ status: 'denied', canAskAgain: false })),
  getLastKnownPositionAsync: jest.fn(async () => null),
  getCurrentPositionAsync: jest.fn(async () => ({ coords: { latitude: 5.5703, longitude: -0.2135, accuracy: 20 } })),
}));

// react-native-maps is a native view; render lightweight stand-ins so screens can be tested.
jest.mock('react-native-maps', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require('react-native');
  const MapView = React.forwardRef(function MockMapView(props: Record<string, unknown>, ref: unknown) {
    React.useImperativeHandle(ref, () => ({ fitToCoordinates: jest.fn(), animateToRegion: jest.fn() }));
    const { children, testID } = props as { children?: React.ReactNode; testID?: string };
    return React.createElement(View, { testID: testID ?? 'mock-map' }, children);
  });
  const passthrough = (name: string) =>
    function Mock(props: { children?: React.ReactNode; accessibilityLabel?: string }) {
      return React.createElement(View, { testID: `mock-${name}`, accessibilityLabel: props.accessibilityLabel }, props.children);
    };
  return {
    __esModule: true,
    default: MapView,
    Marker: passthrough('marker'),
    Polyline: passthrough('polyline'),
    UrlTile: passthrough('urltile'),
  };
});
