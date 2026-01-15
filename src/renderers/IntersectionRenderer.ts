/**
 * Intersection Renderer
 * 교차점 렌더링 함수 (외곽선, 본체, 저지선, 혼잡도 표시, 신호등)
 */

import type { Intersection, Road, Vehicle, Point } from '../types';
import { TRAFFIC_LIGHT_PHASE_DURATION } from '../constants';

/**
 * 두 점 사이의 거리 계산
 */
function distance(a: Point, b: Point): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

/**
 * 교차점 외곽선 렌더링 (도로보다 먼저 그려야 함)
 */
export function renderIntersectionOutlines(
  ctx: CanvasRenderingContext2D, 
  intersections: Intersection[]
): void {
  intersections.forEach(intersection => {
    ctx.fillStyle = '#9ca3af';
    ctx.beginPath();
    ctx.arc(intersection.point.x, intersection.point.y, 16, 0, Math.PI * 2);
    ctx.fill();
  });
}

/**
 * 교차점 본체 렌더링 (도로 다음에 그려야 함)
 */
export function renderIntersectionBodies(
  ctx: CanvasRenderingContext2D, 
  intersections: Intersection[]
): void {
  intersections.forEach(intersection => {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(intersection.point.x, intersection.point.y, 14, 0, Math.PI * 2);
    ctx.fill();
  });
}

/**
 * 교차점 전체 렌더링 (중앙 표시, 저지선, 혼잡도 포함)
 */
export function renderIntersections(
  ctx: CanvasRenderingContext2D, 
  intersections: Intersection[],
  vehicles: Vehicle[],
  roads: Road[]
): void {
  // 교차점 혼잡도 계산
  const intersectionCounts = new Map<string, number>();
  vehicles.forEach(v => {
    Object.keys(v.intersectionArrivalTimes).forEach(key => {
       intersectionCounts.set(key, (intersectionCounts.get(key) || 0) + 1);
    });
  });

  // 각 교차점 렌더링
  intersections.forEach(intersection => {
    const key = `${intersection.point.x},${intersection.point.y}`;
    const count = intersectionCounts.get(key) || 0;
    const isHeavyCongested = count >= 8; // 8대 이상이면 심각한 정체
    const isCongested = count >= 4;       // 4대 이상이면 정체

    // 정체 시 배경 원 (경고 표시)
    if (isHeavyCongested) {
      // 심각한 정체: 빨간 원
      ctx.fillStyle = 'rgba(239, 68, 68, 0.6)';
      ctx.beginPath();
      ctx.arc(intersection.point.x, intersection.point.y, 20, 0, Math.PI * 2);
      ctx.fill();
    } else if (isCongested) {
      // 일반 정체: 주황 원
      ctx.fillStyle = 'rgba(251, 146, 60, 0.5)';
      ctx.beginPath();
      ctx.arc(intersection.point.x, intersection.point.y, 18, 0, Math.PI * 2);
      ctx.fill();
    }

    // 중앙 점 (정체 정도에 따라 색상 변경)
    ctx.fillStyle = isHeavyCongested ? '#dc2626' : isCongested ? '#f97316' : '#fbbf24';
    ctx.beginPath();
    ctx.arc(intersection.point.x, intersection.point.y, isHeavyCongested ? 6 : isCongested ? 5 : 4, 0, Math.PI * 2);
    ctx.fill();
    
    // 외곽 링
    ctx.strokeStyle = isHeavyCongested ? '#dc2626' : isCongested ? '#fb923c' : '#9ca3af';
    ctx.lineWidth = isHeavyCongested ? 3 : isCongested ? 2 : 1;
    ctx.beginPath();
    ctx.arc(intersection.point.x, intersection.point.y, 12, 0, Math.PI * 2);
    ctx.stroke();

    // 정체 표시 (정체시에만, 신호등이 없는 경우)
    if (!intersection.hasTrafficLight) {
      if (isHeavyCongested) {
         ctx.fillStyle = '#ffffff';
         ctx.font = 'bold 11px system-ui';
         ctx.textAlign = 'center';
         ctx.textBaseline = 'middle';
         ctx.fillText('!', intersection.point.x, intersection.point.y);
      } else if (isCongested) {
         ctx.fillStyle = '#ffffff';
         ctx.font = 'bold 10px system-ui';
         ctx.textAlign = 'center';
         ctx.textBaseline = 'middle';
         ctx.fillText('!', intersection.point.x, intersection.point.y);
      }
    }

    // 신호등 렌더링
    if (intersection.hasTrafficLight) {
      const now = Date.now();
      const phaseStart = intersection.phaseStartTime || now;
      const elapsed = now - phaseStart;
      const currentPhase = Math.floor(elapsed / TRAFFIC_LIGHT_PHASE_DURATION) % 2 === 0 ? 'ns' : 'ew';
      
      // 신호등 배경
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.arc(intersection.point.x, intersection.point.y, 10, 0, Math.PI * 2);
      ctx.fill();
      
      // 신호등 색상 (NS: 초록/빨강, EW: 빨강/초록)
      // 상하 (NS) 신호
      ctx.fillStyle = currentPhase === 'ns' ? '#22c55e' : '#dc2626';
      ctx.beginPath();
      ctx.arc(intersection.point.x, intersection.point.y - 4, 3, 0, Math.PI * 2);
      ctx.fill();
      
      // 좌우 (EW) 신호
      ctx.fillStyle = currentPhase === 'ew' ? '#22c55e' : '#dc2626';
      ctx.beginPath();
      ctx.arc(intersection.point.x, intersection.point.y + 4, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // 저지선 표시 (교차점에 연결된 각 도로에 흰색 선)
    roads.forEach(road => {
      // 이 도로가 교차점에 연결되어 있는지 확인
      const atStart = distance(road.start, intersection.point) < 5;
      const atEnd = distance(road.end, intersection.point) < 5;
      
      if (atStart || atEnd) {
        // 도로 방향 계산
        const roadStart = atStart ? road.start : road.end;
        const roadEnd = atStart ? road.end : road.start;
        const dx = roadEnd.x - roadStart.x;
        const dy = roadEnd.y - roadStart.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len === 0) return;
        
        // 정규화된 방향
        const nx = dx / len;
        const ny = dy / len;
        
        // 저지선 위치 (교차점에서 20px 떨어진 곳)
        const stopLineX = intersection.point.x + nx * 20;
        const stopLineY = intersection.point.y + ny * 20;
        
        // 수직 방향
        const perpX = -ny;
        const perpY = nx;
        
        // 저지선 그리기 (흰색)
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(stopLineX + perpX * 10, stopLineY + perpY * 10);
        ctx.lineTo(stopLineX - perpX * 10, stopLineY - perpY * 10);
        ctx.stroke();
      }
    });
  });
}
