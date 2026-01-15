/**
 * 게임 상수
 */

// ============ 캔버스 설정 ============
export const CANVAS_WIDTH = 800;
export const CANVAS_HEIGHT = 600;
export const GRID_SIZE = 20;

// ============ 차량 설정 ============
export const VEHICLE_SIZE = 6;
export const LANE_OFFSET = 5;
export const MAX_VEHICLES = 10;
export const VEHICLE_SPAWN_INTERVAL = 3000;

// ============ 게임플레이 설정 ============
export const OFFICE_WAIT_TIME = 10000; // 회사 대기 시간 (10초)
export const SCORE_PER_TRIP = 100;

// ============ 건물 배치 설정 ============
export const BUILDING_MARGIN = 60; // 캔버스 가장자리 여백
export const MIN_BUILDING_DISTANCE = 100; // 건물 간 최소 거리
export const MIN_HOME_OFFICE_DISTANCE = 200; // 집-회사 간 최소 거리

// ============ 강 설정 ============
export const RIVER_MIN_WIDTH = 40;
export const RIVER_MAX_WIDTH = 70;

// ============ 도로 설정 ============
export const ROAD_WIDTH = 24;
export const ROAD_OUTLINE_WIDTH = 28;
export const ROAD_OVERLAP_THRESHOLD = 15; // 도로 중복 판정 거리
export const ROAD_OVERLAP_RATIO = 0.3; // 30% 이상 겹치면 중복

// ============ 색상 ============
export const BUILDING_COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6'];
export const ROAD_COLOR = '#ffffff';
export const ROAD_OUTLINE_COLOR = '#9ca3af';
export const ROAD_CENTER_LINE_COLOR = '#fbbf24';
export const RIVER_COLOR = '#7dd3fc';
export const RIVER_BORDER_COLOR = '#38bdf8';
export const BACKGROUND_COLOR = '#f5f5f4';
