import { useEffect, useMemo, useRef, useState } from 'react';

import metLogo from '../logo.png';
import {
  departmentCounts,
  galleryArtworks,
  summaryStats,
  allArtworks,
  timelineArtworks,
} from './mockData.js';
import {
  artworkDepartment,
  departmentFloor,
  deptColor,
  floorplanFloors,
  floorplanViewBox,
  galleryLocation,
  getRoomGalleries,
  getRoomMapSvg,
  pathCentroid,
  resolveDepartment,
} from './floorplan.js';

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

const TIMELINE_FILTER_SAVE_KEY = 'inside-the-met-timeline-filter-saves';

function createDefaultTimelineFilterSaves() {
  return [1, 2, 3].map((slot) => ({
    id: slot,
    name: `Filter ${slot}`,
    config: null,
  }));
}

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
            <span className="fav-star">★</span>
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
        <div className="panel-head-extra">{headerExtra || 'ⓘ'}</div>
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
      {floorplanFloors.map((floor) => (
        <button
          type="button"
          key={floor.id}
          className={activeFloor === floor.id ? 'active' : ''}
          onClick={(event) => {
            event.stopPropagation();
            onFloorChange(floor.id);
          }}
        >
          <strong>{floor.label}</strong>
          <span>{floor.departments.length} departments</span>
        </button>
      ))}
    </div>
  );
}

// 개요 도면: 외벽 + 부서 경계 폴리곤. 부서 클릭 시 세부 방 도면으로 진입.
const shortDeptLabel = (name) => {
  if (name.length <= 24) return name;
  const comma = name.split(',')[0];
  if (comma.length <= 28) return comma;
  return `${name.slice(0, 22)}…`;
};

function DepartmentFloorMap({
  floor,
  selectedDept,
  onSelectDept,
  deptCounts = null,
  dimInactive = false,
  showCounts = false,
  className = '',
}) {
  const data = floorplanFloors.find((item) => item.id === floor);
  if (!data) return null;

  const selectedDepartments = Array.isArray(selectedDept)
    ? selectedDept
    : selectedDept
      ? [selectedDept]
      : [];

  return (
    <svg className={`floorplan-svg ${className}`.trim()} viewBox={floorplanViewBox} role="img" aria-label={`${data.label} department map`}>
      <path className="floorplan-wall" d={data.outerWall} />
      {data.departments.map((dept) => {
        const color = deptColor(dept.department);
        const count = deptCounts?.[dept.department] || 0;
        const hasCount = count > 0;
        const active = selectedDepartments.includes(dept.department);
        const disabled = dimInactive && !hasCount;
        const [cx, cy] = pathCentroid(dept.paths[0]);
        const className = [
          'floorplan-dept',
          active ? 'active' : '',
          hasCount ? 'has-count' : '',
          disabled ? 'inactive' : '',
        ].filter(Boolean).join(' ');

        const handleSelect = () => {
          if (disabled) return;
          onSelectDept?.(dept.department);
        };

        return (
          <g
            key={dept.department}
            className={className}
            style={{ '--dept-color': color }}
            role="button"
            tabIndex={disabled ? '-1' : '0'}
            aria-label={showCounts ? `${dept.department}, ${count} favorite artworks` : dept.department}
            aria-disabled={disabled}
            onClick={handleSelect}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                handleSelect();
              }
            }}
          >
            {dept.paths.map((d, index) => (
              <path key={index} className="floorplan-dept-shape" d={d} />
            ))}
            <text className="floorplan-dept-label" x={cx} y={showCounts && hasCount ? cy - 7 : cy} textAnchor="middle">
              {shortDeptLabel(dept.department)}
            </text>
            {showCounts && hasCount && (
              <text className="floorplan-dept-count" x={cx} y={cy + 10} textAnchor="middle">
                {count}
              </text>
            )}
          </g>
        );
      })}
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

function ScatterPlot({
  works,
  categoryWorks,
  groupBy,
  range,
  categoryCounts,
  disabledCategories,
  onToggleCategory,
  onSelectCluster,
  selectedClusterId,
  selectedArtworkId,
}) {
  const [minYear, maxYear] = range;
  const categories = [...new Set(categoryWorks.map((work) => work[groupBy] || 'Unknown'))].sort((a, b) => a.localeCompare(b));
  const rowGap = groupBy === 'department' ? 58 : groupBy === 'classification' ? 34 : 28;
  const svgHeight = Math.min(2200, Math.max(620, 150 + Math.max(1, categories.length - 1) * rowGap));
  const svgWidth = 2200;
  const plot = { left: 365, right: 2140, top: 34, bottom: svgHeight - 72 };
  const labelTextX = plot.left - 18;
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
      {categories.map((cat) => {
        const disabled = disabledCategories?.has(cat);
        const count = categoryCounts?.get(cat) || 0;

        return (
          <g key={cat} className={disabled ? 'category-row disabled' : 'category-row'}>
            <line x1={plot.left} x2={plot.right} y1={y(cat)} y2={y(cat)} />
            <g
              className={disabled ? 'category-label-button off' : 'category-label-button on'}
              role="button"
              tabIndex="0"
              aria-label={`${disabled ? 'Show' : 'Hide'} ${cat}`}
              onClick={() => onToggleCategory?.(cat)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onToggleCategory?.(cat);
                }
              }}
            >
              <rect
                className="category-label-hitbox"
                x="8"
                y={y(cat) - 18}
                width={plot.left - 26}
                height="36"
                rx="8"
              />
              <text
                className="category-label"
                x={labelTextX}
                y={y(cat) + 4}
                textAnchor="end"
              >
                {cat} ({count})
              </text>
            </g>
          </g>
        );
      })}
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

function TimelineClusterList({ cluster, onClose, selectedArtworkId, isFavorite, onToggleFavorite, onAddFavorites }) {
  if (!cluster) return null;

  const newFavoriteCount = cluster.works.filter((work) => !isFavorite?.(work.id)).length;

  return (
    <aside className="detail-card timeline-cluster-list">
      <div className="panel-head timeline-cluster-head">
        <div>
          <h2>{cluster.works.length > 1 ? `${cluster.works.length} Works` : 'Selected Work'}</h2>
          <p className="cluster-meta">
            {cluster.category} · around {cluster.year < 0 ? `${Math.round(Math.abs(cluster.year))} BCE` : `AD ${Math.round(cluster.year)}`}
          </p>
        </div>
        <button type="button" className="close" onClick={onClose}>×</button>
      </div>
      <button
        type="button"
        className="cluster-add-favorites-button"
        disabled={newFavoriteCount === 0}
        onClick={() => onAddFavorites?.(cluster.works)}
      >
        ★ Add this cluster to favorites
        <span>{newFavoriteCount === 0 ? 'All saved' : `${newFavoriteCount} new`}</span>
      </button>
      <div className="timeline-cluster-grid">
        {cluster.works.map((work) => (
          <ArtworkListItem
            key={work.id}
            artwork={work}
            selected={work.id === selectedArtworkId}
            isFavorite={isFavorite}
            onToggleFavorite={onToggleFavorite}
          />
        ))}
      </div>
    </aside>
  );
}

function TimelineViewer({ target, isFavorite, onToggleFavorite, onAddFavorites }) {
  const [range, setRange] = useState([-5000, 2000]);
  const [groupBy, setGroupBy] = useState('department');
  const [disabledCategories, setDisabledCategories] = useState(() => new Set());
  const [selectedCluster, setSelectedCluster] = useState(null);
  const [selectedArtworkId, setSelectedArtworkId] = useState(null);
  const [pinnedCluster, setPinnedCluster] = useState(false);

  const [savedFilters, setSavedFilters] = useState(() => {
    try {
      const saved = window.localStorage.getItem(TIMELINE_FILTER_SAVE_KEY);
      const parsed = saved ? JSON.parse(saved) : null;
      if (Array.isArray(parsed) && parsed.length === 3) return parsed;
    } catch {
      // Use defaults if saved filter data is unavailable or corrupted.
    }
    return createDefaultTimelineFilterSaves();
  });

  useEffect(() => {
    if (!target) return;

    // Home에서 시대 막대 클릭으로 넘어온 경우
    if (target.rangeOnly) {
      setRange([target.minYear, target.maxYear]);
      setGroupBy('department');
      setDisabledCategories(new Set());
      setSelectedCluster(null);
      setSelectedArtworkId(null);
      setPinnedCluster(false);
      return;
    }

    // 검색에서 작품 클릭으로 넘어온 경우
    const padding = Math.max(150, Math.round(Math.abs(target.year) * 0.08));
    setRange([Math.max(-5000, target.year - padding), Math.min(2000, target.year + padding)]);
    setGroupBy('department');
    setDisabledCategories(new Set());
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

  useEffect(() => {
    try {
      window.localStorage.setItem(TIMELINE_FILTER_SAVE_KEY, JSON.stringify(savedFilters));
    } catch {
      // Keep in-memory filter saves even if localStorage is not available.
    }
  }, [savedFilters]);

  const filtered = useMemo(() => timelineArtworks.filter((work) => work.year >= range[0] && work.year <= range[1]), [range]);
  const categoryCounts = useMemo(() => filtered.reduce((counts, work) => {
    const category = work[groupBy] || 'Unknown';
    counts.set(category, (counts.get(category) || 0) + 1);
    return counts;
  }, new Map()), [filtered, groupBy]);
  const timelineCategories = useMemo(
    () => Array.from(categoryCounts.keys()).sort((a, b) => a.localeCompare(b)),
    [categoryCounts],
  );
  const visibleFiltered = useMemo(
    () => filtered.filter((work) => !disabledCategories.has(work[groupBy] || 'Unknown')),
    [filtered, disabledCategories, groupBy],
  );
  const activeCluster = selectedCluster
    && !disabledCategories.has(selectedCluster.category)
    && selectedCluster.works.some((clusterWork) => visibleFiltered.some((work) => work.id === clusterWork.id))
    ? selectedCluster
    : null;

  const visibleNewFavoriteCount = useMemo(
    () => visibleFiltered.filter((work) => !isFavorite?.(work.id)).length,
    [visibleFiltered, isFavorite],
  );

  const toggleCategory = (category) => {
    setDisabledCategories((current) => {
      const next = new Set(current);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });

    if (selectedCluster?.category === category) {
      setSelectedCluster(null);
      setSelectedArtworkId(null);
      setPinnedCluster(false);
    }
  };

  const showAllCategories = () => {
    setDisabledCategories(new Set());
  };

  const hideAllCategories = () => {
    setDisabledCategories(new Set(timelineCategories));
    setSelectedCluster(null);
    setSelectedArtworkId(null);
    setPinnedCluster(false);
  };

  const renameSavedFilter = (slotId, name) => {
    setSavedFilters((current) => current.map((slot) => (
      slot.id === slotId ? { ...slot, name } : slot
    )));
  };

  const saveCurrentFilter = (slotId) => {
    setSavedFilters((current) => current.map((slot) => (
      slot.id === slotId
        ? {
            ...slot,
            config: {
              range,
              groupBy,
              disabledCategories: Array.from(disabledCategories),
            },
          }
        : slot
    )));
  };

  const loadSavedFilter = (slot) => {
    if (!slot.config) return;

    setRange(slot.config.range || [-5000, 2000]);
    setGroupBy(slot.config.groupBy || 'department');
    setDisabledCategories(new Set(slot.config.disabledCategories || []));
    setSelectedCluster(null);
    setSelectedArtworkId(null);
    setPinnedCluster(false);
  };

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
      <section className="timeline-top-actions">
        <section className="timeline-bulk-favorite-card" aria-label="Save filtered timeline artworks">
        <div>
          <strong>Save current timeline view</strong>
          <span>{visibleFiltered.length} visible works · {visibleNewFavoriteCount} not yet saved</span>
        </div>
        <button
          type="button"
          disabled={visibleNewFavoriteCount === 0}
          onClick={() => onAddFavorites?.(visibleFiltered)}
        >
          ★ Add visible works to favorites
        </button>
        </section>
        <section className="timeline-filter-save-panel" aria-label="Saved timeline filters">
        <div className="timeline-filter-save-title">
          <strong>Saved filters</strong>
          <span>Save or reload the current timeline filter setup.</span>
        </div>
        <div className="timeline-filter-save-grid">
          {savedFilters.map((slot) => (
            <div className="timeline-filter-save-slot" key={slot.id}>
              <input
                value={slot.name}
                onChange={(event) => renameSavedFilter(slot.id, event.target.value)}
                aria-label={`Filter ${slot.id} name`}
              />
              <button
                type="button"
                onClick={() => saveCurrentFilter(slot.id)}
                disabled={visibleFiltered.length === 0}
                title={visibleFiltered.length === 0 ? 'No visible artworks to save as a filter' : 'Save current filter'}
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => loadSavedFilter(slot)}
                disabled={!slot.config}
                title={slot.config ? 'Load saved filter' : 'No saved filter in this slot'}
              >
                Load
              </button>
            </div>
          ))}
        </div>
        </section>
      </section>
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
                setDisabledCategories(new Set());
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
        <ChartPanel
          title={`Grouped by ${groupBy}`}
          headerExtra={
            <div className="timeline-header-tools">
              <span>{visibleFiltered.length} / {filtered.length} works visible</span>
              <span className="timeline-header-divider" aria-hidden="true" />
              <span className="timeline-toggle-help">Click a label to show/hide groups.</span>
              <div className="timeline-toggle-actions">
                <button type="button" onClick={showAllCategories}>Show all</button>
                <button type="button" onClick={hideAllCategories}>Hide all</button>
              </div>
            </div>
          }
        >
          <ScatterPlot
            works={visibleFiltered}
            categoryWorks={timelineArtworks}
            groupBy={groupBy}
            range={range}
            categoryCounts={categoryCounts}
            disabledCategories={disabledCategories}
            onToggleCategory={toggleCategory}
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
            onAddFavorites={onAddFavorites}
          />
        )}
      </section>
    </>
  );
}

// 세부 도면: 부서별로 미리 그려진 방 단위 SVG 문자열을 그대로 렌더하고,
// 클릭/하이라이트는 data-gallery 속성을 통해 위임 처리한다.
function RoomDetailMap({ svg, selectedRoom, onRoomSelect, galleriesWithWorks }) {
  const containerRef = useRef(null);

  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    root.querySelectorAll('[data-gallery]').forEach((node) => {
      const gallery = node.getAttribute('data-gallery');
      const hasWorks = galleriesWithWorks.has(gallery);
      node.classList.toggle('has-works', hasWorks);
      node.classList.toggle('empty', !hasWorks);
      node.classList.toggle('selected', gallery === selectedRoom);
    });
  }, [svg, selectedRoom, galleriesWithWorks]);

  const handleClick = (event) => {
    const node = event.target.closest?.('[data-gallery]');
    if (!node) return;
    const gallery = node.getAttribute('data-gallery');
    if (galleriesWithWorks.has(gallery)) onRoomSelect(gallery);
  };

  return (
    <div
      ref={containerRef}
      className="room-detail-map"
      onClick={handleClick}
      // 데이터는 신뢰할 수 있는 로컬 도면 파일이며, 사용자 입력이 아니다.
      dangerouslySetInnerHTML={{ __html: svg }}
    />
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
        {/* 기본 표시: 작품 이름 · 작가 · 연도 */}
        <h3>{artwork.title}</h3>
        <p className="art-item-artist">{artwork.artist}</p>
        <small className="art-item-year">{artwork.date}</small>
        {/* hover/선택 시 펼쳐지는 상세 정보 (라벨: 값 형식) */}
        <div className="art-item-details">
          <small><span className="art-item-label">Culture:</span> {artwork.culture}</small>
          <small><span className="art-item-label">Department:</span> {artwork.department}</small>
          <small><span className="art-item-label">Gallery:</span> {artwork.galleryNumber ? artwork.galleryNumber : 'Not on display'}</small>
          <small><span className="art-item-label">Medium:</span> {artwork.medium}</small>
          <small><span className="art-item-label">Accession:</span> {artwork.accession}</small>
          <a href={getArtworkUrl(artwork)} target="_blank" rel="noreferrer">View on The Met Website</a>
        </div>
      </div>
    </article>
  );
}

function ArtworkList({ room, selectedArtworkId, isFavorite, onToggleFavorite, onAddFavorites, onBack, worksOverride = null }) {
  const works = worksOverride || galleryArtworks[room] || timelineArtworks.slice(0, 4);
  const newFavoriteCount = works.filter((work) => !isFavorite?.(work.id)).length;

  return (
    <aside className="art-list">
      {onBack && (
        <button type="button" className="art-list-back" onClick={onBack}>
          <span aria-hidden="true">←</span> Back to the map
        </button>
      )}
      <div className="panel-head map-list-head">
        <div>
          <h2>Room {room}</h2>
          <span>{works.length} works</span>
        </div>
        <button
          type="button"
          className="map-bulk-favorite-button"
          disabled={newFavoriteCount === 0}
          onClick={() => onAddFavorites?.(works)}
        >
          ★ Add room
          <span>{newFavoriteCount === 0 ? 'All saved' : `${newFavoriteCount} new`}</span>
        </button>
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

function GalleryMap({ target, isFavorite, onToggleFavorite, onAddFavorites }) {
  const [activeFloor, setActiveFloor] = useState('1');
  const [selectedDept, setSelectedDept] = useState(null);
  const [room, setRoom] = useState(null);
  const [selectedArtworkId, setSelectedArtworkId] = useState(null);

  // 작품-부서 매칭은 CSV의 Department가 아니라 "갤러리 번호가 현재 보고 있는
  // 층·부서의 방 지도에 들어있는지"로 판정한다. CSV는 유럽 회화를 한 부서로 묶지만
  // 도면은 시대별로 쪼개져 있어(600번대 vs 800번대) 부서명 매칭은 깨진다.
  const roomGalleries = useMemo(
    () => (selectedDept ? getRoomGalleries(activeFloor, selectedDept) : new Set()),
    [activeFloor, selectedDept],
  );
  const selectedDeptWorks = useMemo(
    () => (selectedDept ? allArtworks.filter((work) => roomGalleries.has(String(work.galleryNumber))) : []),
    [selectedDept, roomGalleries],
  );

  // 현재 층의 부서별 작품 수 (갤러리 기준). 작품 없는 부서는 개요 도면에서 흐리게 처리한다.
  const floorDeptCounts = useMemo(() => {
    const floor = floorplanFloors.find((item) => item.id === activeFloor);
    if (!floor) return {};
    return floor.departments.reduce((counts, dept) => {
      const galleries = getRoomGalleries(activeFloor, dept.department);
      counts[dept.department] = allArtworks.filter((work) => galleries.has(String(work.galleryNumber))).length;
      return counts;
    }, {});
  }, [activeFloor]);
  const galleriesWithWorks = useMemo(
    () => new Set(selectedDeptWorks.map((work) => String(work.galleryNumber))),
    [selectedDeptWorks],
  );

  useEffect(() => {
    if (!target) return;
    setActiveFloor(target.floorId || '1');
    setSelectedDept(target.department || null);
    setRoom(target.room || null);
    setSelectedArtworkId(target.artworkId || null);
  }, [target]);

  const chooseFloor = (id) => {
    setActiveFloor(id);
    setSelectedDept(null);
    setRoom(null);
    setSelectedArtworkId(null);
  };

  const chooseDept = (department) => {
    setSelectedDept(department);
    setRoom(null);
    setSelectedArtworkId(null);
  };

  const floorMeta = floorplanFloors.find((item) => item.id === activeFloor);
  const roomSvg = selectedDept ? getRoomMapSvg(activeFloor, selectedDept) : null;
  const selectedDeptNewFavoriteCount = selectedDeptWorks.filter((work) => !isFavorite?.(work.id)).length;
  const selectedRoomWorks = useMemo(
    () => (room ? selectedDeptWorks.filter((work) => String(work.galleryNumber) === String(room)) : []),
    [room, selectedDeptWorks],
  );

  return (
    <>
      <PageTitle title="Gallery Map" subtitle="Select a floor, choose a department, then browse artworks room by room." />
      <FloorSelector activeFloor={activeFloor} onFloorChange={chooseFloor} />
      <section className={room ? 'gallery-layout has-list' : selectedDept ? 'gallery-layout has-rooms' : 'gallery-layout'}>
        {/* 방을 선택하면 메인 층 도면은 숨기고 방 도면 + 작품 목록만 보여준다. */}
        {!room && (
          <ChartPanel
            title={floorMeta?.label || 'Floor Overview'}
            headerExtra={selectedDept || `${floorMeta?.departments.length || 0} departments`}
          >
            <DepartmentFloorMap
              floor={activeFloor}
              selectedDept={selectedDept}
              onSelectDept={chooseDept}
              deptCounts={floorDeptCounts}
              dimInactive
            />
          </ChartPanel>
        )}
        {selectedDept && (
          <ChartPanel
            title={selectedDept}
            headerExtra={(
              <button
                type="button"
                className="map-bulk-favorite-button"
                disabled={selectedDeptNewFavoriteCount === 0}
                onClick={() => onAddFavorites?.(selectedDeptWorks)}
              >
                ★ Add department
                <span>{selectedDeptNewFavoriteCount === 0 ? 'All saved' : `${selectedDeptNewFavoriteCount} new`}</span>
              </button>
            )}
          >
            {roomSvg ? (
              <RoomDetailMap
                svg={roomSvg}
                selectedRoom={room}
                galleriesWithWorks={galleriesWithWorks}
                onRoomSelect={(nextRoom) => {
                  setRoom(nextRoom);
                  setSelectedArtworkId(null);
                }}
              />
            ) : (
              <div className="map-empty-note">No detailed room map for this department.</div>
            )}
          </ChartPanel>
        )}
        {room && (
          <ArtworkList
            room={room}
            selectedArtworkId={selectedArtworkId}
            isFavorite={isFavorite}
            onToggleFavorite={onToggleFavorite}
            onAddFavorites={onAddFavorites}
            worksOverride={selectedRoomWorks}
            onBack={() => {
              setRoom(null);
              setSelectedArtworkId(null);
            }}
          />
        )}
      </section>
    </>
  );
}

function FavoritesPage({ favorites, onJumpTimeline, onJumpMap, isFavorite, onToggleFavorite, onClearFavorites }) {
  const [showFavoriteMap, setShowFavoriteMap] = useState(false);
  const [selectedFavoriteDepts, setSelectedFavoriteDepts] = useState([]);
  const [selectedFavoriteFloor, setSelectedFavoriteFloor] = useState('1');

  const favoriteDeptCounts = useMemo(() => {
    return favorites.reduce((counts, artwork) => {
      const resolvedDept = artworkDepartment(artwork);
      if (!resolvedDept) return counts;
      counts[resolvedDept] = (counts[resolvedDept] || 0) + 1;
      return counts;
    }, {});
  }, [favorites]);

  const selectedFavoriteDeptSet = useMemo(
    () => new Set(selectedFavoriteDepts),
    [selectedFavoriteDepts],
  );

  const visibleFavorites = useMemo(() => {
    if (selectedFavoriteDeptSet.size === 0) return favorites;

    return favorites.filter((artwork) => {
      const resolvedDept = artworkDepartment(artwork);
      return selectedFavoriteDeptSet.has(resolvedDept);
    });
  }, [favorites, selectedFavoriteDeptSet]);

  useEffect(() => {
    setSelectedFavoriteDepts((current) => current.filter((dept) => favoriteDeptCounts[dept] > 0));
  }, [favoriteDeptCounts]);

  useEffect(() => {
    if (favorites.length === 0) {
      setShowFavoriteMap(false);
      setSelectedFavoriteDepts([]);
      setSelectedFavoriteFloor('1');
    }
  }, [favorites.length]);

  const toggleFavoriteDept = (department) => {
    if (!favoriteDeptCounts[department]) return;

    setSelectedFavoriteDepts((current) => (
      current.includes(department)
        ? current.filter((dept) => dept !== department)
        : [...current, department]
    ));
  };

  const hideFavoriteMap = () => {
    setShowFavoriteMap(false);
    setSelectedFavoriteDepts([]);
    setSelectedFavoriteFloor('1');
  };

  const favoriteFloorMeta = floorplanFloors.find((floor) => floor.id === selectedFavoriteFloor) || floorplanFloors[0];
  const selectedFavoriteFloorCount = favoriteFloorMeta
    ? favoriteFloorMeta.departments.reduce((sum, dept) => sum + (favoriteDeptCounts[dept.department] || 0), 0)
    : 0;

  const mapSummary = selectedFavoriteDepts.length > 0
    ? `${visibleFavorites.length} shown from ${selectedFavoriteDepts.length} selected departments`
    : `${favorites.length} saved artworks across ${Object.keys(favoriteDeptCounts).length} mapped departments`;

  return (
    <>
      <PageTitle
        title="Favorites"
        subtitle="Review artworks saved from the timeline viewer and gallery map."
      />
      <section className={showFavoriteMap ? 'favorites-page map-open' : 'favorites-page'}>
        <div className="panel-head favorites-panel-head">
          <h2>Favorite Artworks</h2>
          <div className="favorites-header-actions">
            <span>{showFavoriteMap ? mapSummary : `${favorites.length} saved`}</span>
            {favorites.length > 0 && (
              <button
                type="button"
                className="favorite-map-toggle-button"
                onClick={() => (showFavoriteMap ? hideFavoriteMap() : setShowFavoriteMap(true))}
              >
                {showFavoriteMap ? 'Hide map' : 'View on map'}
              </button>
            )}
            {favorites.length > 0 && (
              <button
                type="button"
                className="clear-favorites-button"
                onClick={onClearFavorites}
              >
                Clear all
              </button>
            )}
          </div>
        </div>

        {favorites.length === 0 ? (
          <div className="favorite-empty-state">
            <strong>☆</strong>
            <p>No favorite artworks yet.</p>
            <span>Use the star icon on timeline details or gallery artwork cards to save works here.</span>
          </div>
        ) : (
          <div className={showFavoriteMap ? 'favorites-map-layout' : 'favorites-map-layout list-only'}>
            <div className="favorites-list-area">
              {showFavoriteMap && selectedFavoriteDepts.length > 0 && (
                <div className="favorite-filter-strip">
                  <span>{selectedFavoriteDepts.join(' + ')}</span>
                  <button type="button" onClick={() => setSelectedFavoriteDepts([])}>Show all</button>
                </div>
              )}
              <div className="favorite-list-grid">
                {visibleFavorites.map((artwork) => (
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
            </div>

            {showFavoriteMap && (
              <aside className="favorite-map-panel" aria-label="Favorite artworks by department map">
                <div className="favorite-map-head">
                  <div>
                    <h3>Favorite Department Map</h3>
                    <p>Bright departments contain saved artworks. Click departments to filter the list.</p>
                  </div>
                  <button type="button" onClick={hideFavoriteMap}>Hide map</button>
                </div>
                <div className="favorite-floor-tabs" role="tablist" aria-label="Favorite map floor selector">
                  {floorplanFloors.map((floor) => {
                    const floorCount = floor.departments.reduce((sum, dept) => sum + (favoriteDeptCounts[dept.department] || 0), 0);
                    return (
                      <button
                        type="button"
                        key={floor.id}
                        className={selectedFavoriteFloor === floor.id ? 'active' : ''}
                        onClick={() => setSelectedFavoriteFloor(floor.id)}
                      >
                        <strong>{floor.label}</strong>
                        <span>{floorCount} works</span>
                      </button>
                    );
                  })}
                </div>
                <div className="favorite-map-floors">
                  {favoriteFloorMeta && (
                    <div className="favorite-floor-card" key={favoriteFloorMeta.id}>
                      <div className="favorite-floor-title">
                        <strong>{favoriteFloorMeta.label}</strong>
                        <span>{selectedFavoriteFloorCount} works</span>
                      </div>
                      <DepartmentFloorMap
                        floor={favoriteFloorMeta.id}
                        selectedDept={selectedFavoriteDepts}
                        onSelectDept={toggleFavoriteDept}
                        deptCounts={favoriteDeptCounts}
                        dimInactive
                        showCounts
                        className="favorite-floorplan-svg"
                      />
                    </div>
                  )}
                </div>
              </aside>
            )}
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

  const addFavorites = (artworks = []) => {
    setFavorites((currentFavorites) => {
      const existingIds = new Set(currentFavorites.map((item) => String(item.id)));
      const additions = artworks
        .filter((artwork) => !existingIds.has(String(artwork.id)))
        .map(normalizeFavoriteArtwork);

      if (additions.length === 0) return currentFavorites;
      return [...additions, ...currentFavorites];
    });
  };

  const clearFavorites = () => {
    setFavorites([]);
  };

  // Home에서 시대 막대 클릭 → Timeline 페이지로 범위 적용해서 이동
  const jumpToTimelineRange = (minYear, maxYear) => {
    setTimelineTarget({ rangeOnly: true, minYear, maxYear, requestedAt: Date.now() });
    setActiveTab('timeline');
  };

  // Home에서 부서 박스 클릭 → Gallery 페이지로 해당 부서 도면을 펼쳐서 이동
  const jumpToDepartment = (departmentName) => {
    const resolved = resolveDepartment(departmentName);
    setGalleryTarget({
      floorId: (resolved && departmentFloor[resolved]) || '1',
      department: resolved,
      requestedAt: Date.now(),
    });
    setActiveTab('map');
  };

  const jumpToTimeline = (artwork) => {
    setTimelineTarget({ ...artwork, requestedAt: Date.now() });
    setActiveTab('timeline');
  };

  // 작품 → Gallery 페이지: 갤러리 번호로 층/부서/방을 찾아 해당 방까지 펼친다.
  const jumpToMap = (artwork) => {
    const gallery = artwork.galleryNumber;
    const location = galleryLocation[gallery];
    const resolvedDept = location?.department || resolveDepartment(artwork.department);
    setGalleryTarget({
      floorId: location?.floor || (resolvedDept && departmentFloor[resolvedDept]) || '1',
      department: resolvedDept || null,
      room: location ? gallery : null,
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
            onAddFavorites={addFavorites}
          />
        )}
        {activeTab === 'map' && (
          <GalleryMap
            target={galleryTarget}
            isFavorite={isFavorite}
            onToggleFavorite={toggleFavorite}
            onAddFavorites={addFavorites}
          />
        )}
        {activeTab === 'favorites' && (
          <FavoritesPage
            favorites={favorites}
            onJumpTimeline={jumpToTimeline}
            onJumpMap={jumpToMap}
            isFavorite={isFavorite}
            onToggleFavorite={toggleFavorite}
            onClearFavorites={clearFavorites}
          />
        )}
      </main>
    </div>
  );
}