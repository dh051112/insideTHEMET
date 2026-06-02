# Met Floor Plan — Department Map Data

`met_floorplan_departments.json` — The Met의 공식 지도(maps.metmuseum.org)를 기반으로,
실제 건물 스케일 위에 **부서(department) 경계**를 그린 데이터입니다. 4개 층 모두 포함.

---

## 무엇인가

The Met 건물을 부서 단위로 구분한 지도 데이터입니다. 두 개의 레이어로 구성됩니다.

1. **walls** — 건물 외곽선 + 개별 갤러리 방 경계선. 공식 지도 스크린샷을 픽셀 단위로
   트레이싱한 것으로, 옅은 회색 컨텍스트 라인으로 깔기 위한 용도입니다.
2. **departments** — 부서별 구역 경계 폴리곤. 같은 부서에 속한 갤러리들을 하나의
   영역으로 묶어 경계선만 그린 것으로, 이 지도의 메인 레이어입니다.

세부 지도(방 하나하나 색칠)가 아니라 **"여기는 Egyptian, 여기는 Greek/Roman"처럼
부서가 구분된 지도**입니다.

---

## 파일 구조

```jsonc
{
  "meta": {
    "viewBox": "0 0 1000 545",        // 모든 층 공통
    "colors": { "Egyptian Art": "#BA7517", ... },   // 부서 → 색상 (15개)
    "recommended_style": "...",
    ...
  },
  "floors": {
    "1":  { "label": "Floor 1",  "viewBox": "0 0 1000 545",
            "walls": [ "M...Z", ... ],          // 302개 path 문자열
            "departments": [ ... ] },           // 9개 부서
    "1M": { "label": "Floor 1M (Mezzanine)", "walls": [...], "departments": [] },
    "2":  { "label": "Floor 2",  "walls": [...], "departments": [ ... ] },  // 8개 부서
    "3":  { "label": "Floor 3",  "walls": [...], "departments": [] }
  }
}
```

각 `departments[]` 항목:

```jsonc
{
  "department": "Egyptian Art",   // 부서 이름
  "color": "#BA7517",             // 색상 (meta.colors와 동일)
  "paths": [ "M563,355 810,355 ...Z", "M755,300 ...Z" ]  // 1개 이상의 SVG path
}
```

> 한 부서가 떨어진 여러 구역으로 나뉘면 `paths`에 여러 개가 들어갑니다.
> 예: Egyptian Art는 메인 그리드 + Temple of Dendur(131) 별실로 2개, Asian Art는 3개.

---

## 층별 내용

| 층 | walls | departments | 비고 |
|---|---|---|---|
| **Floor 1** | 302 | 9 | Egyptian, Greek/Roman, Rockefeller Wing, Modern, European Sculpture, Medieval, Arms & Armor, American Wing(L자), Lehman(다이아몬드) |
| **Floor 1M** | 52 | 0 | 갤러리 거의 없음 — walls만 |
| **Floor 2** | 213 | 8 | Modern, 19th C European, European Paintings, Musical Instruments, American Wing, Asian Art, Ancient West Asia, Arab Lands |
| **Floor 3** | 38 | 0 | 갤러리 거의 없음 — walls만 |

---

## 좌표계

- 모든 층이 `viewBox="0 0 1000 545"`로 **동일**합니다.
- 네 장의 스크린샷이 같은 viewport였기 때문에, **건물이 모든 층에서 같은 픽셀 위치**에
  있습니다. 층을 전환해도 건물이 제자리에 고정됩니다.
- 북쪽이 위, y는 아래로 증가(SVG 표준).
- 종횡비 보존(uniform scale) — 건물이 찌그러지지 않습니다.

---

## 렌더링 예시 (React)

```jsx
import data from "./met_floorplan_departments.json";

function FloorMap({ floor = "1" }) {
  const f = data.floors[floor];
  return (
    <svg viewBox={f.viewBox} width="100%">
      {/* 1. 벽선 — 옅은 컨텍스트 */}
      <g fill="none" stroke="#9aa3b0" strokeWidth="0.6" strokeLinejoin="round">
        {f.walls.map((d, i) => <path key={i} d={d} />)}
      </g>

      {/* 2. 부서 구역 — 메인 레이어 */}
      {f.departments.map((dep) =>
        dep.paths.map((d, i) => (
          <path
            key={`${dep.department}-${i}`}
            d={d}
            fill={dep.color}
            fillOpacity={0.18}
            stroke={dep.color}
            strokeWidth={1.8}
            strokeLinejoin="round"
          />
        ))
      )}

      {/* 3. 라벨 (선택) — 각 부서 첫 path의 중심에 */}
      {f.departments.map((dep) => {
        const [cx, cy] = centroid(dep.paths[0]);
        return (
          <text key={dep.department} x={cx} y={cy}
            textAnchor="middle" fontSize="9" fontWeight="700" fill={dep.color}>
            {dep.department}
          </text>
        );
      })}
    </svg>
  );
}

// path "M x,y x,y ...Z" 의 꼭짓점 평균으로 중심점 계산
function centroid(d) {
  const n = d.match(/-?\d+\.?\d*/g).map(Number);
  let sx = 0, sy = 0, c = 0;
  for (let i = 0; i < n.length - 1; i += 2) { sx += n[i]; sy += n[i + 1]; c++; }
  return [sx / c, sy / c];
}
```

### 권장 스타일

- **walls**: `stroke="#9aa3b0" strokeWidth="0.6" fill="none"`
- **departments**: `stroke={color} strokeWidth="1.5~2" fill={color} fillOpacity="0.15~0.22"`

### 부서 클릭 → 줌인

부서를 클릭하면 그 부서로 확대하려면, 해당 부서의 모든 path 좌표에서 bounding box를
구해 `viewBox`를 그 영역으로 바꾸면 됩니다(약간의 padding 추가).

```js
function bbox(paths) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const d of paths) {
    const n = d.match(/-?\d+\.?\d*/g).map(Number);
    for (let i = 0; i < n.length - 1; i += 2) {
      x0 = Math.min(x0, n[i]); x1 = Math.max(x1, n[i]);
      y0 = Math.min(y0, n[i + 1]); y1 = Math.max(y1, n[i + 1]);
    }
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}
// const b = bbox(dep.paths);
// const pad = 30;
// setViewBox(`${b.x - pad} ${b.y - pad} ${b.w + pad * 2} ${b.h + pad * 2}`);
```

---

## 어떻게 만들어졌나

1. **벽선 추출** — 공식 지도 스크린샷에서 파란 벽선(건물 외곽 + 방 경계)을 색상으로
   분리하고, 방 번호 텍스트를 걸러낸 뒤 SVG path로 벡터화.
2. **부서 경계** — 각 부서가 차지하는 갤러리 번호 범위를 스크린샷에서 직접 읽고,
   그 구역의 외곽을 건물 벽에 맞춰 폴리곤으로 트레이싱.
3. **검증** — 모든 부서가 건물 외벽 안에 들어가고(footprint 침범 0), 부서끼리
   겹치지 않도록(overlap 0) 좌표 단위로 확인.

---

## 알아두실 점

- 부서 구역은 갤러리들을 묶은 **경계 단위**라, 실제 Met의 공식 행정 경계와 픽셀 단위로
  100% 일치하지는 않습니다. 다만 각 부서가 차지하는 영역과 위치는 실제 지도를 따릅니다.
- Exhibition Galleries, 카페, 강당(Grace Rainey Rogers), The Great Hall 같은 비-부서
  공간은 부서 레이어에 포함하지 않았습니다(walls에는 경계가 남아 있음).
- Floor 1M·3은 데이터화할 갤러리가 거의 없어 부서 레이어가 비어 있습니다(walls만 제공).
- 방 번호(gallery number) 텍스트는 walls에서 제거되어 있습니다. 필요하면 별도로
  추가할 수 있습니다.
