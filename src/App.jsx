import { useEffect, useMemo, useRef, useState } from 'react';
import {
  classificationCounts,
  departmentCounts,
  floorPlans,
  floorRooms,
  floorSections,
  galleryArtworks,
  sectionByRoom,
  summaryStats,
  timelineArtworks,
} from './mockData.js';

const tabs = [
  ['summary', 'collection summary'],
  ['timeline', 'timeline viewer'],
  ['map', 'gallery map'],
];

const mediumColors = {
  Painting: '#ef0033',
  Stone: '#42e8ff',
  Metal: '#ffbd45',
  Ceramic: '#ff63d8',
  Wood: '#77ff8a',
  Textile: '#b68cff',
  Paper: '#ff8a4c',
  Glass: '#58a6ff',
  Other: '#aab4ba',
};
const metImageCache = new Map();

function MetArtworkImage({ artwork, alt = '', className = '' }) {
  const fallback = artwork.image;
  const [src, setSrc] = useState(() => metImageCache.get(artwork.id) || fallback);

  useEffect(() => {
    let cancelled = false;
    const cached = metImageCache.get(artwork.id);

    if (cached) {
      setSrc(cached);
      return undefined;
    }

    setSrc(fallback);
    fetch(`https://collectionapi.metmuseum.org/public/collection/v1/objects/${artwork.id}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        const image = data?.primaryImageSmall || data?.primaryImage;
        if (!cancelled && image) {
          metImageCache.set(artwork.id, image);
          setSrc(image);
        }
      })
      .catch(() => {
        if (!cancelled) setSrc(fallback);
      });

    return () => {
      cancelled = true;
    };
  }, [artwork.id, fallback]);

  return <img className={className} src={src} alt={alt} loading="lazy" />;
}

function SearchPopover({ query, results, onQueryChange, onClose, onJumpTimeline, onJumpMap }) {
  return (
    <div className="search-popover">
      {query.trim() ? (
        <>
          <div className="search-summary">{results.length ? `${results.length} matching artworks` : 'No matching artworks'}</div>
          {results.map((artwork) => (
            <article className="search-result" key={artwork.id}>
              <MetArtworkImage artwork={artwork} alt={artwork.title} />
              <div>
                <h3>{artwork.title}</h3>
                <p>{artwork.artist}</p>
                <span>{artwork.department} · {artwork.date}</span>
                <div className="result-actions">
                  <button onClick={() => {
                    onJumpTimeline(artwork);
                    onClose();
                  }}>Timeline</button>
                  <button onClick={() => {
                    onJumpMap(artwork);
                    onClose();
                  }}>Map</button>
                </div>
              </div>
            </article>
          ))}
        </>
      ) : (
        <div className="search-summary">Search by title, artist, culture, department, medium, or accession number.</div>
      )}
    </div>
  );
}

function Header({ activeTab, onTabChange, onJumpTimeline, onJumpMap }) {
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef(null);
  const results = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return [];
    return timelineArtworks
      .filter((artwork) => [
        artwork.title,
        artwork.artist,
        artwork.department,
        artwork.classification,
        artwork.culture,
        artwork.medium,
        artwork.accession,
      ].join(' ').toLowerCase().includes(term))
      .slice(0, 8);
  }, [query]);

  useEffect(() => {
    const closeOnOutsideClick = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setSearchOpen(false);
      }
    };

    document.addEventListener('pointerdown', closeOnOutsideClick);
    return () => document.removeEventListener('pointerdown', closeOnOutsideClick);
  }, []);

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
        <label
          className="search-box"
          ref={searchRef}
          onMouseEnter={() => setSearchOpen(true)}
        >
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onFocus={() => setSearchOpen(true)}
            placeholder="Search artworks, artists..."
          />
          <span>⌕</span>
          {searchOpen && (
            <SearchPopover
              query={query}
              results={results}
              onQueryChange={setQuery}
              onClose={() => setSearchOpen(false)}
              onJumpTimeline={onJumpTimeline}
              onJumpMap={onJumpMap}
            />
          )}
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

function ChartPanel({ title, children, footer, headerExtra }) {
  return (
    <section className="chart-panel">
      <div className="panel-head">
        <h2>{title}</h2>
        {headerExtra || <span>ⓘ</span>}
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

function FloorSelector({ activeFloor, onFloorChange }) {
  return (
    <div className="floor-selector">
      {floorPlans.map((plan) => (
        <button key={plan.id} className={activeFloor === plan.id ? 'active' : ''} onClick={(event) => {
          event.stopPropagation();
          onFloorChange(plan.id);
        }}>
          <strong>{plan.label}</strong>
          <span>{plan.note}</span>
        </button>
      ))}
    </div>
  );
}

function SummaryMapPreview({ onOpenMap }) {
  const [activeFloor, setActiveFloor] = useState('floor-1');
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
      <FloorSelector activeFloor={activeFloor} onFloorChange={setActiveFloor} />
      <FloorOverviewMap activeFloor={activeFloor} selected={null} onSelect={(sectionId) => onOpenMap(activeFloor, sectionId)} />
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
  const axisBreaks = [-5000, -1000, 0, 500, 1000, 1500, 2000];
  const categories = [...new Set(works.map((work) => work[groupBy] || 'Unknown'))].sort((a, b) => a.localeCompare(b));
  const rowGap = groupBy === 'culture' ? 34 : 42;
  const svgHeight = Math.max(530, 112 + Math.max(1, categories.length - 1) * rowGap);
  const plot = { left: 230, right: 1760, top: 34, bottom: svgHeight - 72 };
  const plotWidth = plot.right - plot.left;
  const plotHeight = plot.bottom - plot.top;
  const plotCategory = (work) => {
    return work[groupBy] || 'Unknown';
  };
  const ticks = [minYear, ...axisBreaks.filter((year) => year > minYear && year < maxYear), maxYear]
    .filter((year, index, years) => index === 0 || year !== years[index - 1]);
  const x = (year) => {
    const clampedYear = clamp(year, minYear, maxYear);
    const segmentIndex = ticks.findIndex((tick, index) => clampedYear >= tick && clampedYear <= ticks[index + 1]);

    if (segmentIndex < 0 || ticks.length === 1) return plot.left;

    const start = ticks[segmentIndex];
    const end = ticks[segmentIndex + 1];
    const segmentWidth = plotWidth / (ticks.length - 1);
    const localProgress = end === start ? 0 : (clampedYear - start) / (end - start);
    return plot.left + segmentIndex * segmentWidth + localProgress * segmentWidth;
  };
  const y = (cat) => plot.top + categories.indexOf(cat) * (plotHeight / Math.max(1, categories.length - 1));
  const formatYear = (year) => {
    if (year < 0) return `BC ${Math.abs(year)}`;
    if (year === 0) return '0';
    return `AD ${year}`;
  };
  const visibleMediumGroups = Object.keys(mediumColors).filter((group) => works.some((work) => work.mediumGroup === group));
  const groupPositions = works.reduce((acc, work) => {
    const key = `${Math.round(work.year / 25) * 25}-${plotCategory(work)}`;
    if (!acc.has(key)) acc.set(key, []);
    acc.get(key).push(work.id);
    return acc;
  }, new Map());
  const jitter = (work) => {
    const key = `${Math.round(work.year / 25) * 25}-${plotCategory(work)}`;
    const group = groupPositions.get(key) || [work.id];
    const index = group.indexOf(work.id);
    const ring = Math.floor(index / 8);
    const angle = ((index % 8) / 8) * Math.PI * 2 + ring * 0.42;
    const radius = Math.min(34, 12 + ring * 8);

    return {
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius * 0.58,
    };
  };
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  return (
    <svg className="scatter-svg" style={{ '--scatter-height': `${svgHeight}px` }} viewBox={`0 0 1800 ${svgHeight}`}>
      {ticks.map((tick) => {
        const gx = x(tick);
        return <g key={tick}><line x1={gx} x2={gx} y1={plot.top} y2={plot.bottom} /><text x={gx} y={svgHeight - 34}>{formatYear(tick)}</text></g>;
      })}
      {categories.map((cat) => <g key={cat}><line x1={plot.left} x2={plot.right} y1={y(cat)} y2={y(cat)} /><text x="214" y={y(cat) + 4}>{cat}</text></g>)}
      <text className="axis-title" x="995" y={svgHeight - 8}>Object End Date</text>
      {works.map((work, i) => {
        const offset = jitter(work);
        const cx = clamp(x(work.year) + offset.x, plot.left, plot.right);
        const cy = clamp(y(plotCategory(work)) + offset.y, plot.top, plot.bottom);
        const isSelected = selected?.id === work.id;

        return (
          <g key={work.id} className="point-wrap">
            {isSelected && <circle className="point-ring" cx={cx} cy={cy} r="17" />}
            <circle className={isSelected ? 'point selected' : 'point'} cx={cx} cy={cy}
              r={isSelected ? 8 : 5.5} fill={mediumColors[work.mediumGroup] || mediumColors.Other}
              onMouseEnter={() => onHover(work)} onFocus={() => onHover(work)} tabIndex="0" />
          </g>
        );
      })}
    </svg>
  );
}

function ArtworkDetailCard({ artwork, onClose }) {
  return (
    <aside className="detail-card">
      <button className="close" onClick={onClose}>×</button>
      <MetArtworkImage artwork={artwork} alt={artwork.title} />
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

function MediumHeaderLegend({ works }) {
  const counts = works.reduce((acc, work) => {
    const group = work.mediumGroup || 'Other';
    acc[group] = (acc[group] || 0) + 1;
    return acc;
  }, {});
  const groups = Object.keys(mediumColors)
    .filter((group) => counts[group])
    .sort((a, b) => counts[b] - counts[a]);
  const max = Math.max(...groups.map((group) => counts[group]), 1);

  return (
    <div className="header-medium-legend">
      <span>Medium</span>
      {groups.map((group) => (
        <div className="header-medium-row" key={group}>
          <em>{group}</em>
          <i><b style={{ width: `${Math.max(8, (counts[group] / max) * 96)}px`, background: mediumColors[group] }} /></i>
          <strong>{counts[group]}</strong>
        </div>
      ))}
    </div>
  );
}

function TimelineViewer({ target }) {
  const [range, setRange] = useState([-5000, 2000]);
  const [groupBy, setGroupBy] = useState('department');
  const [hovered, setHovered] = useState(null);

  useEffect(() => {
    if (!target) return;
    const padding = Math.max(150, Math.round(Math.abs(target.year) * 0.08));
    setRange([Math.max(-5000, target.year - padding), Math.min(2000, target.year + padding)]);
    setGroupBy('department');
    setHovered(target);
  }, [target]);

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
        <ChartPanel title={`${groupBy} timeline`} headerExtra={<MediumHeaderLegend works={filtered} />}>
          <ScatterPlot works={filtered} groupBy={groupBy} range={range} onHover={setHovered} selected={activeHover} />
        </ChartPanel>
        {activeHover && <ArtworkDetailCard artwork={activeHover} onClose={() => setHovered(null)} />}
      </section>
    </main>
  );
}

function FloorOverviewMap({ activeFloor, selected, onSelect }) {
  const visibleSections = floorSections.filter((section) => section.floor === activeFloor);

  return (
    <svg className="map-svg floor-overview" viewBox="0 0 1240 540">
      <path className="building-outline" d="M98 398H132V196h36V42h908v150h48v180h-48v126H98Z" />
      <path className="floor-spine" d="M424 278H488M680 258H812M618 300V278M618 384V438M424 132H486M686 234H812M1004 274H1076" />
      <rect className="great-hall" x="488" y="400" width="260" height="68" rx="4" />
      <text className="hall-label" x="618" y="435">Great Hall</text>
      <text className="facade-label" x="618" y="524">Fifth Avenue Entrance / 82nd Street</text>
      {visibleSections.map((section) => (
        <g key={section.id} onClick={(event) => {
          event.stopPropagation();
          onSelect(section.id);
        }} className={selected === section.id ? 'map-room active' : 'map-room'}>
          <rect x={section.x} y={section.y} width={section.w} height={section.h} rx="3" />
          <text x={section.x + section.w / 2} y={section.y + section.h / 2 - 10}>{section.label}</text>
          <text className="room-subtitle" x={section.x + section.w / 2} y={section.y + section.h / 2 + 16}>{section.subtitle}</text>
        </g>
      ))}
    </svg>
  );
}

function FloorDetailMap({ floor, selectedRoom, onRoomSelect }) {
  const baseRooms = floorRooms[floor] || [];
  const rooms = selectedRoom && !baseRooms.includes(selectedRoom)
    ? [selectedRoom, ...baseRooms]
    : baseRooms;
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

function ArtworkListItem({ artwork, selected }) {
  return (
    <article className={selected ? 'art-list-item selected' : 'art-list-item'}>
      <MetArtworkImage artwork={artwork} alt={artwork.title} />
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

function ArtworkList({ room, selectedArtworkId }) {
  const works = galleryArtworks[room] || timelineArtworks.slice(0, 4);
  return (
    <section className="art-list">
      <div className="panel-head"><h2>Room {room}</h2><span>{works.length} works</span></div>
      {works.map((work) => <ArtworkListItem key={work.id} artwork={work} selected={work.id === selectedArtworkId} />)}
    </section>
  );
}

function GalleryMap({ target }) {
  const [activeFloor, setActiveFloor] = useState('floor-1');
  const [floor, setFloor] = useState(null);
  const [room, setRoom] = useState(null);
  const [selectedArtworkId, setSelectedArtworkId] = useState(null);

  useEffect(() => {
    if (!target) return;
    setActiveFloor(target.floorId || 'floor-1');
    setFloor(target.sectionId || null);
    setRoom(target.room || null);
    setSelectedArtworkId(target.artworkId || null);
  }, [target]);

  const chooseMapFloor = (id) => {
    setActiveFloor(id);
    setFloor(null);
    setRoom(null);
    setSelectedArtworkId(null);
  };
  const chooseFloor = (id) => {
    setFloor(id);
    setRoom(null);
    setSelectedArtworkId(null);
  };
  const selectedFloor = floorSections.find((section) => section.id === floor);

  return (
    <main className="dashboard">
      <PageTitle title="Gallery Map" subtitle="Explore a Met-inspired floor plan schematic, then inspect CSV gallery rooms and artworks." />
      <section className={['gallery-layout', floor ? 'has-rooms' : '', room ? 'has-list' : ''].filter(Boolean).join(' ')}>
        <ChartPanel title="Met-Inspired Gallery Sections">
          <FloorSelector activeFloor={activeFloor} onFloorChange={chooseMapFloor} />
          <FloorOverviewMap activeFloor={activeFloor} selected={floor} onSelect={chooseFloor} />
        </ChartPanel>
        {floor && (
          <ChartPanel title={`${selectedFloor?.label} Rooms`}>
            <FloorDetailMap floor={floor} selectedRoom={room} onRoomSelect={(nextRoom) => {
              setRoom(nextRoom);
              setSelectedArtworkId(null);
            }} />
          </ChartPanel>
        )}
        {room && <ArtworkList room={room} selectedArtworkId={selectedArtworkId} />}
      </section>
    </main>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState('summary');
  const [galleryTarget, setGalleryTarget] = useState(null);
  const [timelineTarget, setTimelineTarget] = useState(null);
  const openGalleryMap = (floorId = 'floor-1', sectionId = null) => {
    setGalleryTarget({ floorId, sectionId, requestedAt: Date.now() });
    setActiveTab('map');
  };
  const jumpToTimeline = (artwork) => {
    setTimelineTarget({ ...artwork, requestedAt: Date.now() });
    setActiveTab('timeline');
  };
  const jumpToMap = (artwork) => {
    const location = sectionByRoom[artwork.galleryNumber] || {};
    setGalleryTarget({
      floorId: location.floorId || 'floor-1',
      sectionId: location.sectionId || null,
      room: artwork.galleryNumber || null,
      artworkId: artwork.id,
      requestedAt: Date.now(),
    });
    setActiveTab('map');
  };

  return (
    <div className="app-shell">
      <Header activeTab={activeTab} onTabChange={setActiveTab} onJumpTimeline={jumpToTimeline} onJumpMap={jumpToMap} />
      {activeTab === 'summary' && <CollectionSummary onOpenMap={openGalleryMap} />}
      {activeTab === 'timeline' && <TimelineViewer target={timelineTarget} />}
      {activeTab === 'map' && <GalleryMap target={galleryTarget} />}
    </div>
  );
}
