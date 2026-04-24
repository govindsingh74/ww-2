import type { CountryType, ProvinceType, ResourceType, GeneratedProvince, GeneratedCountry } from './types';

const RESOURCES: ResourceType[] = ['food', 'oil', 'steel', 'money'];

// Country base coordinates [lat, lng] + flag colors
const PLAYABLE_COUNTRIES: { name: string; lat: number; lng: number; color: string }[] = [
  { name: 'USA',          lat: 38,  lng: -96,  color: '#1a3a6b' },
  { name: 'Germany',      lat: 51,  lng: 10,   color: '#333333' },
  { name: 'UK',           lat: 54,  lng: -2,   color: '#c8102e' },
  { name: 'France',       lat: 46,  lng: 2,    color: '#002395' },
  { name: 'USSR',         lat: 60,  lng: 90,   color: '#cc0000' },
  { name: 'Japan',        lat: 36,  lng: 138,  color: '#bc002d' },
  { name: 'Italy',        lat: 42,  lng: 13,   color: '#009246' },
  { name: 'China',        lat: 35,  lng: 105,  color: '#de2910' },
  { name: 'India',        lat: 20,  lng: 78,   color: '#ff9933' },
  { name: 'Canada',       lat: 56,  lng: -96,  color: '#d52b1e' },
  { name: 'Australia',    lat: -27, lng: 133,  color: '#00008b' },
  { name: 'Brazil',       lat: -15, lng: -53,  color: '#009c3b' },
  { name: 'Spain',        lat: 40,  lng: -4,   color: '#aa151b' },
  { name: 'Turkey',       lat: 39,  lng: 35,   color: '#e30a17' },
  { name: 'Poland',       lat: 52,  lng: 20,   color: '#dc143c' },
  { name: 'Netherlands',  lat: 52,  lng: 5,    color: '#ae1c28' },
  { name: 'Belgium',      lat: 50,  lng: 4,    color: '#000000' },
  { name: 'Sweden',       lat: 62,  lng: 15,   color: '#006aa7' },
  { name: 'Norway',       lat: 64,  lng: 13,   color: '#ba0c2f' },
  { name: 'Finland',      lat: 64,  lng: 26,   color: '#003580' },
  { name: 'Mexico',       lat: 23,  lng: -102, color: '#006847' },
  { name: 'South Africa', lat: -29, lng: 25,   color: '#007a4d' },
];

const NEUTRAL_COUNTRIES: { name: string; lat: number; lng: number; color: string }[] = [
  { name: 'Iran',         lat: 32,  lng: 53,   color: '#239f40' },
  { name: 'Iraq',         lat: 33,  lng: 44,   color: '#007a3d' },
  { name: 'Afghanistan',  lat: 33,  lng: 65,   color: '#1b6b3a' },
  { name: 'Thailand',     lat: 15,  lng: 101,  color: '#2d2a4a' },
  { name: 'Vietnam',      lat: 16,  lng: 108,  color: '#da251d' },
  { name: 'Argentina',    lat: -34, lng: -64,  color: '#74acdf' },
  { name: 'Chile',        lat: -35, lng: -71,  color: '#d52b1e' },
  { name: 'Peru',         lat: -10, lng: -76,  color: '#d91023' },
  { name: 'Colombia',     lat: 4,   lng: -73,  color: '#fcd116' },
  { name: 'Saudi Arabia', lat: 24,  lng: 45,   color: '#006c35' },
  { name: 'Egypt',        lat: 26,  lng: 29,   color: '#c09300' },
  { name: 'Libya',        lat: 27,  lng: 17,   color: '#239e46' },
  { name: 'Algeria',      lat: 28,  lng: 3,    color: '#006233' },
  { name: 'Morocco',      lat: 32,  lng: -6,   color: '#c1272d' },
  { name: 'Ukraine',      lat: 49,  lng: 32,   color: '#005bbb' },
  { name: 'Kazakhstan',   lat: 48,  lng: 68,   color: '#00afca' },
  { name: 'Mongolia',     lat: 46,  lng: 103,  color: '#c4272f' },
  { name: 'Philippines',  lat: 13,  lng: 122,  color: '#0038a8' },
];

const PROVINCE_NAMES: Record<string, string[]> = {
  core: ['Northern', 'Southern', 'Eastern', 'Western'],
  peripheral: [
    'Highland', 'Coastal', 'Border', 'River', 'Valley',
    'Plains', 'Forest', 'Desert', 'Mountain', 'Island',
  ],
};

function rand(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function toSlug(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '_');
}

function makeProvince(
  countrySlug: string,
  label: string,
  type: ProvinceType,
  baseLat: number,
  baseLng: number,
  spread: number
): GeneratedProvince {
  const points = type === 'capital' ? 50 : type === 'core' ? 10 : 1;
  const production = type === 'capital' ? 100 : type === 'core' ? 60 : 30;

  return {
    slug: `${countrySlug}_${toSlug(label)}`,
    name: label,
    type,
    points,
    resource_type: pick(RESOURCES),
    base_production: production,
    lat: baseLat + rand(-spread, spread),
    lng: baseLng + rand(-spread, spread),
  };
}

function generateCountry(
  name: string,
  type: CountryType,
  lat: number,
  lng: number,
  color: string
): GeneratedCountry {
  const slug = toSlug(name);
  const provinces: GeneratedProvince[] = [];

  // Capital
  const capital = makeProvince(slug, 'Capital', 'capital', lat, lng, 1);
  provinces.push(capital);

  if (type === 'playable') {
    PROVINCE_NAMES.core.forEach((prefix) => {
      provinces.push(makeProvince(slug, `${prefix} ${name}`, 'core', lat, lng, 5));
    });
    for (let i = 0; i < 10; i++) {
      const label = `${PROVINCE_NAMES.peripheral[i]} Territory`;
      provinces.push(makeProvince(slug, label, 'peripheral', lat, lng, 8));
    }
  } else {
    for (let i = 0; i < 10; i++) {
      const label = `${PROVINCE_NAMES.peripheral[i]} Territory`;
      provinces.push(makeProvince(slug, label, 'peripheral', lat, lng, 6));
    }
  }

  return { slug, name, type, flag_color: color, capital_slug: capital.slug, provinces };
}

export function generateFullMap(): GeneratedCountry[] {
  const countries: GeneratedCountry[] = [];

  for (const c of PLAYABLE_COUNTRIES) {
    countries.push(generateCountry(c.name, 'playable', c.lat, c.lng, c.color));
  }
  for (const c of NEUTRAL_COUNTRIES) {
    countries.push(generateCountry(c.name, 'neutral', c.lat, c.lng, c.color));
  }

  return countries;
}
