/**
 * Vehicle Renderer
 * 차량 렌더링 함수
 */

import type { Vehicle } from '../types';
import { VEHICLE_SIZE } from '../constants';

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
 * 모든 차량 렌더링
 */
export function renderVehicles(ctx: CanvasRenderingContext2D, vehicles: Vehicle[]): void {
  vehicles.forEach(vehicle => {
    // 회사에 도착한 차량은 렌더링하지 않음
    if (vehicle.status === 'at-office') return;
    
    // 차량 본체 (원형)
    ctx.fillStyle = vehicle.color;
    ctx.beginPath();
    ctx.arc(vehicle.position.x, vehicle.position.y, VEHICLE_SIZE, 0, Math.PI * 2);
    ctx.fill();
    
    // 차량 테두리
    ctx.strokeStyle = shadeColor(vehicle.color, -30);
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 퇴근 중 표시
    if (vehicle.status === 'going-home') {
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 8px system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('⌂', vehicle.position.x, vehicle.position.y);
    }
  });
}
