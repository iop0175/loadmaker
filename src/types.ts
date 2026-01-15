/**
 * 도시 도로 건설 게임 타입 정의
 */

/** 2D 좌표 */
export interface Point {
  x: number;
  y: number;
}

/** 도로 (직선 또는 베지어 곡선) */
export interface Road {
  id: string;
  start: Point;
  end: Point;
  controlPoint?: Point; // 베지어 곡선 컨트롤 포인트
}

/** 건물 (집 또는 회사) */
export interface Building {
  id: string;
  position: Point;
  color: string;
  name: string;
}

/** 차량 상태 */
export type VehicleStatus = 'going-to-office' | 'at-office' | 'going-home' | 'at-home';

/** 차량 */
export interface Vehicle {
  id: string;
  position: Point;
  targetIndex: number;
  path: Point[];
  speed: number;
  waitTime: number;
  color: string;
  lane: 'left' | 'right';
  direction: number;
  fromBuilding: string;
  toBuilding: string;
  status: VehicleStatus;
  officeArrivalTime: number;
}

/** 교차점 */
export interface Intersection {
  point: Point;
  vehicleCount: number;
}

/** 강 세그먼트 */
export interface RiverSegment {
  x: number;
  y: number;
  width: number;
}
