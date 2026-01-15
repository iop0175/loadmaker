/**
 * River Renderer
 * 강 렌더링 함수 (물결, 하이라이트, 테두리)
 */

import type { RiverSegment } from '../types';

/**
 * 강의 양쪽 테두리 좌표 계산
 */
function getRiverEdges(seg: RiverSegment, isHorizontal: boolean): { 
  edge1: { x: number; y: number }; 
  edge2: { x: number; y: number }; 
} {
  const halfWidth = seg.width / 2;
  if (isHorizontal) {
    // 수평 강: width를 y 방향으로 적용
    return {
      edge1: { x: seg.x, y: seg.y - halfWidth },
      edge2: { x: seg.x, y: seg.y + halfWidth },
    };
  } else {
    // 수직 강: width를 x 방향으로 적용
    return {
      edge1: { x: seg.x - halfWidth, y: seg.y },
      edge2: { x: seg.x + halfWidth, y: seg.y },
    };
  }
}

/**
 * 강 렌더링 (물결 효과, 하이라이트, 테두리 포함)
 */
export function renderRiver(ctx: CanvasRenderingContext2D, riverSegments: RiverSegment[]): void {
  if (riverSegments.length < 2) return;

  const first = riverSegments[0];
  const last = riverSegments[riverSegments.length - 1];
  
  // 강 방향 판단 (수평 vs 수직)
  const isHorizontal = Math.abs(last.x - first.x) > Math.abs(last.y - first.y);
  
  // 강 기본 (그라디언트 - 방향에 맞게)
  const gradient = isHorizontal
    ? ctx.createLinearGradient(first.x, 0, last.x, 0)
    : ctx.createLinearGradient(0, first.y, 0, last.y);
  gradient.addColorStop(0, '#0ea5e9');
  gradient.addColorStop(0.5, '#0284c7');
  gradient.addColorStop(1, '#0369a1');
  
  ctx.fillStyle = gradient;
  ctx.beginPath();
  
  // 첫 번째 테두리 경로
  const firstEdge = getRiverEdges(riverSegments[0], isHorizontal);
  ctx.moveTo(firstEdge.edge1.x, firstEdge.edge1.y);
  for (let i = 1; i < riverSegments.length; i++) {
    const edge = getRiverEdges(riverSegments[i], isHorizontal);
    ctx.lineTo(edge.edge1.x, edge.edge1.y);
  }
  
  // 두 번째 테두리 경로 (역순)
  for (let i = riverSegments.length - 1; i >= 0; i--) {
    const edge = getRiverEdges(riverSegments[i], isHorizontal);
    ctx.lineTo(edge.edge2.x, edge.edge2.y);
  }
  ctx.closePath();
  ctx.fill();

  // 강 테두리 (연한 하늘색)
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 2;
  
  // 첫 번째 테두리
  ctx.beginPath();
  const startEdge1 = getRiverEdges(riverSegments[0], isHorizontal);
  ctx.moveTo(startEdge1.edge1.x, startEdge1.edge1.y);
  for (let i = 1; i < riverSegments.length; i++) {
    const edge = getRiverEdges(riverSegments[i], isHorizontal);
    ctx.lineTo(edge.edge1.x, edge.edge1.y);
  }
  ctx.stroke();
  
  // 두 번째 테두리
  ctx.beginPath();
  const startEdge2 = getRiverEdges(riverSegments[0], isHorizontal);
  ctx.moveTo(startEdge2.edge2.x, startEdge2.edge2.y);
  for (let i = 1; i < riverSegments.length; i++) {
    const edge = getRiverEdges(riverSegments[i], isHorizontal);
    ctx.lineTo(edge.edge2.x, edge.edge2.y);
  }
  ctx.stroke();
}
