import { useEffect, useMemo, useRef, useState } from 'react';

import metLogo from '../logo.png';
import {
  classificationCounts,
  departmentCounts,
  floorPlans,
  floorRooms,
  floorSections,
  galleryArtworks,
  sectionByRoom,
  summaryStats,
  allArtworks,
  endDateBins,
  timelineArtworks,
} from './mockData.js';

const tabs = [
  ['summary', 'home'],
  ['timeline', 'timeline viewer'],
  ['map', 'gallery map'],
];

const categoryPalette = [
  '#ff174f', '#00d5ff', '#ffd23f', '#b967ff', '#24e27a', '#ff7a1a',
  '#ff4fd8', '#5b8cff', '#c8ff2e', '#ff9f9f', '#00b38f', '#f2f5ff',
  '#c84b31', '#72ffcf', '#a06bff', '#ffcc8a', '#16a3ff', '#f4ff78',
  '#ff5c77', '#4be04b', '#9ad7ff', '#ff8a00', '#d778ff', '#b8f000',
];

// Timeline 페이지 축 구간과 동일하게 맞춤
const TIMELINE_BINS = [
  [-5000, -1000],
  [-1000, 0],
  [0, 250],
  [250, 500],
  [500, 750],
  [750, 1000],
  [1000, 1250],
  [1250, 1500],
  [1500, 1750],
  [1750, 2000],
];

const FAVORITES_STORAGE_KEY = 'inside-the-met-favorites';
const MET_URL = 'https://www.metmuseum.org/art/collection';

const metImageCache = new Map();

function getArtworkUrl(artwork) {
  return artwork.link || artwork.metUrl || artwork.objectUrl || MET_URL;
}

function normalizeFavoriteArtwork(artwork) {
  return {
    ...artwork,
    id: String(artwork.id),
    link: getArtworkUrl(artwork),
  };
}

function FavoriteButton({ artwork, isFavorite, onToggleFavorite, className = '' }) {
  const active = isFavorite?.(artwork.id);

  return (
    <button
      type="button"
      className={`favorite-toggle ${active ? 'active' : ''} ${className}`}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onToggleFavorite?.(artwork);
      }}
      aria-label={active ? 'Remove from favorites' : 'Add to favorites'}
      title={active ? 'Remove from favorites' : 'Add to favorites'}
    >
      {active ? '★' : '☆'}
    </button>
  );
}

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

  return <img src={src} alt={alt || artwork.title} className={className} loading="lazy" />;
}

function SearchPopover({ query, results, onClose, onJumpTimeline, onJumpMap }) {
  return (
    <div className="search-popover">
      {query.trim() ? (
        <>
          <div className="search-summary">
            {results.length ? `${results.length} matching artworks` : 'No matching artworks'}
          </div>
          {results.map((artwork) => (
            <div className="search-result" key={artwork.id}>
              <MetArtworkImage artwork={artwork} alt={artwork.title} />
              <div>
                <h3>{artwork.title}</h3>
                <p>{artwork.artist}</p>
                <span>{artwork.department} · {artwork.date}</span>
                <div className="result-actions">
                  <button
                    type="button"
                    onClick={() => {
                      onJumpTimeline(artwork);
                      onClose();
                    }}
                  >
                    Timeline
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onJumpMap(artwork);
                      onClose();
                    }}
                  >
                    Map
                  </button>
                </div>
              </div>
            </div>
          ))}
        </>
      ) : (
        <div className="search-summary">
          Search by title, artist, culture, department, medium, or accession number.
        </div>
      )}
    </div>
  );
}

function Header({ activeTab, onTabChange, onJumpTimeline, onJumpMap, favoritesCount }) {
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef(null);

  const results = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return [];

    return allArtworks
      .filter((artwork) => [
        artwork.title,
        artwork.artist,
        artwork.department,
        artwork.classification,
        artwork.culture,
        artwork.medium,
        artwork.accession,
      ].join(' ').toLowerCase().includes(term));
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
        <button type="button" className="brand" onClick={() => onTabChange('summary')}>
          <span className="brand-prefix">inside</span>
          <img className="brand-mark" src={metLogo} alt="The Met" />
        </button>

        <div className="tab-row">
          {tabs.map(([id, label]) => (
            <button
              type="button"
              key={id}
              className={activeTab === id ? 'tab active' : 'tab'}
              onClick={() => onTabChange(id)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="header-actions">
          <button
            type="button"
            className={activeTab === 'favorites' ? 'favorite-header-button active' : 'favorite-header-button'}
            onClick={() => onTabChange('favorites')}
            aria-label="Open favorites"
            title="Open favorites"
          >
            ★
            {favoritesCount > 0 && <span>{favoritesCount}</span>}
          </button>

          <div className="search-box" ref={searchRef} onClick={() => setSearchOpen(true)}>
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
                onClose={() => setSearchOpen(false)}
                onJumpTimeline={onJumpTimeline}
                onJumpMap={onJumpMap}
              />
            )}
          </div>
        </div>
      </nav>
    </header>
  );
}

function PageTitle({ title, subtitle }) {
  return (
    <section className="page-title">
      <h1>{title}</h1>
      <p>{subtitle}</p>
    </section>
  );
}

function MetricCard({ icon, value, label, note }) {
  return (
    <article className="metric-card">
      <div className="metric-icon">{icon}</div>
      <div>
        <strong>{typeof value === 'number' ? value.toLocaleString() : value}</strong>
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
        <span>{headerExtra || 'ⓘ'}</span>
      </div>
      {children}
      {footer && <div className="panel-footer">{footer}</div>}
    </section>
  );
}

function BarChart({ data }) {
  const max = Math.max(...data.map((d) => d[1]), 1);
  const width = 560;
  const height = 300;
  const left = 52;
  const bottom = 48;
  const barW = 30;
  const gap = data.length > 1 ? (width - left - 26 - data.length * barW) / (data.length - 1) : 0;

  return (
    <svg className="chart-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Department distribution">
      {[0, 50, 100, 150, 200, 250].map((tick) => {
        const y = height - bottom - (tick / 260) * 205;
        return (
          <g key={tick}>
            <line x1={left} x2={width - 20} y1={y} y2={y} />
            <text x={left - 10} y={y + 4} textAnchor="end">{tick}</text>
          </g>
        );
      })}
      {data.map(([name, value], i) => {
        const x = left + i * (barW + gap);
        const h = (value / max) * 205;
        return (
          <g key={name}>
            <rect className="hot-bar" x={x} y={height - bottom - h} width={barW} height={h} rx="3" />
            <text className="bar-value" x={x + barW / 2} y={height - bottom - h - 8}>{value}</text>
            <text className="x-label" x={x + barW / 2} y={height - 18}>{name}</text>
          </g>
        );
      })}
    </svg>
  );
}

function DonutChart({ data }) {
  const total = data.reduce((sum, d) => sum + d[1], 0) || 1;
  let offset = 0;
  const colors = ['#f3002f', '#ff445d', '#c43a4d', '#ef7885', '#ad2638', '#5d1d27'];
  const slices = data.map(([name, value], i) => {
    const pct = value / total;
    const slice = { name, value, pct, color: colors[i % colors.length], dash: `${pct * 100} ${100 - pct * 100}`, start: offset };
    offset += pct;
    return slice;
  });

  return (
    <div className="donut-wrap">
      <svg className="donut" viewBox="0 0 220 220" role="img" aria-label="Classification share">
        {slices.map((s) => (
          <circle
            key={s.name}
            cx="110"
            cy="110"
            r="72"
            fill="transparent"
            stroke={s.color}
            strokeWidth="34"
            strokeDasharray={s.dash}
            strokeDashoffset={-s.start * 100}
            pathLength="100"
          />
        ))}
        <text className="donut-total" x="110" y="104" textAnchor="middle">{total.toLocaleString()}</text>
        <text className="donut-label" x="110" y="128" textAnchor="middle">Works</text>
      </svg>
      <ul className="legend">
        {slices.map((s) => (
          <li key={s.name}>
            <span style={{ background: s.color }} />
            <div>{s.name}<em>{s.value} ({Math.round(s.pct * 1000) / 10}%)</em></div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function MiniDepartmentBars() {
  const topDepartments = departmentCounts.slice(0, 5);
  const max = Math.max(...topDepartments.map((d) => d[1]), 1);

  return (
    <div className="mini-bars">
      {topDepartments.map(([label, value]) => (
        <div className="mini-bar-row" key={label}>
          <span>{label}</span>
          <div><i style={{ width: `${(value / max) * 100}%` }} /></div>
          <em>{value}</em>
        </div>
      ))}
    </div>
  );
}

function Histogram({ data }) {
  const max = Math.max(...data.map((d) => d[1]), 1);
  const width = 560;
  const height = 300;

  return (
    <svg className="chart-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Object end date histogram">
      {[0, 100, 200, 300].map((tick) => {
        const y = 240 - (tick / 360) * 200;
        return (
          <g key={tick}>
            <line x1="54" x2="530" y1={y} y2={y} />
            <text x="44" y={y + 4} textAnchor="end">{tick}</text>
          </g>
        );
      })}
      {data.map(([year, value], i) => {
        const x = 54 + i * 31;
        const h = (value / max) * 200;
        return <rect key={year} className="hot-bar" x={x} y={240 - h} width="20" height={h} rx="3" />;
      })}
      {[-4000, -3000, -2000, -1000, 0, 1000, 2000].map((tick) => (
        <text key={tick} x={54 + ((tick + 5000) / 7000) * 476} y="272" textAnchor="middle">{tick}</text>
      ))}
      <text className="axis-title" x="292" y="295">End Date (Year)</text>
    </svg>
  );
}

function FloorSelector({ activeFloor, onFloorChange }) {
  return (
    <div className="floor-selector">
      {floorPlans.map((plan) => (
        <button
          type="button"
          key={plan.id}
          className={activeFloor === plan.id ? 'active' : ''}
          onClick={(event) => {
            event.stopPropagation();
            onFloorChange(plan.id);
          }}
        >
          <strong>{plan.label}</strong>
          <span>{plan.note}</span>
        </button>
      ))}
    </div>
  );
}

function FloorOverviewMap({ activeFloor, selected, onSelect, compact = false }) {
  const visibleSections = floorSections.filter((section) => section.floor === activeFloor);

  return (
    <svg className={compact ? 'map-svg compact' : 'map-svg'} viewBox="0 0 1160 520" role="img" aria-label="Museum floor overview">
      <rect className="building-outline" x="64" y="34" width="1032" height="438" rx="34" />
      <path className="floor-spine" d="M116 382 C250 322 342 388 478 314 S730 218 1040 306" />
      <rect className="great-hall" x="488" y="376" width="184" height="78" rx="18" />
      <text className="hall-label" x="580" y="416">Great Hall</text>
      <text className="facade-label" x="580" y="494">Fifth Avenue Entrance / 82nd Street</text>

      {visibleSections.map((section) => (
        <g
          key={section.id}
          className={selected === section.id ? 'map-room active' : 'map-room'}
          onClick={(event) => {
            event.stopPropagation();
            onSelect(section.id);
          }}
        >
          <rect x={section.x} y={section.y} width={section.w} height={section.h} rx="16" />
          <text x={section.x + section.w / 2} y={section.y + section.h / 2 - 8}>{section.label}</text>
          <text className="room-subtitle" x={section.x + section.w / 2} y={section.y + section.h / 2 + 18}>{section.subtitle}</text>
        </g>
      ))}
    </svg>
  );
}

function TimelinePreview({ onJumpTimeline, onOpenTimeline }) {
  const [hoveredBin, setHoveredBin] = useState(null);

  const bins = useMemo(() => {
    return TIMELINE_BINS.map(([start, end]) => {
      const count = timelineArtworks.filter((w) => w.year >= start && w.year < end).length;
      return { start, end, count };
    });
  }, []);

  const formatYear = (y) => {
    if (y < 0) return `BC ${Math.abs(y)}`;
    if (y === 0) return '0';
    return `AD ${y}`;
  };

  const max = Math.max(...bins.map((b) => b.count));
  const width = 520;
  const height = 240;
  const padding = { top: 36, right: 16, bottom: 56, left: 16 };
  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;
  const gap = 4;
  const barW = (plotW - gap * (bins.length - 1)) / bins.length;

  const hoveredLabel = hoveredBin !== null
    ? `${formatYear(bins[hoveredBin].start)} – ${formatYear(bins[hoveredBin].end)} · ${bins[hoveredBin].count} works`
    : 'Hover and click a bar to filter by period';

  return (
    <section className="preview-card preview-timeline">
      <div className="preview-head">
        <div>
          <h2>Timeline Viewer</h2>
          <p>{timelineArtworks.length} works · click any period below</p>
        </div>
        <button type="button" className="preview-explore-btn" onClick={onOpenTimeline}>
          Explore timeline <span>→</span>
        </button>
      </div>

      <div className="preview-hover-label-html">{hoveredLabel}</div>

      <svg className="preview-chart" viewBox={`0 0 ${width} ${height}`}>
        {bins.map((bin, i) => {
          const x = padding.left + i * (barW + gap);
          const h = bin.count > 0 ? Math.max(4, (bin.count / max) * plotH) : 2;
          const y = padding.top + plotH - h;
          const isHovered = hoveredBin === i;

          return (
            <g
              key={`${bin.start}-${bin.end}`}
              className={isHovered ? 'preview-bar-group hovered' : 'preview-bar-group'}
              onMouseEnter={() => setHoveredBin(i)}
              onMouseLeave={() => setHoveredBin(null)}
              onClick={() => onJumpTimeline(bin.start, bin.end)}
              tabIndex="0"
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onJumpTimeline(bin.start, bin.end)}
            >
              <rect className="preview-bar-hitbox" x={x - gap / 2} y={padding.top} width={barW + gap} height={plotH} />
              <rect className="preview-bar" x={x} y={y} width={barW} height={h} rx="2" />
              {isHovered && (
                <text className="preview-bar-count" x={x + barW / 2} y={y - 10} textAnchor="middle">
                  {bin.count}
                </text>
              )}
            </g>
          );
        })}

        <line className="preview-axis-line" x1={padding.left} x2={width - padding.right} y1={padding.top + plotH} y2={padding.top + plotH} />
        <text className="preview-axis" x={padding.left + barW / 2} y={height - 30} textAnchor="middle">BC 5000</text>
        <text className="preview-axis" x={padding.left + 2 * (barW + gap) - gap / 2} y={height - 30} textAnchor="middle">0</text>
        <text className="preview-axis" x={padding.left + 9 * (barW + gap) + barW / 2} y={height - 30} textAnchor="middle">AD 2000</text>
      </svg>
    </section>
  );
}

function GalleryPreview({ onJumpDepartment, onOpenMap }) {
  const [hoveredDept, setHoveredDept] = useState(null);
  const topDepts = useMemo(() => departmentCounts.slice(0, 6), []);
  const maxCount = Math.max(...topDepts.map((d) => d[1]));

  const hoveredLabel = hoveredDept !== null
    ? `${topDepts[hoveredDept][0]} · ${topDepts[hoveredDept][1]} works`
    : 'Hover and click a department to filter';

  return (
    <section className="preview-card preview-gallery">
      <div className="preview-head">
        <div>
          <h2>Gallery Map</h2>
          <p>{summaryStats.departments} departments · click any to explore</p>
        </div>
        <button type="button" className="preview-explore-btn" onClick={onOpenMap}>
          Explore gallery <span>→</span>
        </button>
      </div>

      <div className="preview-hover-label-html">{hoveredLabel}</div>

      <div className="preview-dept-grid">
        {topDepts.map(([name, count], i) => (
          <button
            type="button"
            className="preview-dept-tile"
            key={name}
            onClick={() => onJumpDepartment(name)}
            onMouseEnter={() => setHoveredDept(i)}
            onMouseLeave={() => setHoveredDept(null)}
          >
            <div className="preview-dept-fill" style={{ height: `${(count / maxCount) * 100}%` }} />
            <div className="preview-dept-info">
              <strong>{name}</strong>
              <em>{count}</em>
            </div>
            <span className="preview-dept-arrow">→</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function CollectionSummary({ onJumpTimelineRange, onJumpDepartment, onOpenTimeline, onOpenMap }) {
  const years = timelineArtworks.map((w) => w.year);
  const minYear = Math.min(...years);
  const maxYear = Math.max(...years);
  const formatYear = (y) => (y < 0 ? `BC ${Math.abs(y)}` : `AD ${y}`);
  const timeSpan = `${formatYear(minYear)}–${formatYear(maxYear)}`;

  return (
    <>
      <PageTitle
        title="Welcome to Inside The Met"
        subtitle="Explore The Met collection through key metrics, time periods, and galleries."
      />

      <section className="metric-grid">
        <MetricCard icon="▧" value={summaryStats.totalArtworks} label="Total Artworks" note="Highlighted works in this dataset" />
        <MetricCard icon="▦" value={summaryStats.departments} label="Departments" note="Curatorial areas represented" />
        <MetricCard icon="◇" value={summaryStats.classifications} label="Classification Groups" note="Object category groups" />
        <MetricCard icon="◷" value={timeSpan} label="Time Span" note="Earliest to latest dated work" />
      </section>

      <section className="preview-split">
        <TimelinePreview onJumpTimeline={onJumpTimelineRange} onOpenTimeline={onOpenTimeline} />
        <GalleryPreview onJumpDepartment={onJumpDepartment} onOpenMap={onOpenMap} />
      </section>
    </>
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
      <div>
        <span>{min < 0 ? `${Math.abs(min)} BC` : `AD ${min}`}</span>
        <span>{max < 0 ? `${Math.abs(max)} BC` : `AD ${max}`}</span>
      </div>
      <div className="dual-range">
        <div className="range-track" />
        <div className="range-fill" style={{ left: `${minPercent}%`, width: `${maxPercent - minPercent}%` }} />
        <input min={sliderMin} max={sliderMax} step="50" type="range" value={min} onChange={(e) => clamp(e.target.value, 'min')} />
        <input min={sliderMin} max={sliderMax} step="50" type="range" value={max} onChange={(e) => clamp(e.target.value, 'max')} />
      </div>
    </div>
  );
}

function ScatterPlot({ works, categoryWorks, groupBy, range, onSelectCluster, selectedClusterId, selectedArtworkId }) {
  const [minYear, maxYear] = range;
  const categories = [...new Set(categoryWorks.map((work) => work[groupBy] || 'Unknown'))].sort((a, b) => a.localeCompare(b));
  const rowGap = groupBy === 'department' ? 58 : groupBy === 'classification' ? 34 : 28;
  const svgHeight = Math.min(2200, Math.max(620, 150 + Math.max(1, categories.length - 1) * rowGap));
  const svgWidth = 2200;
  const plot = { left: 250, right: 2140, top: 34, bottom: svgHeight - 72 };
  const plotWidth = plot.right - plot.left;
  const plotHeight = plot.bottom - plot.top;
  const axisBreaks = [-5000, -1000, 0, 250, 500, 750, 1000, 1250, 1500, 1750, 2000];
  const ticks = [minYear, ...axisBreaks.filter((year) => year > minYear && year < maxYear), maxYear]
    .filter((year, index, years) => index === 0 || year !== years[index - 1]);
  const clampValue = (value, min, max) => Math.min(max, Math.max(min, value));
  const y = (cat) => plot.top + categories.indexOf(cat) * (plotHeight / Math.max(1, categories.length - 1));
  const yStep = categories.length > 1 ? plotHeight / (categories.length - 1) : rowGap;
  const formatYear = (year) => {
    if (year < 0) return `BC ${Math.abs(year)}`;
    if (year === 0) return '0';
    return `AD ${year}`;
  };
  const x = (year) => {
    const clampedYear = clampValue(year, minYear, maxYear);
    const segmentIndex = ticks.findIndex((tick, index) => clampedYear >= tick && clampedYear <= ticks[index + 1]);
    if (segmentIndex < 0 || ticks.length === 1) return plot.left;
    const start = ticks[segmentIndex];
    const end = ticks[segmentIndex + 1];
    const segmentWidth = plotWidth / (ticks.length - 1);
    const localProgress = end === start ? 0 : (clampedYear - start) / (end - start);
    return plot.left + segmentIndex * segmentWidth + localProgress * segmentWidth;
  };
  const categoryColor = (category) => categoryPalette[categories.indexOf(category) % categoryPalette.length];
  const bubbleRadius = (count) => Math.min(34, 5 + Math.sqrt(count) * 4.4);

  const groupedWorks = [...works.reduce((acc, work) => {
    const category = work[groupBy] || 'Unknown';
    const clusterYear = Math.round(work.year / 10) * 10;
    const key = `${category}-${clusterYear}`;
    if (!acc.has(key)) acc.set(key, { id: key, category, year: clusterYear, works: [] });
    acc.get(key).works.push(work);
    return acc;
  }, new Map()).values()];

  const clusters = groupedWorks.flatMap((cluster) => {
    const sortedWorks = [...cluster.works].sort((a, b) => a.year - b.year || a.title.localeCompare(b.title));
    const chunks = [];
    for (let index = 0; index < sortedWorks.length; index += 8) chunks.push(sortedWorks.slice(index, index + 8));
    return chunks.map((chunk, index) => ({ ...cluster, id: `${cluster.id}-${index}`, works: chunk }));
  }).map((cluster) => {
    const meanYear = cluster.works.reduce((sum, work) => sum + work.year, 0) / cluster.works.length;
    return { ...cluster, year: meanYear, count: cluster.works.length };
  });

  const positionedClusters = categories.flatMap((category) => {
    const rowClusters = clusters.filter((cluster) => cluster.category === category).sort((a, b) => a.year - b.year || a.id.localeCompare(b.id));
    const placed = [];
    const yLimit = Math.min(yStep * 0.42, 28);
    const yOffsets = [0, -0.25, 0.25, -0.5, 0.5, -0.75, 0.75, -1, 1].map((value) => value * yLimit);
    const xOffsets = [0, 64, -64, 128, -128, 192, -192, 256, -256, 320, -320];

    return rowClusters.map((cluster, index) => {
      const radius = bubbleRadius(cluster.count);
      const baseX = x(cluster.year);
      const baseY = y(cluster.category);
      const candidates = yOffsets.flatMap((yOffset) => xOffsets.map((xOffset) => ({
        x: clampValue(baseX + xOffset, plot.left + radius + 4, plot.right - radius - 4),
        y: clampValue(baseY + yOffset, plot.top + radius + 4, plot.bottom - radius - 4),
      })));
      const position = candidates.find((candidate) => placed.every((other) => {
        const distance = Math.hypot(candidate.x - other.x, candidate.y - other.y);
        return distance > radius + other.radius + 12;
      })) || {
        x: clampValue(baseX + ((index % 7) - 3) * 36, plot.left + radius + 4, plot.right - radius - 4),
        y: clampValue(baseY + (((index % 9) - 4) / 4) * yLimit, plot.top + radius + 4, plot.bottom - radius - 4),
      };
      placed.push({ ...position, radius });
      return { ...cluster, cx: position.x, cy: position.y, radius };
    });
  });

  return (
    <svg
      className="scatter-svg"
      style={{ '--scatter-width': `${svgWidth}px`, '--scatter-height': `${svgHeight}px` }}
      viewBox={`0 0 ${svgWidth} ${svgHeight}`}
      role="img"
      aria-label="Timeline scatter plot"
    >
      {ticks.map((tick) => {
        const gx = x(tick);
        return (
          <g key={tick}>
            <line x1={gx} x2={gx} y1={plot.top} y2={plot.bottom} />
            <text x={gx} y={plot.bottom + 32}>{formatYear(tick)}</text>
          </g>
        );
      })}
      {categories.map((cat) => (
        <g key={cat}>
          <line x1={plot.left} x2={plot.right} y1={y(cat)} y2={y(cat)} />
          <text x={plot.left - 18} y={y(cat) + 4}>{cat}</text>
        </g>
      ))}
      <text className="axis-title" x={(plot.left + plot.right) / 2} y={svgHeight - 18}>Object End Date</text>
      {positionedClusters.map((cluster) => {
        const isSelected = selectedClusterId === cluster.id || cluster.works.some((work) => work.id === selectedArtworkId);
        return (
          <g key={cluster.id} className={isSelected ? 'point-wrap selected' : 'point-wrap'}>
            {isSelected && <circle className="point-ring" cx={cluster.cx} cy={cluster.cy} r={cluster.radius + 7} />}
            <circle
              className={isSelected ? 'point bubble-point selected' : 'point bubble-point'}
              cx={cluster.cx}
              cy={cluster.cy}
              r={cluster.radius}
              fill={categoryColor(cluster.category)}
              onMouseEnter={() => onSelectCluster(cluster, false)}
              onClick={() => onSelectCluster(cluster, true)}
              onFocus={() => onSelectCluster(cluster, false)}
              tabIndex="0"
            />
            {cluster.count > 1 && <text className="bubble-count" x={cluster.cx} y={cluster.cy + 4}>{cluster.count}</text>}
          </g>
        );
      })}
    </svg>
  );
}

function ArtworkDetailCard({ artwork, onClose, isFavorite, onToggleFavorite }) {
  if (!artwork) {
    return <aside className="detail-card empty">Hover over a timeline bubble to preview artworks.</aside>;
  }

  return (
    <aside className="detail-card">
      <button type="button" className="close" onClick={onClose}>×</button>
      <FavoriteButton
        artwork={artwork}
        isFavorite={isFavorite}
        onToggleFavorite={onToggleFavorite}
        className="detail-favorite-button"
      />
      <MetArtworkImage artwork={artwork} alt={artwork.title} />
      <h2>{artwork.title}</h2>
      <p className="muted">{artwork.artist}</p>
      <dl>
        <dt>Date</dt>
        <dd>{artwork.date}</dd>
        <dt>Medium</dt>
        <dd>{artwork.medium}</dd>
      </dl>
      <p>{artwork.description}</p>
      <a href={getArtworkUrl(artwork)} target="_blank" rel="noreferrer">View on The Met Website</a>
    </aside>
  );
}

function TimelineClusterList({ cluster, onClose, selectedArtworkId, isFavorite, onToggleFavorite }) {
  if (!cluster) return null;

  return (
    <aside className="detail-card timeline-cluster-list">
      <div className="panel-head">
        <h2>{cluster.works.length > 1 ? `${cluster.works.length} Works` : 'Selected Work'}</h2>
        <button type="button" className="close" onClick={onClose}>×</button>
      </div>
      <p className="cluster-meta">
        {cluster.category} · around {cluster.year < 0 ? `${Math.round(Math.abs(cluster.year))} BCE` : `AD ${Math.round(cluster.year)}`}
      </p>
      {cluster.works.map((work) => (
        <ArtworkDetailCard
          key={work.id}
          artwork={work}
          selected={work.id === selectedArtworkId}
          onClose={onClose}
          isFavorite={isFavorite}
          onToggleFavorite={onToggleFavorite}
        />
      ))}
    </aside>
  );
}

function TimelineViewer({ target, isFavorite, onToggleFavorite }) {
  const [range, setRange] = useState([-5000, 2000]);
  const [groupBy, setGroupBy] = useState('department');
  const [selectedCluster, setSelectedCluster] = useState(null);
  const [selectedArtworkId, setSelectedArtworkId] = useState(null);
  const [pinnedCluster, setPinnedCluster] = useState(false);

  useEffect(() => {
    if (!target) return;

    // Home에서 시대 막대 클릭으로 넘어온 경우
    if (target.rangeOnly) {
      setRange([target.minYear, target.maxYear]);
      setGroupBy('department');
      setSelectedCluster(null);
      setSelectedArtworkId(null);
      setPinnedCluster(false);
      return;
    }

    // 검색에서 작품 클릭으로 넘어온 경우
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
  const activeCluster = selectedCluster && selectedCluster.works.some((clusterWork) => filtered.some((work) => work.id === clusterWork.id)) ? selectedCluster : null;

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
    <>
      <PageTitle title="Timeline Viewer" subtitle="Browse artworks by object end date and compare distribution patterns." />
      <section className="timeline-controls">
        <RangeSlider range={range} setRange={setRange} />
        <div className="filter-buttons">
          {['department', 'classification', 'culture'].map((filter) => (
            <button
              type="button"
              key={filter}
              className={groupBy === filter ? 'active' : ''}
              onClick={() => {
                setGroupBy(filter);
                setSelectedCluster(null);
                setSelectedArtworkId(null);
                setPinnedCluster(false);
              }}
            >
              {filter}
            </button>
          ))}
        </div>
      </section>
      <section className={activeCluster ? 'timeline-layout has-detail' : 'timeline-layout'}>
        <ChartPanel title={`Grouped by ${groupBy}`} headerExtra={`${filtered.length} works`}>
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
        {activeCluster && (
          <TimelineClusterList
            cluster={activeCluster}
            selectedArtworkId={selectedArtworkId}
            onClose={() => {
              setSelectedCluster(null);
              setSelectedArtworkId(null);
              setPinnedCluster(false);
            }}
            isFavorite={isFavorite}
            onToggleFavorite={onToggleFavorite}
          />
        )}
      </section>
    </>
  );
}

function FloorDetailMap({ floor, selectedRoom, onRoomSelect }) {
  const baseRooms = floorRooms[floor] || [];
  const rooms = selectedRoom && !baseRooms.includes(selectedRoom) ? [selectedRoom, ...baseRooms] : baseRooms;

  return (
    <svg className="map-svg detail" viewBox="0 0 650 720" role="img" aria-label="Gallery rooms">
      {rooms.map((room, i) => {
        const col = i % 4;
        const row = Math.floor(i / 4);
        const x = 32 + col * 150;
        const y = 34 + row * 88;
        const count = galleryArtworks[room]?.length || 0;
        return (
          <g key={room} className={selectedRoom === room ? 'map-room active' : 'map-room'} onClick={() => onRoomSelect(room)}>
            <rect x={x} y={y} width="118" height="64" rx="12" />
            <text x={x + 59} y={y + 27}>{room}</text>
            <text className="room-subtitle" x={x + 59} y={y + 47}>{count} works</text>
          </g>
        );
      })}
    </svg>
  );
}

function ArtworkListItem({ artwork, selected, isFavorite, onToggleFavorite }) {
  return (
    <article className={selected ? 'art-list-item selected' : 'art-list-item'}>
      <MetArtworkImage artwork={artwork} alt={artwork.title} />
      <div className="art-list-item-content">
        <FavoriteButton
          artwork={artwork}
          isFavorite={isFavorite}
          onToggleFavorite={onToggleFavorite}
          className="artwork-favorite-button"
        />
        <h3>{artwork.title}</h3>
        <p>{artwork.culture}</p>
        <small>{artwork.date}</small>
        <small>{artwork.medium}</small>
        <small>{artwork.accession}</small>
        <a href={getArtworkUrl(artwork)} target="_blank" rel="noreferrer">View on The Met Website</a>
      </div>
    </article>
  );
}

function ArtworkList({ room, selectedArtworkId, isFavorite, onToggleFavorite }) {
  const works = galleryArtworks[room] || timelineArtworks.slice(0, 4);

  return (
    <aside className="art-list">
      <div className="panel-head">
        <h2>Room {room}</h2>
        <span>{works.length} works</span>
      </div>
      {works.map((work) => (
        <ArtworkListItem
          key={work.id}
          artwork={work}
          selected={work.id === selectedArtworkId}
          isFavorite={isFavorite}
          onToggleFavorite={onToggleFavorite}
        />
      ))}
    </aside>
  );
}

function GalleryMap({ target, isFavorite, onToggleFavorite }) {
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
    <>
      <PageTitle title="Gallery Map" subtitle="Select a floor, choose a section, and browse artworks by gallery room." />
      <FloorSelector activeFloor={activeFloor} onFloorChange={chooseMapFloor} />
      <section className={room ? 'gallery-layout has-list' : floor ? 'gallery-layout has-rooms' : 'gallery-layout'}>
        <ChartPanel title={selectedFloor?.label || 'Floor Overview'} headerExtra={floorPlans.find((plan) => plan.id === activeFloor)?.label}>
          <FloorOverviewMap activeFloor={activeFloor} selected={floor} onSelect={chooseFloor} />
        </ChartPanel>
        {floor && (
          <ChartPanel title="Rooms" headerExtra={selectedFloor?.subtitle}>
            <FloorDetailMap
              floor={floor}
              selectedRoom={room}
              onRoomSelect={(nextRoom) => {
                setRoom(nextRoom);
                setSelectedArtworkId(null);
              }}
            />
          </ChartPanel>
        )}
        {room && (
          <ArtworkList
            room={room}
            selectedArtworkId={selectedArtworkId}
            isFavorite={isFavorite}
            onToggleFavorite={onToggleFavorite}
          />
        )}
      </section>
    </>
  );
}

function FavoritesPage({ favorites, onJumpTimeline, onJumpMap, isFavorite, onToggleFavorite }) {
  return (
    <>
      <PageTitle
        title="Favorites"
        subtitle="Review artworks saved from the timeline viewer and gallery map."
      />
      <section className="favorites-page">
        <div className="panel-head">
          <h2>Favorite Artworks</h2>
          <span>{favorites.length} saved</span>
        </div>

        {favorites.length === 0 ? (
          <div className="favorite-empty-state">
            <strong>☆</strong>
            <p>No favorite artworks yet.</p>
            <span>Use the star icon on timeline details or gallery artwork cards to save works here.</span>
          </div>
        ) : (
          <div className="favorite-list-grid">
            {favorites.map((artwork) => (
              <article className="favorite-list-item" key={artwork.id}>
                <MetArtworkImage artwork={artwork} alt={artwork.title} />
                <div>
                  <FavoriteButton
                    artwork={artwork}
                    isFavorite={isFavorite}
                    onToggleFavorite={onToggleFavorite}
                    className="favorite-page-star"
                  />
                  <h3>{artwork.title}</h3>
                  <p>{artwork.artist}</p>
                  <small>{artwork.department} · {artwork.date}</small>
                  <small>{artwork.medium}</small>
                  <div className="favorite-actions">
                    <button type="button" onClick={() => onJumpTimeline(artwork)}>Timeline</button>
                    <button type="button" onClick={() => onJumpMap(artwork)}>Map</button>
                    <a href={getArtworkUrl(artwork)} target="_blank" rel="noreferrer">Met Website</a>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState('summary');
  const [galleryTarget, setGalleryTarget] = useState(null);
  const [timelineTarget, setTimelineTarget] = useState(null);
  const [favorites, setFavorites] = useState(() => {
    try {
      const saved = window.localStorage.getItem(FAVORITES_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favorites));
    } catch {
      // Keep in-memory favorites even if localStorage is not available.
    }
  }, [favorites]);

  const isFavorite = (artworkId) => favorites.some((artwork) => String(artwork.id) === String(artworkId));

  const toggleFavorite = (artwork) => {
    setFavorites((currentFavorites) => {
      const exists = currentFavorites.some((item) => String(item.id) === String(artwork.id));
      if (exists) return currentFavorites.filter((item) => String(item.id) !== String(artwork.id));
      return [normalizeFavoriteArtwork(artwork), ...currentFavorites];
    });
  };

  const openGalleryMap = (floorId = 'floor-1', sectionId = null) => {
    setGalleryTarget({ floorId, sectionId, requestedAt: Date.now() });
    setActiveTab('map');
  };

  // Home에서 시대 막대 클릭 → Timeline 페이지로 범위 적용해서 이동
  const jumpToTimelineRange = (minYear, maxYear) => {
    setTimelineTarget({ rangeOnly: true, minYear, maxYear, requestedAt: Date.now() });
    setActiveTab('timeline');
  };

  // Home에서 부서 박스 클릭 → Gallery 페이지로 해당 부서 선택해서 이동
  const jumpToDepartment = (departmentName) => {
    const section = floorSections.find((s) => s.departments.some((d) =>
      d === departmentName || d.replace(/^The /, '') === departmentName
    ));

    setGalleryTarget({
      floorId: section?.floor || 'floor-1',
      sectionId: section?.id || null,
      requestedAt: Date.now(),
    });
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
      <Header
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onJumpTimeline={jumpToTimeline}
        onJumpMap={jumpToMap}
        favoritesCount={favorites.length}
      />
      <main className="dashboard">
        {activeTab === 'summary' && (
          <CollectionSummary
            onJumpTimelineRange={jumpToTimelineRange}
            onJumpDepartment={jumpToDepartment}
            onOpenTimeline={() => setActiveTab('timeline')}
            onOpenMap={() => setActiveTab('map')}
          />
        )}
        {activeTab === 'timeline' && (
          <TimelineViewer
            target={timelineTarget}
            isFavorite={isFavorite}
            onToggleFavorite={toggleFavorite}
          />
        )}
        {activeTab === 'map' && (
          <GalleryMap
            target={galleryTarget}
            isFavorite={isFavorite}
            onToggleFavorite={toggleFavorite}
          />
        )}
        {activeTab === 'favorites' && (
          <FavoritesPage
            favorites={favorites}
            onJumpTimeline={jumpToTimeline}
            onJumpMap={jumpToMap}
            isFavorite={isFavorite}
            onToggleFavorite={toggleFavorite}
          />
        )}
      </main>
    </div>
  );
}