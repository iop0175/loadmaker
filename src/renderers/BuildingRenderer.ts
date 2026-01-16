/**
 * Building Renderer
 * 건물 렌더링 함수 (집, 회사, 상태 표시, 소멸 타이머)
 */

import type { Building, Vehicle } from '../types';
import { MAX_VEHICLES_PER_HOME, MAX_VEHICLES_PER_OFFICE } from '../constants';

/**
 * 색상을 밝게/어둡게 조정
 */
function shadeColor(color: string, percent: number): string {
  const num = parseInt(color.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = (num >> 16) + amt;
  const G = (num >> 8 & 0x00FF) + amt;
  const B = (num & 0x0000FF) + amt;
  return '#' + (0x1000000 + 
    (R < 255 ? (R < 0 ? 0 : R) : 255) * 0x10000 + 
    (G < 255 ? (G < 0 ? 0 : G) : 255) * 0x100 + 
    (B < 255 ? (B < 0 ? 0 : B) : 255)
  ).toString(16).slice(1);
}

/**
 * 소멸 타이머 링 렌더링
 */
function renderDestructionTimer(
  ctx: CanvasRenderingContext2D, 
  cx: number, 
  cy: number, 
  timeLeft: number
): void {
  if (timeLeft >= 30000) return;
  
  // 0(안전) -> 1(파괴) 순으로 차오름
  const danger = 1.0 - Math.max(0, timeLeft / 30000);
  const radius = 6;
  
  // 배경 링
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
  ctx.lineWidth = 3;
  ctx.stroke();
  
  // 진행 링 (게이지 차오름)
  ctx.beginPath();
  ctx.arc(cx, cy, radius, -Math.PI/2, -Math.PI/2 + (Math.PI * 2 * danger));
  ctx.strokeStyle = danger > 0.66 ? '#dc2626' : (danger > 0.33 ? '#ea580c' : '#22c55e');
  ctx.lineWidth = 3;
  ctx.stroke();
}

/**
 * 집 렌더링
 */
function renderHome(
  ctx: CanvasRenderingContext2D, 
  building: Building, 
  vehicles: Vehicle[]
): void {
  const cx = building.position.x;
  const cy = building.position.y;
  const houseWidth = 36;
  const houseHeight = 30;
  const roofHeight = 15;

  const now = Date.now();
  const lastActive = building.lastActiveTime || now;
  const inactiveTime = now - lastActive;
  const timeLeft = Math.max(0, 45000 - inactiveTime);
  
  // 새 건물 하이라이트 (생성 후 3초간)
  const isNewBuilding = (now - building.createdAt) < 3000;
  // 파괴 위험 하이라이트 (15초 이하 남음)
  const isInDanger = timeLeft > 0 && timeLeft < 15000;
  
  if (isNewBuilding) {
    // 노란색 글로우 효과
    ctx.save();
    ctx.shadowColor = '#fbbf24';
    ctx.shadowBlur = 15;
    ctx.fillStyle = 'rgba(251, 191, 36, 0.3)';
    ctx.fillRect(cx - houseWidth/2 - 8, cy - houseHeight/2 - roofHeight - 8, houseWidth + 16, houseHeight + roofHeight + 16);
    ctx.restore();
  } else if (isInDanger) {
    // 빨간색 글로우 효과
    ctx.save();
    ctx.shadowColor = '#ef4444';
    ctx.shadowBlur = 15;
    ctx.fillStyle = 'rgba(239, 68, 68, 0.3)';
    ctx.fillRect(cx - houseWidth/2 - 8, cy - houseHeight/2 - roofHeight - 8, houseWidth + 16, houseHeight + roofHeight + 16);
    ctx.restore();
  }

  // 집 본체 (사각형)
  ctx.fillStyle = building.color;
  ctx.fillRect(cx - houseWidth/2, cy - houseHeight/2, houseWidth, houseHeight);
  
  // 집 테두리
  ctx.strokeStyle = shadeColor(building.color, -30);
  ctx.lineWidth = 2;
  ctx.strokeRect(cx - houseWidth/2, cy - houseHeight/2, houseWidth, houseHeight);

  // 지붕 (삼각형)
  ctx.fillStyle = shadeColor(building.color, -20);
  ctx.beginPath();
  ctx.moveTo(cx - houseWidth/2 - 5, cy - houseHeight/2);
  ctx.lineTo(cx, cy - houseHeight/2 - roofHeight);
  ctx.lineTo(cx + houseWidth/2 + 5, cy - houseHeight/2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  
  // 집 표시
  ctx.font = 'bold 16px system-ui';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('H', cx, cy);
  
  // 상태 표시 (차량 수)
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.font = 'bold 11px system-ui';
  
  // 집: 남은 차량 수 (Max - Active)
  const activeCount = vehicles.filter(v => v.fromBuilding === building.id).length;
  const remainingCount = Math.max(0, MAX_VEHICLES_PER_HOME - activeCount);
  
  ctx.fillStyle = '#1f2937';
  ctx.fillText(`${remainingCount}`, cx, cy - houseHeight/2 - roofHeight - 4);
  
  // 소멸 경고 (도넛 타이머)
  renderDestructionTimer(ctx, cx, cy - houseHeight/2 - roofHeight - 16, timeLeft);
}

/**
 * 회사 렌더링
 */
function renderOffice(
  ctx: CanvasRenderingContext2D, 
  building: Building, 
  vehicles: Vehicle[]
): void {
  const cx = building.position.x;
  const cy = building.position.y;
  const buildingWidth = 40;
  const buildingHeight = 50;

  const now = Date.now();
  const lastActive = building.lastActiveTime || now;
  const inactiveTime = now - lastActive;
  const timeLeft = Math.max(0, 45000 - inactiveTime);
  
  // 새 건물 하이라이트 (생성 후 3초간)
  const isNewBuilding = (now - building.createdAt) < 3000;
  // 파괴 위험 하이라이트 (15초 이하 남음)
  const isInDanger = timeLeft > 0 && timeLeft < 15000;
  
  if (isNewBuilding) {
    // 노란색 글로우 효과
    ctx.save();
    ctx.shadowColor = '#fbbf24';
    ctx.shadowBlur = 15;
    ctx.fillStyle = 'rgba(251, 191, 36, 0.3)';
    ctx.fillRect(cx - buildingWidth/2 - 8, cy - buildingHeight/2 - 8, buildingWidth + 16, buildingHeight + 16);
    ctx.restore();
  } else if (isInDanger) {
    // 빨간색 글로우 효과
    ctx.save();
    ctx.shadowColor = '#ef4444';
    ctx.shadowBlur = 15;
    ctx.fillStyle = 'rgba(239, 68, 68, 0.3)';
    ctx.fillRect(cx - buildingWidth/2 - 8, cy - buildingHeight/2 - 8, buildingWidth + 16, buildingHeight + 16);
    ctx.restore();
  }

  // 건물 본체 (사각형)
  ctx.fillStyle = building.color;
  ctx.fillRect(cx - buildingWidth/2, cy - buildingHeight/2, buildingWidth, buildingHeight);
  
  // 건물 테두리
  ctx.strokeStyle = shadeColor(building.color, -30);
  ctx.lineWidth = 2;
  ctx.strokeRect(cx - buildingWidth/2, cy - buildingHeight/2, buildingWidth, buildingHeight);

  // 회사 표시
  ctx.font = 'bold 18px system-ui';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('B', cx, cy - 5);
  
  // 상태 표시 (도착한 차량 수)
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.font = 'bold 11px system-ui';
  
  const parkedCount = vehicles.filter(v => v.toBuilding === building.id && v.status === 'at-office').length;
  
  ctx.fillStyle = '#1f2937';
  ctx.fillText(`${parkedCount}/${MAX_VEHICLES_PER_OFFICE}`, cx, cy - buildingHeight/2 - 4);

  // 소멸 경고 (도넛 타이머)
  renderDestructionTimer(ctx, cx, cy - buildingHeight/2 - 16, timeLeft);
}

/**
 * 선택된 건물 하이라이트 렌더링 (건물 모양)
 */
function renderSelectionHighlight(
  ctx: CanvasRenderingContext2D,
  building: Building
): void {
  const cx = building.position.x;
  const cy = building.position.y;
  const isHome = building.id.includes('-home');
  
  ctx.save();
  ctx.strokeStyle = '#f97316'; // 주황색
  ctx.lineWidth = 3;
  ctx.shadowColor = '#f97316';
  ctx.shadowBlur = 10;
  
  if (isHome) {
    const houseWidth = 36;
    const houseHeight = 30;
    const roofHeight = 15;
    
    // 집 본체 하이라이트
    ctx.strokeRect(cx - houseWidth/2 - 3, cy - houseHeight/2 - 3, houseWidth + 6, houseHeight + 6);
    
    // 지붕 하이라이트
    ctx.beginPath();
    ctx.moveTo(cx - houseWidth/2 - 8, cy - houseHeight/2 - 3);
    ctx.lineTo(cx, cy - houseHeight/2 - roofHeight - 5);
    ctx.lineTo(cx + houseWidth/2 + 8, cy - houseHeight/2 - 3);
    ctx.closePath();
    ctx.stroke();
  } else {
    const buildingWidth = 42;
    const buildingHeight = 52;
    
    // 회사 본체 하이라이트
    ctx.strokeRect(cx - buildingWidth/2 - 3, cy - buildingHeight/2 - 3, buildingWidth + 6, buildingHeight + 6);
  }
  
  ctx.restore();
}

/**
 * 모든 건물 렌더링
 */
export function renderBuildings(
  ctx: CanvasRenderingContext2D, 
  buildings: Building[], 
  vehicles: Vehicle[],
  selectedBuildingId?: string | null
): void {
  buildings.forEach(building => {
    const isHome = building.id.includes('-home');
    
    if (isHome) {
      renderHome(ctx, building, vehicles);
    } else {
      renderOffice(ctx, building, vehicles);
    }
    
    // 선택된 건물 하이라이트
    if (selectedBuildingId && building.id === selectedBuildingId) {
      renderSelectionHighlight(ctx, building);
    }
  });
}
