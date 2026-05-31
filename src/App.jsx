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

const categoryPalette = [
  '#ff174f', '#00d5ff', '#ffd23f', '#b967ff', '#24e27a', '#ff7a1a',
  '#ff4fd8', '#5b8cff', '#c8ff2e', '#ff9f9f', '#00b38f', '#f2f5ff',
  '#c84b31', '#72ffcf', '#a06bff', '#ffcc8a', '#16a3ff', '#f4ff78',
  '#ff5c77', '#4be04b', '#9ad7ff', '#ff8a00', '#d778ff', '#b8f000',
];
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
  const sliderMin = -5000;
  const sliderMax = 2000;
  const minPercent = ((min - sliderMin) / (sliderMax - sliderMin)) * 100;
  const maxPercent = ((max - sliderMin) / (sliderMax - sliderMin)) * 100;
  const clamp = (value, side) => {
    const next = Number(value);
    if (side === 'min') setRange([Math.min(next, max - 100), max]);
    else setRange([min, Math.max(next, min + 100)]);
  };
  return (
    <div className="range-control">
      <div><span>{min < 0 ? `${Math.abs(min)} BC` : `AD ${min}`}</span><span>{max < 0 ? `${Math.abs(max)} BC` : `AD ${max}`}</span></div>
      <div className="dual-range">
        <div className="range-track" />
        <div className="range-fill" style={{ left: `${minPercent}%`, width: `${maxPercent - minPercent}%` }} />
        <input type="range" min={sliderMin} max={sliderMax} step="50" value={min} onChange={(e) => clamp(e.target.value, 'min')} />
        <input type="range" min={sliderMin} max={sliderMax} step="50" value={max} onChange={(e) => clamp(e.target.value, 'max')} />
      </div>
    </div>
  );
}

function ScatterPlot({ works, categoryWorks, groupBy, range, onSelectCluster, selectedClusterId, selectedArtworkId }) {
  const [minYear, maxYear] = range;
  const axisBreaks = [-5000, -1000, 0, 250, 500, 750, 1000, 1250, 1500, 1750, 2000];
  const categories = [...new Set(categoryWorks.map((work) => work[groupBy] || 'Unknown'))].sort((a, b) => a.localeCompare(b));
  const rowGap = groupBy === 'department' ? 58 : groupBy === 'classification' ? 34 : 28;
  const svgHeight = Math.min(2200, Math.max(620, 150 + Math.max(1, categories.length - 1) * rowGap));
  const svgWidth = 2200;
  const plot = { left: 250, right: 2140, top: 34, bottom: svgHeight - 72 };
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
  const yStep = categories.length > 1 ? plotHeight / (categories.length - 1) : rowGap;
  const formatYear = (year) => {
    if (year < 0) return `BC ${Math.abs(year)}`;
    if (year === 0) return '0';
    return `AD ${year}`;
  };
  const categoryColor = (category) => categoryPalette[categories.indexOf(category) % categoryPalette.length];
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const bubbleRadius = (count) => Math.min(34, 5 + Math.sqrt(count) * 4.4);
  const groupedWorks = [...works.reduce((acc, work) => {
    const category = plotCategory(work);
    const clusterYear = Math.round(work.year / 10) * 10;
    const key = `${category}-${clusterYear}`;
    if (!acc.has(key)) {
      acc.set(key, { id: key, category, year: clusterYear, works: [] });
    }
    acc.get(key).works.push(work);
    return acc;
  }, new Map()).values()];
  const clusters = groupedWorks.flatMap((cluster) => {
    const sortedWorks = [...cluster.works].sort((a, b) => a.year - b.year || a.title.localeCompare(b.title));
    const chunks = [];
    for (let index = 0; index < sortedWorks.length; index += 8) {
      chunks.push(sortedWorks.slice(index, index + 8));
    }
    return chunks.map((chunk, index) => ({ ...cluster, id: `${cluster.id}-${index}`, works: chunk }));
  }).map((cluster) => {
    const meanYear = cluster.works.reduce((sum, work) => sum + work.year, 0) / cluster.works.length;
    return {
      ...cluster,
      year: meanYear,
      count: cluster.works.length,
    };
  });
  const positionedClusters = categories.flatMap((category) => {
    const rowClusters = clusters
      .filter((cluster) => cluster.category === category)
      .sort((a, b) => a.year - b.year || a.id.localeCompare(b.id));
    const placed = [];
    const yLimit = Math.min(yStep * 0.42, 28);
    const yOffsets = [0, -0.25, 0.25, -0.5, 0.5, -0.75, 0.75, -1, 1].map((value) => value * yLimit);
    const xOffsets = [0, 64, -64, 128, -128, 192, -192, 256, -256, 320, -320];

    return rowClusters.map((cluster, index) => {
      const radius = bubbleRadius(cluster.count);
      const baseX = x(cluster.year);
      const baseY = y(cluster.category);
      const candidates = yOffsets.flatMap((yOffset) => xOffsets.map((xOffset) => ({
        x: clamp(baseX + xOffset, plot.left + radius + 4, plot.right - radius - 4),
        y: clamp(baseY + yOffset, plot.top + radius + 4, plot.bottom - radius - 4),
      })));
      const position = candidates.find((candidate) => placed.every((other) => {
        const distance = Math.hypot(candidate.x - other.x, candidate.y - other.y);
        return distance > radius + other.radius + 12;
      })) || {
        x: clamp(baseX + ((index % 7) - 3) * 36, plot.left + radius + 4, plot.right - radius - 4),
        y: clamp(baseY + (((index % 9) - 4) / 4) * yLimit, plot.top + radius + 4, plot.bottom - radius - 4),
      };
      placed.push({ ...position, radius });
      return { ...cluster, cx: position.x, cy: position.y, radius };
    });
  });

  return (
    <svg className="scatter-svg" style={{ '--scatter-height': `${svgHeight}px`, '--scatter-width': `${svgWidth}px` }} viewBox={`0 0 ${svgWidth} ${svgHeight}`}>
      {ticks.map((tick) => {
        const gx = x(tick);
        return <g key={tick}><line x1={gx} x2={gx} y1={plot.top} y2={plot.bottom} /><text x={gx} y={svgHeight - 34}>{formatYear(tick)}</text></g>;
      })}
      {categories.map((cat) => <g key={cat}><line x1={plot.left} x2={plot.right} y1={y(cat)} y2={y(cat)} /><text x="234" y={y(cat) + 4}>{cat}</text></g>)}
      <text className="axis-title" x="1195" y={svgHeight - 8}>Object End Date</text>
      {positionedClusters.map((cluster) => {
        const cx = cluster.cx;
        const cy = cluster.cy;
        const isSelected = selectedClusterId === cluster.id || cluster.works.some((work) => work.id === selectedArtworkId);
        const radius = cluster.radius;

        return (
          <g key={cluster.id} className={isSelected ? 'point-wrap selected' : 'point-wrap'}>
            {isSelected && <circle className="point-ring" cx={cx} cy={cy} r={radius + 8} />}
            <circle className={isSelected ? 'point selected bubble-point' : 'point bubble-point'} cx={cx} cy={cy}
              r={isSelected ? radius + 2 : radius} fill={categoryColor(cluster.category)}
              onMouseEnter={() => onSelectCluster(cluster, false)}
              onClick={() => onSelectCluster(cluster, true)}
              onFocus={() => onSelectCluster(cluster, false)}
              tabIndex="0" />
            {cluster.count > 1 && <text className="bubble-count" x={cx} y={cy + 4}>{cluster.count}</text>}
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

function TimelineClusterList({ cluster, onClose, selectedArtworkId }) {
  if (!cluster) return null;

  return (
    <aside className="art-list timeline-cluster-list">
      <div className="panel-head">
        <h2>{cluster.works.length > 1 ? `${cluster.works.length} Works` : 'Selected Work'}</h2>
        <button className="close" onClick={onClose}>×</button>
      </div>
      <p className="cluster-meta">{cluster.category} · around {cluster.year < 0 ? `${Math.round(Math.abs(cluster.year))} BCE` : `AD ${Math.round(cluster.year)}`}</p>
      {cluster.works.map((work) => (
        <ArtworkListItem key={work.id} artwork={work} selected={work.id === selectedArtworkId} />
      ))}
    </aside>
  );
}

function TimelineViewer({ target }) {
  const [range, setRange] = useState([-5000, 2000]);
  const [groupBy, setGroupBy] = useState('department');
  const [selectedCluster, setSelectedCluster] = useState(null);
  const [selectedArtworkId, setSelectedArtworkId] = useState(null);
  const [pinnedCluster, setPinnedCluster] = useState(false);

  useEffect(() => {
    if (!target) return;
    const padding = Math.max(150, Math.round(Math.abs(target.year) * 0.08));
    setRange([Math.max(-5000, target.year - padding), Math.min(2000, target.year + padding)]);
    setGroupBy('department');
    setSelectedArtworkId(target.id);
    setSelectedCluster({
      id: `search-${target.id}`,
      category: target.department,
      year: target.year,
      count: 1,
      works: [target],
    });
    setPinnedCluster(true);
  }, [target]);

  const filtered = useMemo(() => timelineArtworks.filter((work) => work.year >= range[0] && work.year <= range[1]), [range]);
  const activeCluster = selectedCluster && selectedCluster.works.some((clusterWork) => filtered.some((work) => work.id === clusterWork.id))
    ? selectedCluster
    : null;
  const chooseCluster = (cluster, pin = false) => {
    if (pin && pinnedCluster && selectedCluster?.id === cluster.id) {
      setSelectedCluster(null);
      setSelectedArtworkId(null);
      setPinnedCluster(false);
      return;
    }
    if (pinnedCluster && !pin) return;
    setSelectedCluster(cluster);
    setSelectedArtworkId(null);
    setPinnedCluster(pin);
  };

  return (
    <main className="dashboard">
      <PageTitle title="Timeline Viewer" subtitle="Explore The Met collection across time." />
      <section className="timeline-controls">
        <RangeSlider range={range} setRange={setRange} />
        <div className="filter-buttons">
          {['department', 'classification', 'culture'].map((filter) => (
            <button key={filter} className={groupBy === filter ? 'active' : ''} onClick={() => {
              setGroupBy(filter);
              setSelectedCluster(null);
              setSelectedArtworkId(null);
              setPinnedCluster(false);
            }}>{filter}</button>
          ))}
        </div>
      </section>
      <section className={activeCluster ? 'timeline-layout has-detail' : 'timeline-layout'}>
        <ChartPanel title={`${groupBy} timeline`}>
          <ScatterPlot
            works={filtered}
            categoryWorks={timelineArtworks}
            groupBy={groupBy}
            range={range}
            onSelectCluster={chooseCluster}
            selectedClusterId={activeCluster?.id}
            selectedArtworkId={selectedArtworkId}
          />
        </ChartPanel>
        {activeCluster && <TimelineClusterList cluster={activeCluster} selectedArtworkId={selectedArtworkId} onClose={() => {
          setSelectedCluster(null);
          setSelectedArtworkId(null);
          setPinnedCluster(false);
        }} />}
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
