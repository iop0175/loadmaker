/**
 * 도시 도로 건설 게임 타입 정의
 */

/** 2D 좌표 */
export interface Point {
  x: number;
  y: number;
  speedMultiplier?: number; // 이동 속도 배율
}

/** 도로 (직선 또는 베지어 곡선) */
export interface Road {
  id: string;
  start: Point;
  end: Point;
  controlPoint?: Point; // 베지어 곡선 컨트롤 포인트
  isBridge?: boolean; // 다리 여부
  isOverpass?: boolean; // 고가차도 여부 (도로/건물 위로 지나감)
  type?: 'normal' | 'highway'; // 도로 타입
}

/** 건물 (집 또는 회사) */
export interface Building {
  id: string;
  position: Point;
  color: string;
  name: string;
  lastActiveTime: number; // 마지막 활동 시간 (차량 생성/도착/보유)
  createdAt: number; // 생성 시간
  wasActive?: boolean; // 한번이라도 활성화되었는지 (안전 시간 적용 여부)
  upgradeLevel?: number; // 업그레이드 레벨 (기본 1, 도로 연결 가능 개수)
  nextSpawnTime?: number; // 다음 차량 스폰 시간 (집만 해당)
}

/** 차량 상태 */
export type VehicleStatus = 'going-to-office' | 'at-office' | 'going-home' | 'at-home' | 'removed';

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
  /** 교차점별 진입 시간 기록 (FIFO용) */
  intersectionArrivalTimes: Record<string, number>;
}

/** 교차점 */
export interface Intersection {
  point: Point;
  vehicleCount: number;
  isRoundabout?: boolean; // 원형 교차로 여부
}

/** 강 세그먼트 */
export interface RiverSegment {
  x: number;
  y: number;
  width: number;
}
