// 실제 Met 공식 도면을 트레이싱한 지도 데이터(부서 경계 + 방 단위 세부 도면)를 로드/가공한다.
// - met_floorplan_departments.json : 층별 외벽 + 부서 경계 폴리곤 (개요 지도)
// - met_floor1/2_room_maps.json     : 부서별 방 단위 SVG 문자열 (세부 지도, data-gallery 로 방 표시)
import floorplan from '../met_floorplan_departments.json';
import floor1Rooms from '../met_floor1_room_maps.json';
import floor2Rooms from '../met_floor2_room_maps.json';

export const floorplanViewBox = floorplan.meta?.viewBox || '0 0 1000 545';

// 층 키 → 부서별 방 SVG 묶음
const roomMapsByFloor = {
  1: floor1Rooms.departments,
  2: floor2Rooms.departments,
};

// 부서별 방 도면 SVG 문자열을 꺼낸다. (없으면 null)
export const getRoomMapSvg = (floorId, department) =>
  roomMapsByFloor[floorId]?.[department] || null;

// 방 SVG 에 입혀진 stroke 색을 추출해 개요 도면 폴리곤과 색을 통일한다.
const extractStrokeColor = (svg) => {
  const match = svg && svg.match(/stroke="(#[0-9A-Fa-f]{3,6})"/);
  return match ? match[1] : null;
};

export const departmentColors = {};
[floor1Rooms, floor2Rooms].forEach((file) => {
  Object.entries(file.departments).forEach(([department, svg]) => {
    if (!departmentColors[department]) {
      const color = extractStrokeColor(svg);
      if (color) departmentColors[department] = color;
    }
  });
});

export const deptColor = (department) => departmentColors[department] || '#9aa3ad';

// 층 선택 UI 순서. 1M·3층은 작품 데이터가 없어 제외한다.
const FLOOR_ORDER = ['1', '2'];

export const floorplanFloors = FLOOR_ORDER
  .filter((id) => floorplan.floors[id])
  .map((id) => {
    const floor = floorplan.floors[id];
    return {
      id,
      label: floor.label,
      outerWall: floor.outer_wall,
      departments: floor.departments || [],
      hasData: (floor.departments || []).length > 0,
    };
  });

// 부서 이름 → 해당 부서가 속한 층 (첫 등장 기준)
export const departmentFloor = {};
floorplanFloors.forEach((floor) => {
  floor.departments.forEach((dept) => {
    if (!departmentFloor[dept.department]) departmentFloor[dept.department] = floor.id;
  });
});

// 갤러리 번호 → { floor, department } (방 SVG 의 data-gallery 에서 수집)
export const galleryLocation = {};
Object.entries(roomMapsByFloor).forEach(([floorId, departments]) => {
  Object.entries(departments).forEach(([department, svg]) => {
    const regex = /data-gallery="([^"]+)"/g;
    let match;
    while ((match = regex.exec(svg))) {
      const gallery = match[1];
      if (!galleryLocation[gallery]) galleryLocation[gallery] = { floor: floorId, department };
    }
  });
});

// CSV 의 짧은 부서명(예: 'American Wing')을 도면 부서명으로 연결하기 위한 별칭.
const DEPARTMENT_ALIASES = {
  'American Wing': 'The American Wing',
  'European Paintings': 'European Paintings, 1250-1800',
  'European Sculpture and Decorative Arts': 'European Sculpture and Decorative Arts',
  'Islamic Art': 'Art of the Arab Lands, Turkey, Iran, Central Asia, and Later South Asia',
  Cloisters: 'Medieval Art',
  'Medieval Art': 'Medieval Art',
};

const allDepartmentNames = Object.keys(departmentFloor);

// 임의의 부서명을 도면상의 정식 부서명으로 해석한다. 매칭 실패 시 null.
export const resolveDepartment = (name) => {
  if (!name) return null;
  const clean = String(name).trim();
  if (departmentFloor[clean]) return clean;

  const stripped = clean.replace(/^The /, '');
  if (DEPARTMENT_ALIASES[stripped]) return DEPARTMENT_ALIASES[stripped];
  if (departmentFloor[`The ${stripped}`]) return `The ${stripped}`;

  const lower = stripped.toLowerCase();
  const fuzzy = allDepartmentNames.find((dept) => {
    const candidate = dept.toLowerCase();
    return candidate.startsWith(lower) || lower.startsWith(candidate.replace(/^the /, ''));
  });
  return fuzzy || null;
};

// path 문자열에서 대략적인 무게중심(라벨 위치) 계산.
export const pathCentroid = (pathStr) => {
  const nums = (pathStr.match(/-?\d+\.?\d*/g) || []).map(Number);
  let sumX = 0;
  let sumY = 0;
  let count = 0;
  for (let i = 0; i < nums.length - 1; i += 2) {
    sumX += nums[i];
    sumY += nums[i + 1];
    count += 1;
  }
  return count ? [sumX / count, sumY / count] : [0, 0];
};

// 특정 층·부서의 방 지도에 포함된 갤러리 번호 집합. (작품 매칭의 기준)
const roomGalleryCache = new Map();
export const getRoomGalleries = (floorId, department) => {
  const key = `${floorId}::${department}`;
  if (roomGalleryCache.has(key)) return roomGalleryCache.get(key);

  const svg = getRoomMapSvg(floorId, department);
  const galleries = new Set();
  if (svg) {
    const regex = /data-gallery="([^"]+)"/g;
    let match;
    while ((match = regex.exec(svg))) galleries.add(match[1]);
  }
  roomGalleryCache.set(key, galleries);
  return galleries;
};

// 작품이 실제로 속한 "도면상" 부서를 판정한다.
// CSV의 Department(예: 'European Paintings')는 도면에서 시대별로 쪼개진 부서를
// 구분하지 못하므로, 갤러리 번호가 어느 부서 방 지도에 있는지를 우선 사용하고
// 갤러리 정보가 없을 때만 부서명으로 추정한다.
export const artworkDepartment = (work) => {
  const gallery = String(work?.galleryNumber || '');
  if (gallery && galleryLocation[gallery]) return galleryLocation[gallery].department;
  return resolveDepartment(work?.department);
};
