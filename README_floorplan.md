# Met Museum Department Floor Map — Data Guide

방문객이 "어느 구역에 어떤 부서가 있는지" 한눈에 보고, 부서를 클릭하면 그 부서의 작품을 탐색할 수 있게 하는 **부서 경계 지도** 데이터입니다.

파일: `met_floorplan_departments.json` (~7 KB)

> 색·테마 등 스타일은 이 파일에 포함하지 않습니다. 프로젝트의 스타일 파일에서 부서 이름을 키로 색을 지정해 적용하세요.

---

## 1. 한눈에 보는 구조

```jsonc
{
  "meta": {
    "viewBox": "0 0 1000 545",      // 모든 floor 공통 좌표계
    "recommended_style": { ... }
  },
  "floors": {
    "1":  { "label": "Floor 1", "viewBox": "...", "outer_wall": "M...Z", "departments": [ ... ] },
    "1M": { "label": "Floor 1M (Mezzanine)", "outer_wall": "M...Z", "departments": [] },
    "2":  { "label": "Floor 2", "outer_wall": "M...Z", "departments": [ ... ] },
    "3":  { "label": "Floor 3", "outer_wall": "M...Z", "departments": [] }
  }
}
```

각 floor는 두 가지로 그려집니다.

| 레이어 | 필드 | 설명 |
|--------|------|------|
| **건물 외벽** | `outer_wall` | SVG path 문자열 1개. 건물 전체 윤곽선. **네 floor가 모두 동일** (같은 건물이므로). |
| **부서 구역** | `departments[]` | 부서별 경계 폴리곤. 이게 메인 레이어. |

`departments[]`의 각 항목:

```jsonc
{
  "department": "Egyptian Art",   // 부서 이름 (스타일 파일에서 이 이름으로 색 매칭)
  "paths": ["M...Z", ...]         // 경계 폴리곤 (보통 1개, 떨어진 구역이면 여러 개)
}
```

> **핵심 설계**: 부서 내부의 자잘한 방 구획선은 **모두 제거**했습니다. 화면에는 외벽 + 부서 경계만 남아 깔끔합니다. 같은 부서의 여러 블록은 union 처리해 내부 선 없이 하나의 외곽선으로 그려집니다.

---

## 2. 좌표계 (중요)

- 모든 floor가 **`viewBox="0 0 1000 545"`** 하나를 공유합니다.
- 따라서 floor를 바꿔도 건물은 **같은 자리에 고정**됩니다. SVG `viewBox`만 그대로 두고 path만 교체하면 됩니다.
- 원본 Met 공식 지도(maps.metmuseum.org)를 픽셀 트레이싱해 만든 좌표라, 실제 건물 비율과 위치가 반영돼 있습니다.

---

## 3. 가장 작은 렌더링 예제 (순수 SVG)

```html
<svg viewBox="0 0 1000 545" xmlns="http://www.w3.org/2000/svg">
  <!-- 건물 외벽 -->
  <path d="{floor.outer_wall}" fill="none" stroke-width="1"/>

  <!-- 부서들: 각 department, 각 path 마다. 색은 스타일 파일에서 부여 -->
  <path d="{path}" class="dept" data-department="{dept.department}"/>
</svg>
```

권장 스타일 (`meta.recommended_style`):
- 외벽: `fill: none; stroke-width: 1;`
- 부서: `fill-opacity: 0.25~0.3; stroke-width: 2;` + 중앙 라벨
- 색상은 프로젝트 스타일 파일에서 부서 이름(`data-department`)으로 지정

---

## 4. React + D3 통합 예제

```jsx
import { useState } from "react";
import floorData from "./met_floorplan_departments.json";
// 색은 프로젝트 스타일 파일에서 부서 이름으로 가져옴
import { deptColor } from "./styles/departmentColors";

function MetFloorMap({ onDepartmentClick }) {
  const [floor, setFloor] = useState("1");
  const f = floorData.floors[floor];

  return (
    <div>
      {/* floor 전환 */}
      <div className="floor-tabs">
        {Object.keys(floorData.floors).map((key) => (
          <button
            key={key}
            onClick={() => setFloor(key)}
            aria-pressed={key === floor}
          >
            {floorData.floors[key].label}
          </button>
        ))}
      </div>

      <svg viewBox={floorData.meta.viewBox} width="100%">
        {/* 건물 외벽 */}
        <path d={f.outer_wall} fill="none" stroke="#3a4252" strokeWidth={1} />

        {/* 부서 구역 */}
        {f.departments.map((dept) =>
          dept.paths.map((d, i) => (
            <path
              key={`${dept.department}-${i}`}
              d={d}
              fill={deptColor(dept.department)}   // ← 스타일 파일에서
              fillOpacity={0.28}
              stroke={deptColor(dept.department)}
              strokeWidth={2}
              style={{ cursor: "pointer" }}
              onClick={() => onDepartmentClick(dept.department)}
            >
              <title>{dept.department}</title>
            </path>
          ))
        )}

        {/* 부서 라벨 (각 부서 첫 path의 무게중심) */}
        {f.departments.map((dept) => {
          const [cx, cy] = centroid(dept.paths[0]);
          return (
            <text
              key={dept.department}
              x={cx} y={cy}
              textAnchor="middle"
              fontSize={9} fontWeight={700}
              fill={deptColor(dept.department)}
              pointerEvents="none"
            >
              {dept.department}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

// path 문자열에서 대략적인 무게중심 구하기
function centroid(pathStr) {
  const nums = pathStr.match(/-?\d+\.?\d*/g).map(Number);
  let sx = 0, sy = 0, n = 0;
  for (let i = 0; i < nums.length - 1; i += 2) {
    sx += nums[i]; sy += nums[i + 1]; n++;
  }
  return [sx / n, sy / n];
}
```

---

## 5. 부서 클릭 → 작품 불러오기

부서를 클릭하면, 그 부서의 **갤러리 번호 범위**로 CSV(`MetObjects_highlights_publicdomain_categorized.csv`)를 필터링하면 됩니다. 작품 데이터의 `Gallery Number` 열을 기준으로요.

### 부서별 갤러리 번호 범위

**Floor 1**

| 부서 | 갤러리 번호 |
|------|------------|
| Egyptian Art | 100–138 |
| Greek and Roman Art | 150–172 |
| Medieval Art | 300–307 |
| Michael C. Rockefeller Wing | 340–364 |
| Arms and Armor | 370–380 |
| European Sculpture and Decorative Arts | 500–556 |
| The American Wing | 700–746 |
| Modern and Contemporary Art | 900–913 |
| Robert Lehman Collection | 950–962 |

**Floor 2**

| 부서 | 갤러리 번호 |
|------|------------|
| Art of Ancient West Asia and the Art of Ancient Cyprus | 175–176, 400–405 |
| Asian Art | 200–252 |
| Art of the Arab Lands, Turkey, Iran, Central Asia, and Later South Asia | 450–464 |
| European Paintings, 1250–1800 | 600–644 |
| Musical Instruments | 680–684 |
| The American Wing | 700–772 |
| 19th and Early 20th Century European Paintings and Sculpture | 800–852 |
| Modern and Contemporary Art | 917–925 |

> The American Wing와 Modern은 두 floor에 걸쳐 있어 floor마다 번호대가 다릅니다 (위 표 참고).

### 필터링 예시 (JS)

```js
// 부서 → 갤러리 번호 매칭 헬퍼
const DEPT_GALLERIES = {
  "Egyptian Art": (g) => g >= 100 && g <= 138,
  "Greek and Roman Art": (g) => g >= 150 && g <= 172,
  "Asian Art": (g) => g >= 200 && g <= 252,
  "Art of Ancient West Asia and the Art of Ancient Cyprus":
    (g) => (g >= 175 && g <= 176) || (g >= 400 && g <= 405),
  // ... 나머지 부서도 위 표대로 추가
};

function artworksFor(department, rows) {
  const match = DEPT_GALLERIES[department];
  return rows.filter((r) => {
    const g = parseInt(r["Gallery Number"], 10);
    return Number.isFinite(g) && match(g);
  });
}
```

> The American Wing은 floor별로 700번대가 겹치므로, 클릭한 floor에 따라 상한(746 vs 772)을 다르게 적용하세요.

---

## 6. 부서 클릭 시 줌(확대) 처리

부서 path의 bounding box를 구해 SVG `viewBox`를 그 영역으로 좁히면 확대 효과가 납니다.

```js
function bbox(paths) {
  const nums = paths.join(" ").match(/-?\d+\.?\d*/g).map(Number);
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let i = 0; i < nums.length - 1; i += 2) {
    minX = Math.min(minX, nums[i]);     maxX = Math.max(maxX, nums[i]);
    minY = Math.min(minY, nums[i + 1]); maxY = Math.max(maxY, nums[i + 1]);
  }
  const pad = 20;
  return `${minX - pad} ${minY - pad} ${maxX - minX + 2 * pad} ${maxY - minY + 2 * pad}`;
}

// 사용: setViewBox(bbox(dept.paths)) → SVG의 viewBox 속성에 적용
// 전체 보기 복귀: setViewBox("0 0 1000 545")
```

CSS `transition`을 viewBox 변경과 함께 쓰면 부드러운 줌 애니메이션이 됩니다 (또는 D3 `d3.interpolate`로 viewBox 보간).

---

## 7. floor 1M·3 안내

- `floors["1M"]`, `floors["3"]`는 **외벽만** 있고 `departments`는 빈 배열입니다.
- 이 두 층은 데이터에 포함된 작품이 있는 갤러리가 거의 없어, 부서 구역을 따로 그리지 않았습니다.
- floor 전환 UI에는 표시하되, 선택 시 "이 층에는 표시할 부서 데이터가 없습니다" 안내를 띄우거나 비활성화하면 됩니다.

---

## 8. 데이터 출처 & 한계

- **출처**: maps.metmuseum.org 공식 floor map을 픽셀 트레이싱.
- **부서 경계**: 지도에 인쇄된 부서 라벨과 갤러리 번호를 직접 읽어 손으로 트레이싱한 뒤, 같은 부서 블록을 union으로 병합.
- **검증 완료**: 부서 간 겹침 0, 외벽 밖으로 나가는 부서 0 (point-in-polygon 검사).
- **외벽**: 네 floor 모두 동일한 건물 외곽선 하나를 공유합니다 (물리적으로 같은 건물).
- **한계**:
  - 실제 Met 공식 부서 경계와 100% 일치하지는 않습니다. 각 부서가 차지하는 영역을 충실히 반영한 근사치입니다.
  - 경계는 갤러리 번호 위치 기준이라, 부서 사이 복도/계단 등 공용 공간은 인접 부서 중 한쪽에 포함될 수 있습니다.
  - European Sculpture는 가운데 Medieval Art 구역에 막혀 두 덩어리로 분리돼 있습니다 (`paths` 2개). 의도된 결과입니다.

---

## 9. 부서 목록

**Floor 1** (9): Egyptian Art · Greek and Roman Art · Medieval Art · Michael C. Rockefeller Wing · Arms and Armor · European Sculpture and Decorative Arts · The American Wing · Modern and Contemporary Art · Robert Lehman Collection

**Floor 2** (8): Asian Art · The American Wing · 19th and Early 20th Century European Paintings and Sculpture · European Paintings, 1250–1800 · Musical Instruments · Art of Ancient West Asia and the Art of Ancient Cyprus · Art of the Arab Lands, Turkey, Iran, Central Asia, and Later South Asia · Modern and Contemporary Art

> 색상은 프로젝트 스타일 파일에서 위 부서 이름을 키로 지정하세요.
