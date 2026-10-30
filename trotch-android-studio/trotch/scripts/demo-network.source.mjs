/**
 * TROTCH DEMO NETWORK — FICTIONAL / UNVERIFIED.
 *
 * This is illustrative data for development and testing only. Place names are real
 * Greater Accra (and one Kumasi) locations, and coordinates are approximate, but the
 * routes, stop sequences, travel times and fares are NOT surveyed and must not be
 * presented as real-world transport information. Every record is flagged is_demo = true
 * and verification_status = 'unverified' (or 'outdated'/'community_reported' where
 * that is being demonstrated).
 *
 * Edit this file, then run `npm run seed:generate` to regenerate:
 *   - src/data/demo-network.json   (bundled fallback used when Supabase isn't configured)
 *   - supabase/seed.sql            (loaded by `supabase db reset`)
 */

export const SOURCE = {
  key: 'demo-source',
  name: 'Trotch DEMO dataset (fictional, for testing only)',
  kind: 'demo',
  url: null,
};

/** [key, cityId, name, kind, lat, lng, aliases, landmarkHint, verification] */
export const STOPS = [
  ['circle-odawna', 'accra', 'Circle (Odawna) Trotro Station', 'terminal', 5.5713, -0.2148, ['Circle', 'Odawna', 'Kwame Nkrumah Circle'], 'DEMO hint: main lorry park beside Odawna market, under the interchange.', 'unverified'],
  ['neoplan-circle', 'accra', 'Neoplan Station (Circle)', 'terminal', 5.5728, -0.2163, ['Neoplan'], 'DEMO hint: intercity terminal just west of the Circle interchange.', 'unverified'],
  ['circle-overhead', 'accra', 'Circle Overhead (Ring Road)', 'roadside', 5.5694, -0.2117, ['Circle Overhead'], null, 'unverified'],
  ['tema-station', 'accra', 'Tema Station (Accra Central)', 'terminal', 5.5487, -0.2076, ['Accra Central', 'Tema Station', 'Makola'], 'DEMO hint: large terminal near Makola market.', 'unverified'],
  ['kaneshie', 'accra', 'Kaneshie Market Station', 'terminal', 5.5672, -0.2363, ['Kaneshie', 'Kaneshie Market'], null, 'unverified'],
  ['obetsebi', 'accra', 'Obetsebi Lamptey Junction', 'roadside', 5.5679, -0.2265, ['Obetsebi', 'Obetsebi Lamptey'], null, 'community_reported'],
  ['tesano', 'accra', 'Tesano (Police Station Junction)', 'roadside', 5.6, -0.229, ['Tesano'], null, 'unverified'],
  ['achimota', 'accra', 'Achimota Transport Terminal', 'terminal', 5.6148, -0.2269, ['Achimota', 'Achimota Terminal'], null, 'unverified'],
  ['37-station', 'accra', '37 Station (Military Hospital)', 'terminal', 5.5872, -0.184, ['37', '37 Military Hospital', 'Thirty-Seven'], 'DEMO hint: station opposite the hospital main entrance.', 'unverified'],
  ['danquah-circle', 'accra', 'Danquah Circle (Osu)', 'roadside', 5.5656, -0.1797, ['Danquah Circle', 'Osu'], null, 'unverified'],
  ['airport-junction', 'accra', 'Airport Junction (Liberation Road)', 'roadside', 5.6011, -0.1774, ['Airport Junction'], null, 'unverified'],
  ['tetteh-quarshie', 'accra', 'Tetteh Quarshie Interchange', 'roadside', 5.6172, -0.1762, ['Tetteh Quarshie', 'TQ'], 'DEMO hint: lay-by on the Legon-bound side of the interchange.', 'unverified'],
  ['accra-mall-rank', 'accra', 'Accra Mall Taxi Rank', 'station', 5.6213, -0.173, ['Accra Mall', 'Mall taxi rank'], 'DEMO hint: line taxis wait at the rank by the mall car park entrance.', 'unverified'],
  ['okponglo', 'accra', 'Okponglo Junction', 'roadside', 5.633, -0.1795, ['Okponglo', 'East Legon Junction'], null, 'unverified'],
  ['legon-main-gate', 'accra', 'UG Main Gate (Legon)', 'roadside', 5.6362, -0.1857, ['Legon', 'University of Ghana', 'UG', 'Main Gate'], 'DEMO hint: lay-by just outside the university main gate.', 'unverified'],
  ['madina-zongo', 'accra', 'Madina Zongo Junction', 'roadside', 5.6731, -0.1672, ['Zongo Junction', 'Madina'], null, 'unverified'],
  ['madina-station', 'accra', 'Madina Station (Market)', 'terminal', 5.6798, -0.165, ['Madina Market', 'Madina Station'], null, 'unverified'],
  ['kumasi-asafo', 'kumasi', 'Asafo Intercity Terminal (Kumasi)', 'terminal', 6.688, -1.615, ['Kumasi', 'Asafo'], null, 'unverified'],
];

/** [key, cityId, name, kind, lat, lng, aliases, description] */
export const LOCATIONS = [
  ['loc-circle', 'accra', 'Circle', 'junction', 5.5703, -0.2135, ['Kwame Nkrumah Circle', 'Nkrumah Circle', 'Odawna'], 'Kwame Nkrumah Interchange area'],
  ['loc-ug', 'accra', 'University of Ghana, Legon', 'institution', 5.6405, -0.187, ['University of Ghana', 'Legon', 'UG', 'Varsity'], 'Main entrance area of the University of Ghana'],
  ['loc-accra-mall', 'accra', 'Accra Mall', 'landmark', 5.622, -0.1735, ['The Mall', 'Accra Mall Tetteh Quarshie'], 'Shopping mall near Tetteh Quarshie Interchange'],
  ['loc-madina', 'accra', 'Madina', 'neighbourhood', 5.676, -0.166, ['Madina Market'], null],
  ['loc-37', 'accra', '37 Military Hospital', 'institution', 5.5868, -0.183, ['37', 'Thirty-Seven'], null],
  ['loc-osu', 'accra', 'Osu', 'neighbourhood', 5.562, -0.1805, ['Oxford Street', 'Danquah Circle'], null],
  ['loc-kaneshie', 'accra', 'Kaneshie', 'market', 5.568, -0.237, ['Kaneshie Market'], null],
  ['loc-accra-central', 'accra', 'Accra Central (Makola)', 'market', 5.549, -0.2085, ['Makola', 'Accra Central', 'Tema Station'], null],
  ['loc-achimota', 'accra', 'Achimota', 'neighbourhood', 5.615, -0.228, ['Achimota Mall'], null],
  ['loc-kia', 'accra', 'Kotoka International Airport', 'landmark', 5.6052, -0.1715, ['KIA', 'Airport', 'Kotoka'], null],
  ['loc-atomic', 'accra', 'Atomic Junction', 'junction', 5.6669, -0.1919, ['Atomic'], 'Not yet served by any route in the DEMO network'],
  ['loc-kumasi', 'kumasi', 'Kumasi (Asafo)', 'neighbourhood', 6.688, -1.6145, ['Kumasi'], null],
];

/**
 * Routes are DIRECTIONAL. The reverse journey is a separate route (or absent).
 * stops: [stopKey, minutesFromPrevious | null]
 */
export const ROUTES = [
  {
    key: 'r-circle-madina', cityId: 'accra', code: null, name: 'Circle – Madina', mode: 'trotro', headsign: 'Madina',
    callOut: 'Madina! Madina!', typicalWaitMin: 10,
    stops: [['circle-odawna', null], ['37-station', 15], ['airport-junction', 8], ['tetteh-quarshie', 6], ['okponglo', 6], ['legon-main-gate', 4], ['madina-zongo', 10], ['madina-station', 5]],
  },
  {
    key: 'r-madina-circle', cityId: 'accra', code: null, name: 'Madina – Circle', mode: 'trotro', headsign: 'Circle',
    callOut: 'Circle! Circle!', typicalWaitMin: null,
    // Some hop times deliberately missing to exercise estimated durations.
    stops: [['madina-station', null], ['madina-zongo', 5], ['legon-main-gate', 10], ['okponglo', null], ['tetteh-quarshie', 6], ['airport-junction', null], ['37-station', 9], ['circle-odawna', 15]],
  },
  {
    key: 'r-central-achimota', cityId: 'accra', code: null, name: 'Accra Central – Achimota', mode: 'trotro', headsign: 'Achimota',
    callOut: 'Achimota!', typicalWaitMin: null,
    // One direction only in the demo data: the reverse is intentionally absent.
    stops: [['tema-station', null], ['circle-overhead', 12], ['tesano', 15], ['achimota', 8]],
  },
  {
    key: 'r-kaneshie-circle', cityId: 'accra', code: null, name: 'Kaneshie – Circle', mode: 'trotro', headsign: 'Circle',
    callOut: 'Circle!', typicalWaitMin: 6,
    stops: [['kaneshie', null], ['obetsebi', 7], ['circle-odawna', 8]],
  },
  {
    key: 'r-circle-kaneshie', cityId: 'accra', code: null, name: 'Circle – Kaneshie', mode: 'trotro', headsign: 'Kaneshie',
    callOut: 'Kaneshie! Kaneshie!', typicalWaitMin: 6,
    stops: [['circle-odawna', null], ['obetsebi', 9], ['kaneshie', 7]],
  },
  {
    key: 'r-tq-mall', cityId: 'accra', code: null, name: 'Tetteh Quarshie – Accra Mall (line taxi)', mode: 'shared_taxi', headsign: 'Accra Mall',
    callOut: null, typicalWaitMin: 5,
    stops: [['tetteh-quarshie', null], ['accra-mall-rank', 4]],
  },
  {
    key: 'r-mall-tq', cityId: 'accra', code: null, name: 'Accra Mall – Tetteh Quarshie (line taxi)', mode: 'shared_taxi', headsign: 'Tetteh Quarshie',
    callOut: null, typicalWaitMin: 5,
    stops: [['accra-mall-rank', null], ['tetteh-quarshie', 4]],
  },
  {
    key: 'r-bus-central-madina', cityId: 'accra', code: 'DEMO-B1', name: 'Accra Central – Madina (bus)', mode: 'bus', headsign: 'Madina',
    callOut: null, typicalWaitMin: 20,
    stops: [['tema-station', null], ['danquah-circle', 14], ['37-station', 10], ['tetteh-quarshie', 12], ['madina-zongo', 18]],
  },
  {
    key: 'r-intercity-accra-kumasi', cityId: 'accra', code: null, name: 'Accra (Neoplan) – Kumasi (Asafo)', mode: 'intercity_bus', headsign: 'Kumasi',
    callOut: 'Kumasi! Kumasi!', typicalWaitMin: 45,
    stops: [['neoplan-circle', null], ['kumasi-asafo', 300]],
  },
];

/** [key, routeKey, fromStopKey|null, toStopKey|null, min, max, effectiveFrom, effectiveTo, verification] */
export const FARES = [
  ['f-cm-flat', 'r-circle-madina', null, null, 10, 12, '2026-01-01', null, 'unverified'],
  ['f-cm-37', 'r-circle-madina', 'circle-odawna', '37-station', 6, 7, '2026-01-01', null, 'unverified'],
  ['f-cm-tq', 'r-circle-madina', 'circle-odawna', 'tetteh-quarshie', 7, 8, '2026-01-01', null, 'unverified'],
  ['f-cm-legon', 'r-circle-madina', 'circle-odawna', 'legon-main-gate', 8, 9, '2026-01-01', null, 'unverified'],
  ['f-cm-37-legon', 'r-circle-madina', '37-station', 'legon-main-gate', 7, 8, '2026-01-01', null, 'unverified'],
  // Madina – Circle has only one recorded segment, so most trips show "fare unknown".
  ['f-mc-legon', 'r-madina-circle', 'madina-station', 'legon-main-gate', 7, 8, '2026-01-01', null, 'unverified'],
  ['f-ca-flat', 'r-central-achimota', null, null, 8, 10, '2026-01-01', null, 'unverified'],
  // An expired fare (outdated) and its current replacement.
  ['f-kc-old', 'r-kaneshie-circle', null, null, 5, 6, '2025-01-01', '2025-12-31', 'outdated'],
  ['f-kc-flat', 'r-kaneshie-circle', null, null, 6, 7, '2026-01-01', null, 'unverified'],
  // Circle – Kaneshie: no fare recorded on purpose.
  ['f-tqm-flat', 'r-tq-mall', null, null, 8, 10, '2026-01-01', null, 'unverified'],
  ['f-mtq-flat', 'r-mall-tq', null, null, 8, 10, '2026-01-01', null, 'unverified'],
  ['f-b1-flat', 'r-bus-central-madina', null, null, 7, 7, '2026-01-01', null, 'unverified'],
  ['f-ic-flat', 'r-intercity-accra-kumasi', null, null, 160, 190, '2026-01-01', null, 'unverified'],
];
