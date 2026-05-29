import csvText from '../MetObjects_highlights_publicdomain.csv?raw';

const palette = [
  ['#3d1116', '#e4002b', '#f7c6cb'],
  ['#071d2c', '#335d7a', '#c9e4ef'],
  ['#1c1712', '#7c4a2d', '#edc38d'],
  ['#14151d', '#5851a6', '#e6d7ff'],
  ['#10261c', '#39745a', '#bdf2d2'],
];

const parseCsv = (text) => {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"' && quoted && next === '"') {
      cell += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      row.push(cell);
      cell = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') i += 1;
      row.push(cell);
      if (row.some((value) => value !== '')) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }

  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }

  const [headers, ...body] = rows;
  return body.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] || ''])));
};

const normalize = (value, fallback = 'Unknown') => {
  const clean = String(value || '').trim();
  return clean || fallback;
};

const shortDepartment = (department) => normalize(department).replace(/^The /, '');

const countTop = (rows, accessor, limit, includeOthers = false) => {
  const counts = new Map();
  rows.forEach((row) => {
    const key = accessor(row);
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  if (!includeOthers || sorted.length <= limit) return sorted.slice(0, limit);
  const top = sorted.slice(0, limit - 1);
  const other = sorted.slice(limit - 1).reduce((sum, [, value]) => sum + value, 0);
  return top.concat([['Others', other]]);
};

const artImage = (title, colors) => {
  const [a, b, c] = colors;
  const label = title.split(' ').slice(0, 3).join(' ');
  return `data:image/svg+xml;utf8,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 300">
      <defs>
        <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stop-color="${a}"/>
          <stop offset="0.54" stop-color="${b}"/>
          <stop offset="1" stop-color="${c}"/>
        </linearGradient>
        <filter id="noise"><feTurbulence baseFrequency=".9" numOctaves="3" seed="7"/><feColorMatrix type="saturate" values=".15"/><feBlend mode="multiply" in2="SourceGraphic"/></filter>
      </defs>
      <rect width="420" height="300" fill="#0c1015"/>
      <rect x="24" y="22" width="372" height="256" rx="5" fill="url(#g)" filter="url(#noise)"/>
      <path d="M46 224 C120 116 162 250 226 123 S322 90 374 196" fill="none" stroke="rgba(255,255,255,.42)" stroke-width="11"/>
      <circle cx="114" cy="92" r="42" fill="rgba(255,255,255,.2)"/>
      <rect x="64" y="238" width="292" height="1" fill="rgba(255,255,255,.5)"/>
      <text x="210" y="264" text-anchor="middle" fill="white" font-family="Georgia, serif" font-size="18">${label}</text>
    </svg>
  `)}`;
};

const toArtwork = (row, index) => {
  const year = Number(row['Object End Date']);
  const title = normalize(row.Title || row['Object Name'], 'Untitled work');
  const artist = normalize(row['Artist Display Name'], 'Unknown artist');
  const classification = normalize(row.Classification, 'Unclassified');

  return {
    id: row['Object ID'] || `${row['Object Number']}-${index}`,
    objectNumber: normalize(row['Object Number'], 'No accession number'),
    title,
    artist,
    year: Number.isFinite(year) ? year : 0,
    department: normalize(row.Department),
    classification,
    culture: normalize(row.Culture),
    medium: normalize(row.Medium, 'Medium not listed'),
    accession: normalize(row['Object Number'], 'No accession number'),
    galleryNumber: normalize(row['Gallery Number'], ''),
    date: normalize(row['Object Date'], Number.isFinite(year) ? String(year) : 'Date unknown'),
    description: `${classification} from ${normalize(row.Department)}. ${normalize(row.Medium, 'Material details are not listed in the dataset')}.`,
    link: normalize(row['Link Resource'], 'https://www.metmuseum.org/art/collection'),
    image: artImage(title, palette[index % palette.length]),
  };
};

export const metRows = parseCsv(csvText);
const publicRows = metRows.filter((row) => normalize(row['Is Public Domain'], 'False') === 'True');
const datedRows = metRows.filter((row) => Number.isFinite(Number(row['Object End Date'])));

export const summaryStats = {
  totalArtworks: metRows.length,
  publicDomainWorks: publicRows.length,
  departments: new Set(metRows.map((row) => normalize(row.Department)).filter((value) => value !== 'Unknown')).size,
  classifications: new Set(metRows.map((row) => normalize(row.Classification, '')).filter(Boolean)).size,
};

export const departmentCounts = countTop(metRows, (row) => shortDepartment(row.Department), 8);

export const classificationCounts = countTop(
  metRows,
  (row) => normalize(row.Classification, 'Unclassified'),
  6,
  true,
);

export const endDateBins = (() => {
  const years = datedRows.map((row) => Number(row['Object End Date']));
  const min = Math.floor(Math.min(...years) / 500) * 500;
  const max = Math.ceil(Math.max(...years) / 500) * 500;
  const bins = [];
  for (let start = min; start < max; start += 500) {
    bins.push([start, years.filter((year) => year >= start && year < start + 500).length]);
  }
  return bins;
})();

export const timelineArtworks = datedRows.map(toArtwork);

export const departments = [
  { id: 'european', label: 'European Painting', match: ['European Paintings', 'European Sculpture and Decorative Arts'], x: 28, y: 38, w: 198, h: 96 },
  { id: 'roman', label: 'Roman Empire', match: ['Greek and Roman Art'], x: 246, y: 38, w: 156, h: 96 },
  { id: 'american', label: 'American Wing', match: ['The American Wing'], x: 422, y: 38, w: 174, h: 96 },
  { id: 'african', label: 'African Culture', match: ['Arts of Africa, Oceania, and the Americas'], x: 28, y: 160, w: 170, h: 132 },
  { id: 'asian', label: 'Asian Culture', match: ['Asian Art'], x: 222, y: 160, w: 166, h: 132 },
  { id: 'egyptian', label: 'Egyptian Culture', match: ['Egyptian Art'], x: 412, y: 160, w: 184, h: 132 },
];

export const departmentRooms = {
  european: ['601', '602', '603', '604', '605', '606'],
  roman: ['150', '151', '152', '153', '154', '155'],
  american: ['704', '706', '708', '736', '746', '750'],
  african: ['350', '351', '352', '353', '354', '355'],
  asian: ['206', '207', '208', '217', '220', '222'],
  egyptian: ['720', '721', '722', '723', '724', '725', '726', '727', '728'],
};

const worksByRoom = timelineArtworks.reduce((acc, work) => {
  if (!work.galleryNumber) return acc;
  if (!acc[work.galleryNumber]) acc[work.galleryNumber] = [];
  acc[work.galleryNumber].push(work);
  return acc;
}, {});

export const galleryArtworks = Object.fromEntries(
  Object.entries(departmentRooms).flatMap(([departmentId, rooms]) => {
    const department = departments.find((item) => item.id === departmentId);
    const fallback = timelineArtworks.filter((work) => department?.match.includes(work.department)).slice(0, 6);
    return rooms.map((room) => [room, (worksByRoom[room] || fallback).slice(0, 8)]);
  }),
);
