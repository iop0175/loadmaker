/**
 * Road Renderer
 * 도로 렌더링 함수 (외곽선, 본체, 중앙선)
 */

import type { Road, Point } from '../types';
import { ROAD_WIDTH, ROAD_OUTLINE_WIDTH } from '../constants';

/**
 * 도로 외곽선 렌더링
 */
function renderRoadOutlines(ctx: CanvasRenderingContext2D, roads: Road[]): void {
  ctx.lineWidth = ROAD_OUTLINE_WIDTH;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  
  roads.forEach(road => {
    ctx.strokeStyle = road.isBridge ? '#8b4513' : '#9ca3af';
    ctx.beginPath();
    ctx.moveTo(road.start.x, road.start.y);
    if (road.controlPoint) {
      ctx.quadraticCurveTo(road.controlPoint.x, road.controlPoint.y, road.end.x, road.end.y);
    } else {
      ctx.lineTo(road.end.x, road.end.y);
    }
    ctx.stroke();
  });
}

/**
 * 도로 본체 렌더링
 */
function renderRoadBodies(ctx: CanvasRenderingContext2D, roads: Road[]): void {
  ctx.lineWidth = ROAD_WIDTH;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  
  // 일반 도로 먼저 렌더링
  roads.filter(r => !r.isBridge).forEach(road => {
    ctx.strokeStyle = road.type === 'highway' ? '#93c5fd' : '#ffffff';
    ctx.beginPath();
    ctx.moveTo(road.start.x, road.start.y);
    if (road.controlPoint) {
      ctx.quadraticCurveTo(road.controlPoint.x, road.controlPoint.y, road.end.x, road.end.y);
    } else {
      ctx.lineTo(road.end.x, road.end.y);
    }
    ctx.stroke();
  });
  
  // 다리는 나중에 렌더링 (위에 그려짐)
  roads.filter(r => r.isBridge).forEach(road => {
    ctx.strokeStyle = '#d4a373';
    ctx.beginPath();
    ctx.moveTo(road.start.x, road.start.y);
    if (road.controlPoint) {
      ctx.quadraticCurveTo(road.controlPoint.x, road.controlPoint.y, road.end.x, road.end.y);
    } else {
      ctx.lineTo(road.end.x, road.end.y);
    }
    ctx.stroke();
    
    // 다리 끝점에 연결부 (원형) 렌더링 - 자연스러운 전환
    ctx.fillStyle = '#d4a373';
    ctx.beginPath();
    ctx.arc(road.start.x, road.start.y, ROAD_WIDTH / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(road.end.x, road.end.y, ROAD_WIDTH / 2, 0, Math.PI * 2);
    ctx.fill();
  });
}

/**
 * 도로 중앙선 렌더링
 */
function renderRoadCenterLines(ctx: CanvasRenderingContext2D, roads: Road[]): void {
  ctx.strokeStyle = '#fbbf24';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  
  roads.forEach(road => {
    ctx.beginPath();
    ctx.moveTo(road.start.x, road.start.y);
    if (road.controlPoint) {
      ctx.quadraticCurveTo(road.controlPoint.x, road.controlPoint.y, road.end.x, road.end.y);
    } else {
      ctx.lineTo(road.end.x, road.end.y);
    }
    ctx.stroke();
  });
}

/**
 * 모든 도로 렌더링 (외곽선 + 본체 + 중앙선)
 */
export function renderRoads(ctx: CanvasRenderingContext2D, roads: Road[]): void {
  renderRoadOutlines(ctx, roads);
  renderRoadBodies(ctx, roads);
  renderRoadCenterLines(ctx, roads);
}

/**
 * 선택된 도로 하이라이트 렌더링
 */
export function renderSelectedRoad(ctx: CanvasRenderingContext2D, road: Road): void {
  ctx.save();
  ctx.shadowBlur = 15;
  ctx.shadowColor = '#06b6d4'; // Cyan
  ctx.strokeStyle = 'rgba(34, 211, 238, 0.6)';
  ctx.lineWidth = ROAD_WIDTH + 8;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(road.start.x, road.start.y);
  if (road.controlPoint) {
    ctx.quadraticCurveTo(road.controlPoint.x, road.controlPoint.y, road.end.x, road.end.y);
  } else {
    ctx.lineTo(road.end.x, road.end.y);
  }
  ctx.stroke();
  ctx.restore();
}

interface RoadPreviewOptions {
  drawStart: Point;
  currentEnd: Point;
  controlPoint?: Point | null;
  isInvalid: boolean;
  crossesRiver: boolean;
  hasBridge: boolean;
  cost: number;          // 건설 비용
  isBridgeMode: boolean; // 다리 모드인지
  isHighwayMode: boolean; // 고속도로 모드인지
}

/**
 * 두 점 사이의 거리 계산
 */
function getDistance(p1: Point, p2: Point): number {
  return Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
}

/**
 * 도로 프리뷰 렌더링
 */
export function renderRoadPreview(ctx: CanvasRenderingContext2D, options: RoadPreviewOptions): void {
  const { drawStart, currentEnd, controlPoint, isInvalid, crossesRiver, hasBridge, cost, isBridgeMode, isHighwayMode } = options;
  
  let previewColor = 'rgba(66, 133, 244, 0.5)'; // 기본: 파란색
  
  if (isInvalid) {
    previewColor = 'rgba(239, 68, 68, 0.6)'; // 유효하지 않음: 빨간색
  } else if (crossesRiver) {
    // 강을 건너는 경우
    if (isBridgeMode && hasBridge) {
      previewColor = 'rgba(210, 180, 140, 0.8)'; // 다리 모드이고 아이템 있음: 갈색
    } else if (isBridgeMode && !hasBridge) {
      previewColor = 'rgba(239, 68, 68, 0.6)'; // 다리 모드지만 아이템 없음: 빨간색
    } else {
      previewColor = 'rgba(239, 68, 68, 0.6)'; // 일반 모드에서 강 건너기: 빨간색
    }
  } else if (isHighwayMode) {
    previewColor = 'rgba(147, 197, 253, 0.8)'; // 고속도로 모드: 하늘색
  } else if (isBridgeMode) {
    previewColor = 'rgba(210, 180, 140, 0.8)'; // 다리 모드 (강 안건넘): 갈색
  }

  ctx.strokeStyle = previewColor;
  ctx.lineWidth = 22;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(drawStart.x, drawStart.y);
  if (controlPoint) {
    ctx.quadraticCurveTo(controlPoint.x, controlPoint.y, currentEnd.x, currentEnd.y);
  } else {
    ctx.lineTo(currentEnd.x, currentEnd.y);
  }
  ctx.stroke();

  // 컨트롤 포인트 표시
  if (controlPoint) {
    ctx.fillStyle = 'rgba(66, 133, 244, 0.8)';
    ctx.beginPath();
    ctx.arc(controlPoint.x, controlPoint.y, 6, 0, Math.PI * 2);
    ctx.fill();
  }

  // 비용 표시 (도로 중간 위치)
  const midX = controlPoint 
    ? (drawStart.x + 2 * controlPoint.x + currentEnd.x) / 4
    : (drawStart.x + currentEnd.x) / 2;
  const midY = controlPoint 
    ? (drawStart.y + 2 * controlPoint.y + currentEnd.y) / 4
    : (drawStart.y + currentEnd.y) / 2;

  const dist = getDistance(drawStart, currentEnd);
  if (dist > 30) { // 충분히 길때만 표시
    // 배경
    ctx.fillStyle = isInvalid ? 'rgba(239, 68, 68, 0.9)' : 'rgba(15, 23, 42, 0.85)';
    const textWidth = ctx.measureText(`${cost}P`).width || 40;
    const padding = 6;
    const bgWidth = textWidth + padding * 2 + 10;
    const bgHeight = 22;
    
    ctx.beginPath();
    ctx.roundRect(midX - bgWidth / 2, midY - bgHeight / 2 - 15, bgWidth, bgHeight, 4);
    ctx.fill();

    // 아이콘/텍스트
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    if (isBridgeMode && crossesRiver) {
      ctx.fillText('다리 0P', midX, midY - 15);
    } else if (isHighwayMode) {
      ctx.fillText('고속도로 0P', midX, midY - 15);
    } else {
      ctx.fillText(`${cost}P`, midX, midY - 15);
    }
  }
}
