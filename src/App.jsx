import { useMemo, useState } from 'react';
import {
  classificationCounts,
  departmentCounts,
  floorRooms,
  floorSections,
  galleryArtworks,
  summaryStats,
  timelineArtworks,
} from './mockData.js';

const tabs = [
  ['summary', 'collection summary'],
  ['timeline', 'timeline viewer'],
  ['map', 'gallery map'],
];

function Header({ activeTab, onTabChange }) {
  return (
    <header className="site-header">
      <nav className="met-nav">
        <button className="brand" onClick={() => onTabChange('summary')}>
          <span>inside</span><strong>THE<br />MET</strong>
        </button>
        <div className="tab-row">
          {tabs.map(([id, label]) => (
            <button key={id} className={activeTab === id ? 'tab active' : 'tab'} onClick={() => onTabChange(id)}>
              {label}
            </button>
          ))}
        </div>
        <label className="search-box">
          <input placeholder="Search artworks, artists..." />
          <span>⌕</span>
        </label>
      </nav>
    </header>
  );
}

function PageTitle({ title, subtitle }) {
  return (
    <div className="page-title">
      <h1>{title}</h1>
      <p>{subtitle}</p>
    </div>
  );
}

function MetricCard({ icon, value, label, note }) {
  return (
    <article className="metric-card">
      <div className="metric-icon">{icon}</div>
      <div>
        <strong>{value.toLocaleString()}</strong>
        <h3>{label}</h3>
        <p>{note}</p>
      </div>
    </article>
  );
}

function ChartPanel({ title, children, footer }) {
  return (
    <section className="chart-panel">
      <div className="panel-head">
        <h2>{title}</h2>
        <span>ⓘ</span>
      </div>
      {children}
      {footer && <div className="panel-footer">{footer}</div>}
    </section>
  );
}

function BarChart({ data }) {
  const max = Math.max(...data.map((d) => d[1]));
  const width = 560;
  const height = 300;
  const left = 52;
  const bottom = 48;
  const barW = 30;
  const gap = (width - left - 26 - data.length * barW) / (data.length - 1);
  return (
    <svg className="chart-svg" viewBox={`0 0 ${width} ${height}`}>
      {[0, 50, 100, 150, 200, 250].map((tick) => {
        const y = height - bottom - (tick / 260) * 205;
        return <g key={tick}><line x1={left} x2={width - 16} y1={y} y2={y} /><text x={left - 12} y={y + 4}>{tick}</text></g>;
      })}
      {data.map(([name, value], i) => {
        const x = left + i * (barW + gap);
        const h = (value / max) * 205;
        return (
          <g key={name}>
            <rect className="hot-bar" x={x} y={height - bottom - h} width={barW} height={h} rx="2" />
            <text className="bar-value" x={x + barW / 2} y={height - bottom - h - 8}>{value}</text>
            <text className="x-label" x={x + barW / 2} y={height - 32}>{name}</text>
          </g>
        );
      })}
    </svg>
  );
}

function DonutChart({ data }) {
  const total = data.reduce((sum, d) => sum + d[1], 0);
  let offset = 0;
  const colors = ['#f3002f', '#ff445d', '#c43a4d', '#ef7885', '#ad2638', '#5d1d27'];
  const slices = data.map(([name, value], i) => {
    const start = offset;
    const pct = value / total;
    offset += pct;
    return { name, value, pct, color: colors[i], dash: `${pct * 100} ${100 - pct * 100}`, start };
  });
  return (
    <div className="donut-wrap">
      <svg className="donut" viewBox="0 0 220 220">
        <circle cx="110" cy="110" r="72" fill="transparent" stroke="#241820" strokeWidth="42" />
        {slices.map((s) => (
          <circle key={s.name} cx="110" cy="110" r="72" fill="transparent" stroke={s.color} strokeWidth="42"
            strokeDasharray={s.dash} strokeDashoffset={25 - s.start * 100} pathLength="100" />
        ))}
        <circle cx="110" cy="110" r="46" fill="#0b1720" />
        <text x="110" y="106" textAnchor="middle" className="donut-total">1,013</text>
        <text x="110" y="127" textAnchor="middle" className="donut-label">Works</text>
      </svg>
      <ul className="legend">
        {slices.map((s) => <li key={s.name}><span style={{ background: s.color }} />{s.name}<em>{s.value} ({Math.round(s.pct * 1000) / 10}%)</em></li>)}
      </ul>
    </div>
  );
}

function Histogram({ data }) {
  const max = Math.max(...data.map((d) => d[1]));
  return (
    <svg className="chart-svg" viewBox="0 0 520 300">
      {[0, 100, 200, 300].map((tick) => {
        const y = 240 - (tick / 360) * 200;
        return <g key={tick}><line x1="48" x2="496" y1={y} y2={y} /><text x="32" y={y + 4}>{tick}</text></g>;
      })}
      {data.map(([year, value], i) => {
        const x = 54 + i * 31;
        const h = (value / max) * 200;
        return <rect key={year} className="hot-bar" x={x} y={240 - h} width="23" height={h} rx="1" />;
      })}
      {[-4000, -3000, -2000, -1000, 0, 1000, 2000].map((tick) => (
        <text key={tick} className="x-label" x={54 + ((tick + 4000) / 6000) * 440} y="270">{tick}</text>
      ))}
      <text className="axis-title" x="260" y="292">End Date (Year)</text>
    </svg>
  );
}

function MiniDepartmentBars() {
  const max = Math.max(...departmentCounts.slice(0, 5).map((d) => d[1]));
  return (
    <div className="mini-bars">
      {departmentCounts.slice(0, 5).map(([label, value]) => (
        <div className="mini-bar-row" key={label}>
          <span>{label}</span>
          <div><i style={{ width: `${(value / max) * 100}%` }} /></div>
          <em>{value}</em>
        </div>
      ))}
    </div>
  );
}

function SummaryMapPreview({ onOpenMap }) {
  const handleKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onOpenMap();
    }
  };

  return (
    <section className="summary-map-panel" role="button" tabIndex="0" onClick={onOpenMap} onKeyDown={handleKeyDown}>
      <div className="panel-head">
        <h2>Met-Inspired Gallery Sections</h2>
        <span>Open gallery map</span>
      </div>
      <FloorOverviewMap selected={null} onSelect={onOpenMap} />
    </section>
  );
}

function CollectionSummary({ onOpenMap }) {
  return (
    <main className="dashboard">
      <PageTitle title="Collection Overview of Highlighted Public Domain Works" subtitle="Explore The Met collection through key metrics, time periods, and classifications." />
      <section className="summary-redesign">
        <SummaryMapPreview onOpenMap={onOpenMap} />
        <aside className="summary-overview">
          <div className="overview-metrics">
            <MetricCard icon="▧" value={summaryStats.totalArtworks} label="Total Artworks" note="Highlighted works in this dataset" />
            <MetricCard icon="▥" value={summaryStats.publicDomainWorks} label="Public Domain Works" note="Ready for public collection viewing" />
            <MetricCard icon="▦" value={summaryStats.departments} label="Departments" note="Curatorial areas represented" />
            <MetricCard icon="◇" value={summaryStats.classifications} label="Classification Groups" note="Object category groups" />
          </div>
          <ChartPanel title="Top Departments"><MiniDepartmentBars /></ChartPanel>
          <ChartPanel title="Classification Mix" footer={<><span>Total</span><span>{summaryStats.totalArtworks.toLocaleString()}</span></>}><DonutChart data={classificationCounts} /></ChartPanel>
        </aside>
      </section>
    </main>
  );
}

function RangeSlider({ range, setRange }) {
  const [min, max] = range;
  const clamp = (value, side) => {
    const next = Number(value);
    if (side === 'min') setRange([Math.min(next, max - 100), max]);
    else setRange([min, Math.max(next, min + 100)]);
  };
  return (
    <div className="range-control">
      <div><span>{min < 0 ? `${Math.abs(min)} BC` : `AD ${min}`}</span><span>{max < 0 ? `${Math.abs(max)} BC` : `AD ${max}`}</span></div>
      <div className="dual-range">
        <input type="range" min="-5000" max="2000" step="50" value={min} onChange={(e) => clamp(e.target.value, 'min')} />
        <input type="range" min="-5000" max="2000" step="50" value={max} onChange={(e) => clamp(e.target.value, 'max')} />
      </div>
    </div>
  );
}

function ScatterPlot({ works, groupBy, range, onHover, selected }) {
  const [minYear, maxYear] = range;
  const categoryCounts = works.reduce((acc, work) => {
    const category = work[groupBy] || 'Unknown';
    acc.set(category, (acc.get(category) || 0) + 1);
    return acc;
  }, new Map());
  const topCategories = [...categoryCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 9).map(([name]) => name);
  const hasOther = works.some((work) => !topCategories.includes(work[groupBy] || 'Unknown'));
  const categories = hasOther ? topCategories.concat('Other') : topCategories;
  const plot = { left: 190, right: 1760, top: 34, bottom: 458 };
  const plotWidth = plot.right - plot.left;
  const plotHeight = plot.bottom - plot.top;
  const plotCategory = (work) => {
    const category = work[groupBy] || 'Unknown';
    return categories.includes(category) ? category : 'Other';
  };
  const ticks = Array.from({ length: 8 }, (_, i) => Math.round(minYear + ((maxYear - minYear) / 7) * i));
  const x = (year) => plot.left + ((year - minYear) / (maxYear - minYear)) * plotWidth;
  const y = (cat) => plot.top + categories.indexOf(cat) * (plotHeight / Math.max(1, categories.length - 1));
  const formatYear = (year) => (year < 0 ? `${Math.abs(year)}` : `${year}`);

  return (
    <svg className="scatter-svg" viewBox="0 0 1800 530">
      {ticks.map((tick) => {
        const gx = x(tick);
        return <g key={tick}><line x1={gx} x2={gx} y1={plot.top} y2={plot.bottom} /><text x={gx} y="496">{formatYear(tick)}</text></g>;
      })}
      {categories.map((cat) => <g key={cat}><line x1={plot.left} x2={plot.right} y1={y(cat)} y2={y(cat)} /><text x="174" y={y(cat) + 4}>{cat}</text></g>)}
      <text className="axis-title" x="975" y="524">Object End Date</text>
      {works.map((work, i) => (
        <circle key={work.id} className={selected?.id === work.id ? 'point selected' : 'point'} cx={x(work.year)} cy={y(plotCategory(work))}
          r={selected?.id === work.id ? 8 : 5.5} fill={['#ff0033', '#42e8ff', '#ffbd45', '#ff63d8', '#77ff8a'][i % 5]}
          onMouseEnter={() => onHover(work)} onFocus={() => onHover(work)} tabIndex="0" />
      ))}
    </svg>
  );
}

function ArtworkDetailCard({ artwork, onClose }) {
  return (
    <aside className="detail-card">
      <button className="close" onClick={onClose}>×</button>
      <img src={artwork.image} alt="" />
      <h2>{artwork.title}</h2>
      <p className="muted">{artwork.artist}</p>
      <dl>
        <dt>Date</dt><dd>{artwork.date}</dd>
        <dt>Medium</dt><dd>{artwork.medium}</dd>
      </dl>
      <p>{artwork.description}</p>
      <a href={artwork.link} target="_blank" rel="noreferrer">View on The Met Website</a>
    </aside>
  );
}

function TimelineViewer() {
  const [range, setRange] = useState([-5000, 2000]);
  const [groupBy, setGroupBy] = useState('department');
  const [hovered, setHovered] = useState(null);
  const filtered = useMemo(() => timelineArtworks.filter((work) => work.year >= range[0] && work.year <= range[1]), [range]);
  const activeHover = hovered && filtered.some((work) => work.id === hovered.id) ? hovered : null;

  return (
    <main className="dashboard">
      <PageTitle title="Timeline Viewer" subtitle="Explore The Met collection across time." />
      <section className="timeline-controls">
        <RangeSlider range={range} setRange={setRange} />
        <div className="filter-buttons">
          {['department', 'classification', 'culture'].map((filter) => (
            <button key={filter} className={groupBy === filter ? 'active' : ''} onClick={() => setGroupBy(filter)}>{filter}</button>
          ))}
        </div>
      </section>
      <section className={activeHover ? 'timeline-layout has-detail' : 'timeline-layout'}>
        <ChartPanel title={`${groupBy} timeline`}><ScatterPlot works={filtered} groupBy={groupBy} range={range} onHover={setHovered} selected={activeHover} /></ChartPanel>
        {activeHover && <ArtworkDetailCard artwork={activeHover} onClose={() => setHovered(null)} />}
      </section>
    </main>
  );
}

function FloorOverviewMap({ selected, onSelect }) {
  return (
    <svg className="map-svg floor-overview" viewBox="0 0 1240 540">
      <path className="building-outline" d="M66 386H112V184h48V38h930v150h54v180h-54v134H66Z" />
      <path className="floor-spine" d="M406 276H452M696 270H724M992 276H1014M574 218V180M574 322V362M858 210V180M858 340V360" />
      <rect className="great-hall" x="470" y="224" width="208" height="88" rx="4" />
      <text className="hall-label" x="574" y="269">Great Hall</text>
      <text className="facade-label" x="574" y="526">Fifth Avenue Entrance</text>
      {floorSections.map((section) => (
        <g key={section.id} onClick={() => onSelect(section.id)} className={selected === section.id ? 'map-room active' : 'map-room'}>
          <rect x={section.x} y={section.y} width={section.w} height={section.h} rx="3" />
          <text x={section.x + section.w / 2} y={section.y + section.h / 2 - 10}>{section.label}</text>
          <text className="room-subtitle" x={section.x + section.w / 2} y={section.y + section.h / 2 + 16}>{section.subtitle}</text>
        </g>
      ))}
    </svg>
  );
}

function FloorDetailMap({ floor, selectedRoom, onRoomSelect }) {
  const rooms = floorRooms[floor] || [];
  return (
    <svg className="map-svg detail" viewBox="0 0 650 460">
      {rooms.map((room, i) => {
        const col = i % 4;
        const row = Math.floor(i / 4);
        const x = 32 + col * 150;
        const y = 34 + row * 88;
        const count = galleryArtworks[room]?.length || 0;
        return (
          <g key={room} onClick={() => onRoomSelect(room)} className={selectedRoom === room ? 'map-room active' : 'map-room'}>
            <rect x={x} y={y} width="122" height="66" rx="3" />
            <text x={x + 61} y={y + 31}>{room}</text>
            <text className="room-subtitle" x={x + 61} y={y + 50}>{count} works</text>
          </g>
        );
      })}
    </svg>
  );
}

function ArtworkListItem({ artwork }) {
  return (
    <article className="art-list-item">
      <img src={artwork.image} alt="" />
      <div>
        <h3>{artwork.title}</h3>
        <p>{artwork.culture}</p>
        <span>{artwork.date}</span>
        <small>{artwork.medium}</small>
        <small>{artwork.accession}</small>
        <a href={artwork.link} target="_blank" rel="noreferrer">View on The Met Website</a>
      </div>
    </article>
  );
}

function ArtworkList({ room }) {
  const works = galleryArtworks[room] || timelineArtworks.slice(0, 4);
  return (
    <section className="art-list">
      <div className="panel-head"><h2>Room {room}</h2><span>{works.length} works</span></div>
      {works.map((work) => <ArtworkListItem key={work.id} artwork={work} />)}
    </section>
  );
}

function GalleryMap() {
  const [floor, setFloor] = useState(null);
  const [room, setRoom] = useState(null);
  const chooseFloor = (id) => {
    setFloor(id);
    setRoom(null);
  };
  const selectedFloor = floorSections.find((section) => section.id === floor);

  return (
    <main className="dashboard">
      <PageTitle title="Gallery Map" subtitle="Explore a Met-inspired floor plan schematic, then inspect CSV gallery rooms and artworks." />
      <section className={['gallery-layout', floor ? 'has-rooms' : '', room ? 'has-list' : ''].filter(Boolean).join(' ')}>
        <ChartPanel title="Met-Inspired Gallery Sections"><FloorOverviewMap selected={floor} onSelect={chooseFloor} /></ChartPanel>
        {floor && (
          <ChartPanel title={`${selectedFloor?.label} Rooms`}>
            <FloorDetailMap floor={floor} selectedRoom={room} onRoomSelect={setRoom} />
          </ChartPanel>
        )}
        {room && <ArtworkList room={room} />}
      </section>
    </main>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState('summary');
  return (
    <div className="app-shell">
      <Header activeTab={activeTab} onTabChange={setActiveTab} />
      {activeTab === 'summary' && <CollectionSummary onOpenMap={() => setActiveTab('map')} />}
      {activeTab === 'timeline' && <TimelineViewer />}
      {activeTab === 'map' && <GalleryMap />}
    </div>
  );
}
