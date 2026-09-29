/**
 * Festivals and Cultural Events Dataset
 * 
 * Provides cultural festivals and regional events for Indian and Telangana observances.
 * 
 * IMPORTANT COMPLIANCE NOTE:
 * - This dataset is STRICTLY for cultural festivals and celebration observances.
 * - None of these entries are labeled as or represent public holidays, bank holidays,
 *   government closures, or leave entitlements.
 * - This dataset is kept completely decoupled from the attendance and leave systems.
 */

export interface FestivalEvent {
  id: string;
  name: string;
  dayOfMonth: number;
  month: number; // 0-indexed: 0 = January, 11 = December
  year: number;
  category: 'Cultural Festival' | 'State Celebration' | 'Traditional Festival' | 'Observance';
  region: 'Telangana & National' | 'Telangana' | 'National' | 'Global Observance';
  description?: string;
}

/**
 * Fixed-date annual celebrations and state observances.
 * These occur on the exact same solar calendar day each year.
 */
interface FixedDateEventDef {
  name: string;
  month: number; // 0-indexed
  dayOfMonth: number;
  category: FestivalEvent['category'];
  region: FestivalEvent['region'];
  description?: string;
}

const FIXED_DATE_EVENTS: FixedDateEventDef[] = [
  {
    name: "New Year's Day",
    month: 0,
    dayOfMonth: 1,
    category: 'Cultural Festival',
    region: 'National',
    description: 'Beginning of the Gregorian calendar year celebrations.',
  },
  {
    name: 'Bhogi Festival',
    month: 0,
    dayOfMonth: 13,
    category: 'Traditional Festival',
    region: 'Telangana & National',
    description: 'First day of the four-day harvest festival celebration.',
  },
  {
    name: 'Makara Sankranti / Pongal',
    month: 0,
    dayOfMonth: 14,
    category: 'Cultural Festival',
    region: 'Telangana & National',
    description: 'Harvest and solar festival celebrated with kites and traditions.',
  },
  {
    name: 'Kanuma Festival',
    month: 0,
    dayOfMonth: 15,
    category: 'Traditional Festival',
    region: 'Telangana',
    description: 'Agricultural festival honoring livestock and cattle in Telangana.',
  },
  {
    name: 'Netaji Subhash Chandra Bose Jayanti',
    month: 0,
    dayOfMonth: 23,
    category: 'Observance',
    region: 'National',
    description: 'National commemoration of Netaji Subhash Chandra Bose (Parakram Diwas).',
  },
  {
    name: 'Republic Day Celebration',
    month: 0,
    dayOfMonth: 26,
    category: 'Observance',
    region: 'National',
    description: 'National celebration marking the adoption of the Indian Constitution.',
  },
  {
    name: 'Babu Jagjivan Ram Jayanti',
    month: 3,
    dayOfMonth: 5,
    category: 'Observance',
    region: 'Telangana & National',
    description: 'Commemoration of the freedom fighter and social reformer.',
  },
  {
    name: 'Dr. B.R. Ambedkar Jayanti',
    month: 3,
    dayOfMonth: 14,
    category: 'Observance',
    region: 'Telangana & National',
    description: 'Commemoration of the architect of the Indian Constitution.',
  },
  {
    name: 'Telangana Formation Day',
    month: 5,
    dayOfMonth: 2,
    category: 'State Celebration',
    region: 'Telangana',
    description: 'Commemoration of the formation of Telangana State (2 June 2014).',
  },
  {
    name: 'International Day of Yoga',
    month: 5,
    dayOfMonth: 21,
    category: 'Observance',
    region: 'Global Observance',
    description: 'Celebration of mindfulness, wellness, and holistic health.',
  },
  {
    name: 'Independence Day Celebration',
    month: 7,
    dayOfMonth: 15,
    category: 'Observance',
    region: 'National',
    description: 'Celebration of Indian Independence with flag hoisting ceremonies.',
  },
  {
    name: 'Telangana National Integration Day',
    month: 8,
    dayOfMonth: 17,
    category: 'State Celebration',
    region: 'Telangana',
    description: 'Telangana state commemoration of accession to the Indian Union.',
  },
  {
    name: 'Mahatma Gandhi Jayanti',
    month: 9,
    dayOfMonth: 2,
    category: 'Observance',
    region: 'National',
    description: 'Birth anniversary celebration of the Father of the Nation.',
  },
  {
    name: 'National Mathematics Day',
    month: 11,
    dayOfMonth: 22,
    category: 'Observance',
    region: 'National',
    description: 'Birth anniversary commemoration of Srinivasa Ramanujan.',
  },
  {
    name: 'Christmas Eve',
    month: 11,
    dayOfMonth: 24,
    category: 'Cultural Festival',
    region: 'National',
    description: 'Evening festivities preceding Christmas celebrations.',
  },
  {
    name: 'Christmas Day',
    month: 11,
    dayOfMonth: 25,
    category: 'Cultural Festival',
    region: 'National',
    description: 'Celebration of the birth of Jesus Christ with carols and feasts.',
  },
  {
    name: "New Year's Eve",
    month: 11,
    dayOfMonth: 31,
    category: 'Cultural Festival',
    region: 'National',
    description: 'Gatherings and countdown welcoming the coming year.',
  },
];

/**
 * Lunar and astronomical variable festival calendar entries.
 * Mapped accurately for years 2025, 2026, 2027, 2028.
 */
interface VariableFestivalEntry {
  year: number;
  month: number; // 0-indexed
  dayOfMonth: number;
  name: string;
  category: FestivalEvent['category'];
  region: FestivalEvent['region'];
  description: string;
}

const VARIABLE_FESTIVALS: VariableFestivalEntry[] = [
  // ==================== 2025 ====================
  { year: 2025, month: 1, dayOfMonth: 2, name: 'Vasant Panchami / Saraswati Puja', category: 'Cultural Festival', region: 'Telangana & National', description: 'Celebration honoring Saraswati, goddess of learning and arts.' },
  { year: 2025, month: 1, dayOfMonth: 26, name: 'Maha Shivaratri', category: 'Traditional Festival', region: 'Telangana & National', description: 'Night of Shiva prayers, fasts, and temple celebrations.' },
  { year: 2025, month: 2, dayOfMonth: 14, name: 'Holi (Festival of Colors)', category: 'Cultural Festival', region: 'Telangana & National', description: 'Vibrant spring festival celebrated with colors and music.' },
  { year: 2025, month: 2, dayOfMonth: 30, name: 'Ugadi (Telugu New Year)', category: 'Traditional Festival', region: 'Telangana', description: 'Traditional Telugu new year celebrated with Ugadi Pachadi.' },
  { year: 2025, month: 2, dayOfMonth: 31, name: 'Eid ul-Fitr (Ramzan)', category: 'Cultural Festival', region: 'Telangana & National', description: 'Celebration concluding the holy month of fasting.' },
  { year: 2025, month: 3, dayOfMonth: 6, name: 'Sri Rama Navami', category: 'Traditional Festival', region: 'Telangana & National', description: 'Celebration of Rama with Sitarama Kalyanam in Bhadrachalam.' },
  { year: 2025, month: 4, dayOfMonth: 12, name: 'Buddha Purnima', category: 'Cultural Festival', region: 'National', description: 'Commemoration of the birth and enlightenment of Gautama Buddha.' },
  { year: 2025, month: 5, dayOfMonth: 7, name: 'Eid ul-Adha (Bakrid)', category: 'Cultural Festival', region: 'Telangana & National', description: 'Feast of the Sacrifice celebrated with prayers and charity.' },
  { year: 2025, month: 6, dayOfMonth: 6, name: 'Muharram (Ashura)', category: 'Observance', region: 'Telangana & National', description: 'Solemn observance and commemoration with Bibi Ka Alam in Hyderabad.' },
  { year: 2025, month: 6, dayOfMonth: 13, name: 'Telangana Bonalu Festival (Golconda Bonalu)', category: 'State Celebration', region: 'Telangana', description: 'Celebrated in honor of Goddess Mahakali across Telangana.' },
  { year: 2025, month: 6, dayOfMonth: 20, name: 'Secunderabad Ujjaini Mahakali Bonalu', category: 'State Celebration', region: 'Telangana', description: 'Grand Lashkar Bonalu with Rangam and pot offerings.' },
  { year: 2025, month: 7, dayOfMonth: 9, name: 'Raksha Bandhan', category: 'Cultural Festival', region: 'Telangana & National', description: 'Celebration of bond between brothers and sisters.' },
  { year: 2025, month: 7, dayOfMonth: 16, name: 'Sri Krishna Janmashtami', category: 'Traditional Festival', region: 'Telangana & National', description: 'Celebration of Krishna birth with Dahi Handi and midnight pujas.' },
  { year: 2025, month: 7, dayOfMonth: 27, name: 'Ganesh Chaturthi (Vinayaka Chavithi)', category: 'Cultural Festival', region: 'Telangana & National', description: '10-day grand festival in Hyderabad with majestic Ganesha idols.' },
  { year: 2025, month: 8, dayOfMonth: 5, name: 'Milad-un-Nabi (Eid-e-Milad)', category: 'Cultural Festival', region: 'Telangana & National', description: 'Birth anniversary celebrations of Prophet Muhammad.' },
  { year: 2025, month: 8, dayOfMonth: 21, name: 'Engili Pula Bathukamma', category: 'State Celebration', region: 'Telangana', description: 'Beginning of the 9-day floral festival celebrated by women of Telangana.' },
  { year: 2025, month: 8, dayOfMonth: 29, name: 'Saddula Bathukamma & Durga Ashtami', category: 'State Celebration', region: 'Telangana', description: 'Grand finale of Bathukamma with circular flower arrangements immersed in lakes.' },
  { year: 2025, month: 9, dayOfMonth: 2, name: 'Vijaya Dashami (Dussehra)', category: 'Cultural Festival', region: 'Telangana & National', description: 'Celebration of victory of good over evil with Jammi tree prayers in Telangana.' },
  { year: 2025, month: 9, dayOfMonth: 20, name: 'Deepavali (Diwali - Festival of Lights)', category: 'Cultural Festival', region: 'Telangana & National', description: 'Celebration with clay diyas, fireworks, and Lakshmi puja.' },
  { year: 2025, month: 10, dayOfMonth: 5, name: 'Guru Nanak Jayanti / Karthika Purnima', category: 'Cultural Festival', region: 'Telangana & National', description: 'Celebration of Guru Nanak and Karthika Deepotsavam in temples.' },

  // ==================== 2026 (CURRENT SIMULATION YEAR) ====================
  { year: 2026, month: 1, dayOfMonth: 15, name: 'Maha Shivaratri', category: 'Traditional Festival', region: 'Telangana & National', description: 'Night of Shiva prayers, fasts, and temple celebrations.' },
  { year: 2026, month: 2, dayOfMonth: 3, name: 'Holi (Festival of Colors)', category: 'Cultural Festival', region: 'Telangana & National', description: 'Vibrant spring festival celebrated with colors and music.' },
  { year: 2026, month: 2, dayOfMonth: 19, name: 'Ugadi (Telugu New Year)', category: 'Traditional Festival', region: 'Telangana', description: 'Traditional Telugu new year celebrated with Ugadi Pachadi.' },
  { year: 2026, month: 2, dayOfMonth: 20, name: 'Eid ul-Fitr (Ramzan)', category: 'Cultural Festival', region: 'Telangana & National', description: 'Celebration concluding the holy month of fasting.' },
  { year: 2026, month: 2, dayOfMonth: 27, name: 'Sri Rama Navami', category: 'Traditional Festival', region: 'Telangana & National', description: 'Celebration of Rama with Sitarama Kalyanam in Bhadrachalam.' },
  { year: 2026, month: 3, dayOfMonth: 1, name: 'Mahavir Jayanti', category: 'Observance', region: 'National', description: 'Commemoration of the birth of Lord Mahavira, founder of Jainism.' },
  { year: 2026, month: 4, dayOfMonth: 1, name: 'Buddha Purnima', category: 'Cultural Festival', region: 'National', description: 'Commemoration of the birth and enlightenment of Gautama Buddha.' },
  { year: 2026, month: 4, dayOfMonth: 27, name: 'Eid ul-Adha (Bakrid)', category: 'Cultural Festival', region: 'Telangana & National', description: 'Feast of the Sacrifice celebrated with prayers and charity.' },
  { year: 2026, month: 5, dayOfMonth: 26, name: 'Muharram (Ashura)', category: 'Observance', region: 'Telangana & National', description: 'Solemn observance and commemoration with Bibi Ka Alam in Hyderabad.' },
  { year: 2026, month: 6, dayOfMonth: 12, name: 'Telangana Bonalu Festival (Golconda Bonalu)', category: 'State Celebration', region: 'Telangana', description: 'Celebrated in honor of Goddess Mahakali across Telangana.' },
  { year: 2026, month: 6, dayOfMonth: 19, name: 'Secunderabad Ujjaini Mahakali Bonalu', category: 'State Celebration', region: 'Telangana', description: 'Grand Lashkar Bonalu with Rangam and pot offerings.' },
  { year: 2026, month: 6, dayOfMonth: 29, name: 'Guru Purnima', category: 'Cultural Festival', region: 'National', description: 'Day dedicated to honoring spiritual and academic teachers.' },
  { year: 2026, month: 7, dayOfMonth: 21, name: 'Varalakshmi Vratam', category: 'Traditional Festival', region: 'Telangana', description: 'Auspicious observance by women in Telangana for family well-being.' },
  { year: 2026, month: 7, dayOfMonth: 28, name: 'Raksha Bandhan', category: 'Cultural Festival', region: 'Telangana & National', description: 'Celebration of bond between brothers and sisters.' },
  { year: 2026, month: 8, dayOfMonth: 4, name: 'Sri Krishna Janmashtami', category: 'Traditional Festival', region: 'Telangana & National', description: 'Celebration of Krishna birth with Dahi Handi and midnight pujas.' },
  { year: 2026, month: 8, dayOfMonth: 14, name: 'Ganesh Chaturthi (Vinayaka Chavithi)', category: 'Cultural Festival', region: 'Telangana & National', description: '10-day grand festival with iconic clay Ganesha idols across Hyderabad.' },
  { year: 2026, month: 8, dayOfMonth: 24, name: 'Milad-un-Nabi (Eid-e-Milad)', category: 'Cultural Festival', region: 'Telangana & National', description: 'Celebration of the birth anniversary of Prophet Muhammad.' },
  { year: 2026, month: 9, dayOfMonth: 11, name: 'Engili Pula Bathukamma (Floral Festival Start)', category: 'State Celebration', region: 'Telangana', description: 'Opening of the 9-day Telangana floral festival celebrated by women.' },
  { year: 2026, month: 9, dayOfMonth: 19, name: 'Saddula Bathukamma (Grand Finale of Bathukamma)', category: 'State Celebration', region: 'Telangana', description: 'Culmination of Bathukamma with colorful flower towers immersed in water.' },
  { year: 2026, month: 9, dayOfMonth: 20, name: 'Vijaya Dashami (Dussehra)', category: 'Cultural Festival', region: 'Telangana & National', description: 'Grand victory celebration with Jammi leaf exchanges in Telangana.' },
  { year: 2026, month: 10, dayOfMonth: 6, name: 'Dhanteras', category: 'Cultural Festival', region: 'Telangana & National', description: 'First day of the Deepavali festival welcoming prosperity.' },
  { year: 2026, month: 10, dayOfMonth: 7, name: 'Naraka Chaturdashi', category: 'Cultural Festival', region: 'Telangana & National', description: 'Early morning oil bath and festivities preceding Diwali.' },
  { year: 2026, month: 10, dayOfMonth: 8, name: 'Deepavali (Diwali - Festival of Lights)', category: 'Cultural Festival', region: 'Telangana & National', description: 'Celebration of lights with clay diyas, sweets, and Lakshmi puja.' },
  { year: 2026, month: 10, dayOfMonth: 24, name: 'Guru Nanak Jayanti / Karthika Purnima', category: 'Cultural Festival', region: 'Telangana & National', description: 'Commemoration of Guru Nanak and lighting of temple lamps in Karthika Masam.' },

  // ==================== 2027 ====================
  { year: 2027, month: 1, dayOfMonth: 6, name: 'Maha Shivaratri', category: 'Traditional Festival', region: 'Telangana & National', description: 'Night of Shiva prayers, fasts, and temple celebrations.' },
  { year: 2027, month: 2, dayOfMonth: 10, name: 'Eid ul-Fitr (Ramzan)', category: 'Cultural Festival', region: 'Telangana & National', description: 'Celebration concluding the holy month of fasting.' },
  { year: 2027, month: 2, dayOfMonth: 22, name: 'Holi (Festival of Colors)', category: 'Cultural Festival', region: 'Telangana & National', description: 'Vibrant spring festival celebrated with colors and music.' },
  { year: 2027, month: 3, dayOfMonth: 7, name: 'Ugadi (Telugu New Year)', category: 'Traditional Festival', region: 'Telangana', description: 'Traditional Telugu new year celebrated with Ugadi Pachadi.' },
  { year: 2027, month: 3, dayOfMonth: 15, name: 'Sri Rama Navami', category: 'Traditional Festival', region: 'Telangana & National', description: 'Celebration of Rama with Sitarama Kalyanam in Bhadrachalam.' },
  { year: 2027, month: 4, dayOfMonth: 17, name: 'Eid ul-Adha (Bakrid)', category: 'Cultural Festival', region: 'Telangana & National', description: 'Feast of the Sacrifice celebrated with prayers and charity.' },
  { year: 2027, month: 4, dayOfMonth: 20, name: 'Buddha Purnima', category: 'Cultural Festival', region: 'National', description: 'Commemoration of the birth and enlightenment of Gautama Buddha.' },
  { year: 2027, month: 5, dayOfMonth: 16, name: 'Muharram (Ashura)', category: 'Observance', region: 'Telangana & National', description: 'Solemn observance and commemoration with Bibi Ka Alam in Hyderabad.' },
  { year: 2027, month: 6, dayOfMonth: 18, name: 'Telangana Bonalu Festival', category: 'State Celebration', region: 'Telangana', description: 'Celebrated in honor of Goddess Mahakali across Telangana.' },
  { year: 2027, month: 7, dayOfMonth: 17, name: 'Raksha Bandhan', category: 'Cultural Festival', region: 'Telangana & National', description: 'Celebration of bond between brothers and sisters.' },
  { year: 2027, month: 7, dayOfMonth: 25, name: 'Sri Krishna Janmashtami', category: 'Traditional Festival', region: 'Telangana & National', description: 'Celebration of Krishna birth with Dahi Handi and midnight pujas.' },
  { year: 2027, month: 8, dayOfMonth: 4, name: 'Ganesh Chaturthi (Vinayaka Chavithi)', category: 'Cultural Festival', region: 'Telangana & National', description: '10-day grand festival with iconic clay Ganesha idols across Hyderabad.' },
  { year: 2027, month: 8, dayOfMonth: 30, name: 'Engili Pula Bathukamma', category: 'State Celebration', region: 'Telangana', description: 'Beginning of the 9-day Telangana floral festival celebrated by women.' },
  { year: 2027, month: 9, dayOfMonth: 8, name: 'Saddula Bathukamma & Durga Ashtami', category: 'State Celebration', region: 'Telangana', description: 'Grand finale of Bathukamma with circular flower arrangements immersed in lakes.' },
  { year: 2027, month: 9, dayOfMonth: 10, name: 'Vijaya Dashami (Dussehra)', category: 'Cultural Festival', region: 'Telangana & National', description: 'Grand victory celebration with Jammi leaf exchanges in Telangana.' },
  { year: 2027, month: 9, dayOfMonth: 29, name: 'Deepavali (Diwali - Festival of Lights)', category: 'Cultural Festival', region: 'Telangana & National', description: 'Celebration of lights with clay diyas, sweets, and Lakshmi puja.' },
  { year: 2027, month: 10, dayOfMonth: 14, name: 'Guru Nanak Jayanti / Karthika Purnima', category: 'Cultural Festival', region: 'Telangana & National', description: 'Commemoration of Guru Nanak and lighting of temple lamps in Karthika Masam.' },
];

/**
 * Returns the sorted list of festivals and cultural events for a given year and month.
 * 
 * @param year e.g. 2026
 * @param month 0-indexed month (0 = Jan, 8 = Sep, 9 = Oct, etc.)
 */
export function getFestivalsForMonth(year: number, month: number): FestivalEvent[] {
  const events: FestivalEvent[] = [];

  // 1. Add fixed-date events for this month
  for (const f of FIXED_DATE_EVENTS) {
    if (f.month === month) {
      events.push({
        id: `fixed-${year}-${month}-${f.dayOfMonth}`,
        name: f.name,
        dayOfMonth: f.dayOfMonth,
        month,
        year,
        category: f.category,
        region: f.region,
        description: f.description,
      });
    }
  }

  // 2. Add variable events for this specific year and month
  for (const v of VARIABLE_FESTIVALS) {
    if (v.year === year && v.month === month) {
      events.push({
        id: `var-${year}-${month}-${v.dayOfMonth}-${v.name.slice(0, 5)}`,
        name: v.name,
        dayOfMonth: v.dayOfMonth,
        month,
        year,
        category: v.category,
        region: v.region,
        description: v.description,
      });
    }
  }

  // 3. Sort ascending by day of the month
  events.sort((a, b) => a.dayOfMonth - b.dayOfMonth);

  return events;
}

/**
 * Formats the day with weekday name, e.g. "Monday, 14 September 2026"
 */
export function formatEventDate(year: number, month: number, day: number): string {
  try {
    const d = new Date(year, month, day);
    return d.toLocaleDateString('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
  } catch {
    return `${day}`;
  }
}
