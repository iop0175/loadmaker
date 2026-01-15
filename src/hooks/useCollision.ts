import { useCallback } from 'react';
import type { Point, Road, Building, RiverSegment } from '../types';
import { distance, isPointInRiverStatic } from '../utils';

/**
 * 충돌 검사 관련 로직을 담당하는 훅
 */
export function useCollision(
  riverSegments: RiverSegment[],
  roads: Road[],
  buildings: Building[]
) {
  /** 점이 강 위에 있는지 확인 (수평/수직 강 모두 지원) */
  const isPointInRiver = useCallback((point: Point): boolean => {
    return isPointInRiverStatic(point, riverSegments, 10);
  }, [riverSegments]);

  /** 직선 도로가 강을 건너는지 확인 */
  const doesRoadCrossRiver = useCallback((start: Point, end: Point): boolean => {
    const steps = Math.max(Math.abs(end.x - start.x), Math.abs(end.y - start.y)) / 10;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      if (isPointInRiver({ 
        x: start.x + (end.x - start.x) * t, 
        y: start.y + (end.y - start.y) * t 
      })) return true;
    }
    return false;
  }, [isPointInRiver]);

  /** 커브 도로가 강을 건너는지 확인 */
  const doesCurveRoadCrossRiver = useCallback((start: Point, end: Point, control: Point): boolean => {
    for (let t = 0; t <= 1; t += 0.1) {
      const x = (1 - t) * (1 - t) * start.x + 2 * (1 - t) * t * control.x + t * t * end.x;
      const y = (1 - t) * (1 - t) * start.y + 2 * (1 - t) * t * control.y + t * t * end.y;
      if (isPointInRiver({ x, y })) return true;
    }
    return false;
  }, [isPointInRiver]);

  /** 점이 다리 끝점 근처인지 확인 */
  const isNearBridgeEndpoint = useCallback((point: Point): boolean => {
    const SNAP_DISTANCE = 15;
    for (const road of roads) {
      if (road.isBridge) {
        if (distance(point, road.start) < SNAP_DISTANCE || 
            distance(point, road.end) < SNAP_DISTANCE) {
          return true;
        }
      }
    }
    return false;
  }, [roads]);

  /** 도로가 건물과 충돌하는지 확인 */
  const doesRoadIntersectAnyBuilding = useCallback((
    start: Point, 
    end: Point, 
    control?: Point
  ): boolean => {
    return buildings.some(building => {
      // 시작점이나 끝점이 해당 건물인 경우는 제외 (연결 허용)
      if ((start.x === building.position.x && start.y === building.position.y) ||
          (end.x === building.position.x && end.y === building.position.y)) {
        return false;
      }

      const isHome = building.id.includes('-home');
      const width = isHome ? 36 : 40;
      const height = isHome ? 30 : 50;
      
      const left = building.position.x - width / 2;
      const right = building.position.x + width / 2;
      const top = building.position.y - height / 2;
      const bottom = building.position.y + height / 2;

      const steps = Math.ceil(distance(start, end) / 10);
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        let pX, pY;
        
        if (control) {
          pX = (1 - t) * (1 - t) * start.x + 2 * (1 - t) * t * control.x + t * t * end.x;
          pY = (1 - t) * (1 - t) * start.y + 2 * (1 - t) * t * control.y + t * t * end.y;
        } else {
          pX = start.x + (end.x - start.x) * t;
          pY = start.y + (end.y - start.y) * t;
        }
        
        if (pX > left - 2 && pX < right + 2 && pY > top - 2 && pY < bottom + 2) {
          return true;
        }
      }
      return false;
    });
  }, [buildings]);

  return {
    isPointInRiver,
    doesRoadCrossRiver,
    doesCurveRoadCrossRiver,
    isNearBridgeEndpoint,
    doesRoadIntersectAnyBuilding,
  };
}
