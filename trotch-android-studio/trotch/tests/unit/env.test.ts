/**
 * Regression: copying .env.example to .env without editing it must leave the app in DEMO mode,
 * not point it at a non-existent backend (which made the planner fail to load any data).
 */
describe('env', () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
    jest.resetModules();
  });

  const load = (vars: Record<string, string>) => {
    Object.assign(process.env, vars);
    let mod!: typeof import('@/lib/env');
    jest.isolateModules(() => {
      mod = jest.requireActual('@/lib/env');
    });
    return mod;
  };

  it('treats template placeholders as not configured', () => {
    const { isSupabaseConfigured, env } = load({
      EXPO_PUBLIC_SUPABASE_URL: 'https://YOUR-PROJECT-REF.supabase.co',
      EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_REPLACE_ME',
    });
    expect(env.supabaseUrl).toBeNull();
    expect(isSupabaseConfigured()).toBe(false);
  });

  it('accepts real-looking values', () => {
    const { isSupabaseConfigured } = load({
      EXPO_PUBLIC_SUPABASE_URL: 'https://abcdefghijklmnop.supabase.co',
      EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_abc123',
    });
    expect(isSupabaseConfigured()).toBe(true);
  });

  it('isPlaceholder only flags template markers', () => {
    const { isPlaceholder } = load({});
    expect(isPlaceholder('sb_publishable_REPLACE_ME')).toBe(true);
    expect(isPlaceholder('https://api.maptiler.com/maps/x/{z}/{x}/{y}.png?key=YOUR_KEY')).toBe(true);
    expect(isPlaceholder('https://real.supabase.co')).toBe(false);
    expect(isPlaceholder(null)).toBe(false);
  });
});
