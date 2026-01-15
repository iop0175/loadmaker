/**
 * 유틸리티 함수 모음
 */
import type { Point, RiverSegment, Building, Road } from './types';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  GRID_SIZE,
  RIVER_MIN_WIDTH,
  RIVER_MAX_WIDTH,
  BUILDING_MARGIN,
  MIN_BUILDING_DISTANCE,
  MIN_HOME_OFFICE_DISTANCE,
  BUILDING_COLORS,
  ROAD_OVERLAP_THRESHOLD,
  ROAD_OVERLAP_RATIO,
} from './constants';

// ============ 수학 유틸리티 ============

/** 두 점 사이의 거리 계산 */
export function distance(p1: Point, p2: Point): number {
  return Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
}

/** 좌표를 그리드에 스냅 */
export function snapToGrid(point: Point): Point {
  return {
    x: Math.round(point.x / GRID_SIZE) * GRID_SIZE,
    y: Math.round(point.y / GRID_SIZE) * GRID_SIZE,
  };
}

/** 색상 밝기 조절 */
export function shadeColor(color: string, percent: number): string {
  const num = parseInt(color.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.min(255, Math.max(0, (num >> 16) + amt));
  const G = Math.min(255, Math.max(0, ((num >> 8) & 0x00ff) + amt));
  const B = Math.min(255, Math.max(0, (num & 0x0000ff) + amt));
  return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`;
}

// ============ 베지어 곡선 유틸리티 ============

/** 베지어 곡선 위의 점 샘플링 */
export function sampleBezierCurve(
  start: Point, 
  control: Point, 
  end: Point, 
  segments: number = 10
): Point[] {
  const points: Point[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    points.push({
      x: (1 - t) * (1 - t) * start.x + 2 * (1 - t) * t * control.x + t * t * end.x,
      y: (1 - t) * (1 - t) * start.y + 2 * (1 - t) * t * control.y + t * t * end.y,
    });
  }
  return points;
}

// ============ 강 생성 유틸리티 ============

/** Catmull-Rom 스플라인을 통한 부드러운 곡선 보간 */
function catmullRomSpline(
  p0: Point, p1: Point, p2: Point, p3: Point, 
  t: number
): Point {
  const t2 = t * t;
  const t3 = t2 * t;
  
  return {
    x: 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t + 
        (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + 
        (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
    y: 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t + 
        (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + 
        (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3)
  };
}

/** 랜덤 강 생성 (부드러운 곡선) */
export function generateRandomRiver(): RiverSegment[] {
  const direction = Math.floor(Math.random() * 3);
  
  // 먼저 컨트롤 포인트 생성
  const controlPoints: { x: number; y: number; width: number }[] = [];
  
  if (direction === 0) {
    // 수평 강 (왼쪽에서 오른쪽)
    const baseY = 150 + Math.random() * 300;
    let currentY = baseY;
    
    // 4~6개의 컨트롤 포인트
    const numPoints = 4 + Math.floor(Math.random() * 3);
    for (let i = 0; i <= numPoints; i++) {
      const x = (i / numPoints) * CANVAS_WIDTH;
      currentY += (Math.random() - 0.5) * 80;
      currentY = Math.max(80, Math.min(CANVAS_HEIGHT - 80, currentY));
      controlPoints.push({ 
        x, 
        y: currentY, 
        width: RIVER_MIN_WIDTH + Math.random() * (RIVER_MAX_WIDTH - RIVER_MIN_WIDTH) 
      });
    }
  } else if (direction === 1) {
    // 수직 강 (위에서 아래)
    const baseX = 200 + Math.random() * 400;
    let currentX = baseX;
    
    const numPoints = 4 + Math.floor(Math.random() * 3);
    for (let i = 0; i <= numPoints; i++) {
      const y = (i / numPoints) * CANVAS_HEIGHT;
      currentX += (Math.random() - 0.5) * 80;
      currentX = Math.max(80, Math.min(CANVAS_WIDTH - 80, currentX));
      controlPoints.push({ 
        x: currentX, 
        y, 
        width: RIVER_MIN_WIDTH + Math.random() * (RIVER_MAX_WIDTH - RIVER_MIN_WIDTH) 
      });
    }
  } else {
    // 대각선 강 (S자 곡선)
    const startTop = Math.random() > 0.5;
    const numPoints = 5 + Math.floor(Math.random() * 3);
    
    for (let i = 0; i <= numPoints; i++) {
      const t = i / numPoints;
      let x = t * CANVAS_WIDTH;
      let y: number;
      
      if (startTop) {
        // 왼쪽 위에서 오른쪽 아래로
        y = 50 + t * (CANVAS_HEIGHT - 100);
        // S자 곡선 효과
        y += Math.sin(t * Math.PI * 2) * 80;
      } else {
        // 왼쪽 아래에서 오른쪽 위로
        y = CANVAS_HEIGHT - 50 - t * (CANVAS_HEIGHT - 100);
        y += Math.sin(t * Math.PI * 2) * 80;
      }
      
      // 랜덤 변동 추가
      x += (Math.random() - 0.5) * 40;
      y += (Math.random() - 0.5) * 40;
      
      x = Math.max(0, Math.min(CANVAS_WIDTH, x));
      y = Math.max(50, Math.min(CANVAS_HEIGHT - 50, y));
      
      controlPoints.push({ 
        x, 
        y, 
        width: RIVER_MIN_WIDTH + Math.random() * (RIVER_MAX_WIDTH - RIVER_MIN_WIDTH) 
      });
    }
  }
  
  // 컨트롤 포인트가 부족하면 기본값
  if (controlPoints.length < 3) {
    return [
      { x: 0, y: 300, width: 50 }, 
      { x: CANVAS_WIDTH / 2, y: 320, width: 55 },
      { x: CANVAS_WIDTH, y: 280, width: 50 }
    ];
  }
  
  // Catmull-Rom 스플라인으로 부드러운 곡선 생성
  const segments: RiverSegment[] = [];
  const samplesPerSegment = 5; // 각 컨트롤 포인트 사이의 샘플 수
  
  for (let i = 0; i < controlPoints.length - 1; i++) {
    const p0 = controlPoints[Math.max(0, i - 1)];
    const p1 = controlPoints[i];
    const p2 = controlPoints[Math.min(controlPoints.length - 1, i + 1)];
    const p3 = controlPoints[Math.min(controlPoints.length - 1, i + 2)];
    
    for (let j = 0; j < samplesPerSegment; j++) {
      const t = j / samplesPerSegment;
      const point = catmullRomSpline(p0, p1, p2, p3, t);
      const width = p1.width + (p2.width - p1.width) * t;
      
      segments.push({ x: point.x, y: point.y, width });
    }
  }
  
  // 마지막 포인트 추가
  const last = controlPoints[controlPoints.length - 1];
  segments.push({ x: last.x, y: last.y, width: last.width });
  
  return segments;
}

/** 점이 강 위에 있는지 확인 (정적 - 건물 배치용) */
export function isPointInRiverStatic(point: Point, riverSegments: RiverSegment[]): boolean {
  // 건물 여백 (강에서 최소 50px 떨어져야 함)
  const buildingBuffer = 50;
  
  for (let i = 0; i < riverSegments.length - 1; i++) {
    const seg1 = riverSegments[i];
    const seg2 = riverSegments[i + 1];
    
    // 세그먼트 길이
    const segDx = seg2.x - seg1.x;
    const segDy = seg2.y - seg1.y;
    const segLength = Math.sqrt(segDx * segDx + segDy * segDy);
    
    if (segLength === 0) continue;
    
    // 점에서 세그먼트까지의 투영 위치 계산
    const t = Math.max(0, Math.min(1, 
      ((point.x - seg1.x) * segDx + (point.y - seg1.y) * segDy) / (segLength * segLength)
    ));
    
    // 가장 가까운 점
    const closestX = seg1.x + t * segDx;
    const closestY = seg1.y + t * segDy;
    
    // 해당 위치에서의 강 너비
    const riverWidth = seg1.width + (seg2.width - seg1.width) * t;
    
    // 거리 계산
    const distToRiver = Math.sqrt((point.x - closestX) ** 2 + (point.y - closestY) ** 2);
    
    // 강 너비의 절반 + 건물 여백 이내이면 충돌
    if (distToRiver < riverWidth / 2 + buildingBuffer) {
      return true;
    }
  }
  return false;
}

// ============ 건물 생성 유틸리티 ============

/** 랜덤 건물 배치 (강을 피해서) */
export function generateRandomBuildings(riverSegments: RiverSegment[]): Building[] {
  const buildings: Building[] = [];
  
  for (let i = 0; i < 3; i++) {
    const color = BUILDING_COLORS[i % BUILDING_COLORS.length];
    let homePos: Point | null = null;
    let officePos: Point | null = null;
    let attempts = 0;
    
    // 집 위치 찾기
    while (!homePos && attempts < 50) {
      const x = BUILDING_MARGIN + Math.random() * (CANVAS_WIDTH - BUILDING_MARGIN * 2);
      const y = BUILDING_MARGIN + Math.random() * (CANVAS_HEIGHT - BUILDING_MARGIN * 2);
      const point = { x, y };
      
      if (!isPointInRiverStatic(point, riverSegments) && 
          !buildings.some(b => distance(b.position, point) < MIN_BUILDING_DISTANCE)) {
        homePos = point;
      }
      attempts++;
    }
    
    if (!homePos) {
      homePos = { x: BUILDING_MARGIN + i * 200, y: BUILDING_MARGIN };
    }
    
    // 회사 위치 찾기
    attempts = 0;
    while (!officePos && attempts < 50) {
      const x = BUILDING_MARGIN + Math.random() * (CANVAS_WIDTH - BUILDING_MARGIN * 2);
      const y = BUILDING_MARGIN + Math.random() * (CANVAS_HEIGHT - BUILDING_MARGIN * 2);
      const point = { x, y };
      
      if (distance(homePos, point) >= MIN_HOME_OFFICE_DISTANCE &&
          !isPointInRiverStatic(point, riverSegments) &&
          !buildings.some(b => distance(b.position, point) < MIN_BUILDING_DISTANCE)) {
        officePos = point;
      }
      attempts++;
    }
    
    if (!officePos) {
      officePos = { x: CANVAS_WIDTH - BUILDING_MARGIN - i * 100, y: CANVAS_HEIGHT - BUILDING_MARGIN };
    }
    
    buildings.push(
      { id: `color${i}-home`, position: homePos, color, name: '' },
      { id: `color${i}-office`, position: officePos, color, name: '' }
    );
  }
  
  return buildings;
}

// ============ 도로 검사 유틸리티 ============

/** 새 도로가 기존 도로와 겹치는지 확인 (직선 및 커브 도로 모두 지원) */
export function doRoadsOverlap(
  newStart: Point, 
  newEnd: Point, 
  existingRoads: Road[],
  newControlPoint?: Point
): boolean {
  const samplePoints: Point[] = [];
  const steps = 10;
  
  // 새 도로의 샘플 포인트 생성 (커브 도로 지원)
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    if (newControlPoint) {
      // 베지어 곡선
      samplePoints.push({
        x: (1 - t) * (1 - t) * newStart.x + 2 * (1 - t) * t * newControlPoint.x + t * t * newEnd.x,
        y: (1 - t) * (1 - t) * newStart.y + 2 * (1 - t) * t * newControlPoint.y + t * t * newEnd.y,
      });
    } else {
      // 직선
      samplePoints.push({
        x: newStart.x + (newEnd.x - newStart.x) * t,
        y: newStart.y + (newEnd.y - newStart.y) * t,
      });
    }
  }
  
  // 각 기존 도로와 비교
  for (const road of existingRoads) {
    let overlapCount = 0;
    
    for (const point of samplePoints) {
      const roadSteps = 10;
      for (let j = 0; j <= roadSteps; j++) {
        const t = j / roadSteps;
        let roadPoint: Point;
        
        if (road.controlPoint) {
          roadPoint = {
            x: (1 - t) * (1 - t) * road.start.x + 2 * (1 - t) * t * road.controlPoint.x + t * t * road.end.x,
            y: (1 - t) * (1 - t) * road.start.y + 2 * (1 - t) * t * road.controlPoint.y + t * t * road.end.y,
          };
        } else {
          roadPoint = {
            x: road.start.x + (road.end.x - road.start.x) * t,
            y: road.start.y + (road.end.y - road.start.y) * t,
          };
        }
        
        if (distance(point, roadPoint) < ROAD_OVERLAP_THRESHOLD) {
          overlapCount++;
          break;
        }
      }
    }
    
    if (overlapCount > steps * ROAD_OVERLAP_RATIO) {
      return true;
    }
  }
  
  return false;
}
