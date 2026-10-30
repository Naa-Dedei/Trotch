/**
 * Automated user-flow checks with Expo Router's testing library.
 * No backend is configured in tests, so the app runs on the bundled DEMO network
 * and account features report that they're unavailable.
 */
import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';

jest.setTimeout(60000);

async function pickPlace(fieldTestId: 'origin-field' | 'destination-field', query: string, resultName: string) {
  fireEvent.press(screen.getByTestId(fieldTestId));
  const input = await screen.findByTestId('place-search-input');
  fireEvent.changeText(input, query);
  fireEvent.press(await screen.findByTestId(`place-result-${resultName}`));
  await waitFor(() => expect(screen.queryByTestId('place-search-input')).toBeNull());
}

describe('core journey flow (DEMO network, no backend)', () => {
  it('opens on Home, plans Circle → University of Ghana, shows the map and step-by-step instructions', async () => {
    renderRouter('src/app', { initialUrl: '/' });

    // 1. Open the app
    expect(await screen.findByRole('header', { name: 'Where are you going?' })).toBeTruthy();
    expect(await screen.findByTestId('demo-banner')).toBeTruthy();

    // 2–3. Search for an origin and a destination (alias search: "Legon")
    await pickPlace('origin-field', 'Circle', 'Circle');
    await pickPlace('destination-field', 'Legon', 'University of Ghana, Legon');
    expect(screen.getByText('Circle')).toBeTruthy();
    expect(screen.getByText('University of Ghana, Legon')).toBeTruthy();

    // 4. Find routes and select a valid route
    fireEvent.press(screen.getByTestId('find-routes'));
    expect(await screen.findByTestId('plan-map')).toBeTruthy();
    const option = await screen.findByTestId('journey-option-0');
    fireEvent.press(option);
    expect(screen.getAllByText(/Uses DEMO data/).length).toBeGreaterThan(0);

    // 5–6. Open the journey: map + chronological instructions generated from route data
    fireEvent.press(screen.getByTestId('view-steps'));
    expect(await screen.findByTestId('journey-map')).toBeTruthy();
    expect(screen.getByText('Step by step')).toBeTruthy();
    expect(screen.getByText(/Board a trotro to Madina at Circle \(Odawna\) Trotro Station/)).toBeTruthy();
    expect(screen.getByText(/Get off at UG Main Gate \(Legon\)/)).toBeTruthy();
    expect(screen.getByText('Arrive at University of Ghana, Legon')).toBeTruthy();
    expect(screen.getByText(/The mate usually calls out “Madina! Madina!”/)).toBeTruthy();

    // 7. Saving requires an account; this build has no backend so it says so instead of failing.
    expect(screen.getByText(/Saving needs an account/)).toBeTruthy();
  });

  it('explains when no verified connection exists instead of inventing one', async () => {
    renderRouter('src/app', { initialUrl: '/' });
    await screen.findByTestId('home-screen');
    await pickPlace('origin-field', 'Achimota', 'Achimota');
    await pickPlace('destination-field', 'Makola', 'Accra Central (Makola)');
    fireEvent.press(screen.getByTestId('find-routes'));
    expect(await screen.findByTestId('no-route')).toBeTruthy();
    expect(screen.getByText(/not yet available in Trotch's verified network/)).toBeTruthy();
  });

  it('swaps origin and destination', async () => {
    renderRouter('src/app', { initialUrl: '/' });
    await screen.findByTestId('home-screen');
    await pickPlace('origin-field', 'Circle', 'Circle');
    await pickPlace('destination-field', 'Accra Mall', 'Accra Mall');
    fireEvent.press(screen.getByTestId('swap-places'));
    expect(screen.getByTestId('origin-field').props.accessibilityLabel).toBe('From: Accra Mall');
    expect(screen.getByTestId('destination-field').props.accessibilityLabel).toBe('To: Circle');
  });
});

describe('access control in the UI', () => {
  it('sends signed-out users away from the admin area', async () => {
    const r = renderRouter('src/app', { initialUrl: '/admin' });
    await waitFor(() => expect(r.getPathname()).toBe('/auth/sign-in'));
    expect(screen.queryByTestId('admin-home')).toBeNull();
  });

  it('does not show the admin entry on the profile screen for ordinary users', async () => {
    renderRouter('src/app', { initialUrl: '/profile' });
    expect(await screen.findByTestId('profile-screen')).toBeTruthy();
    expect(screen.queryByTestId('admin-entry')).toBeNull();
  });

  it('reporting explains that it needs the backend when none is configured', async () => {
    renderRouter('src/app', { initialUrl: '/report?type=route_info' });
    expect(await screen.findByText(/Reporting needs the Trotch backend/)).toBeTruthy();
  });
});
