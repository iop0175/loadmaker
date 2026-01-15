/**
 * 게임 상수
 */

// ============ 캔버스 설정 ============
export const CANVAS_WIDTH = 800;
export const CANVAS_HEIGHT = 600;
export const GRID_SIZE = 20;

// ============ 차량 설정 ============
export const VEHICLE_SIZE = 4; // 6 -> 4로 축소
export const VEHICLE_SPEED = 1.5; // 차량 속도 (동일)
export const LANE_OFFSET = 5; // 8 -> 5로 축소 (도로 폭에 맞춤)
export const MAX_VEHICLES = 100;
export const VEHICLE_SPAWN_INTERVAL = 1000; // 차량 생성 간격 단축
export const MAX_VEHICLES_PER_HOME = 5;
export const MAX_VEHICLES_PER_OFFICE = 10;

// ============ 게임플레이 설정 ============
export const OFFICE_WAIT_TIME = 10000; // 회사 대기 시간 (10초)
export const SCORE_PER_TRIP = 20;

// ============ 건물 배치 설정 ============
export const BUILDING_MARGIN = 60; // 캔버스 가장자리 여백
export const MIN_BUILDING_DISTANCE = 100; // 건물 간 최소 거리
export const MIN_HOME_OFFICE_DISTANCE = 200; // 집-회사 간 최소 거리

// ============ 강 설정 ============
export const RIVER_MIN_WIDTH = 60;  // 다리 최대 길이(120px)보다 좁게
export const RIVER_MAX_WIDTH = 100; // 다리로 건널 수 있는 최대 폭

// ============ 도로 설정 ============
export const ROAD_WIDTH = 18;
export const ROAD_OUTLINE_WIDTH = 22;
export const ROAD_OVERLAP_THRESHOLD = 12; // 도로 중복 판정 거리 (축소)
export const ROAD_OVERLAP_RATIO = 0.3; // 30% 이상 겹치면 중복

// ============ 신호등 설정 ============
export const TRAFFIC_LIGHT_PHASE_DURATION = 5000; // 신호 주기 (5초)

// ============ 색상 ============
export const BUILDING_COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6'];
