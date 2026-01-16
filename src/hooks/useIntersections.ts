import { useCallback } from 'react';
import type { Point, Road, Intersection, Building } from '../types';
import { distance } from '../utils';

/**
 * 교차점 감지 및 관리 로직을 담당하는 훅
 */
export function useIntersections() {
  /** 두 선분의 교차점 계산 */
  const getLineIntersection = useCallback((
    p1: Point, p2: Point, p3: Point, p4: Point
  ): Point | null => {
    const d1x = p2.x - p1.x;
    const d1y = p2.y - p1.y;
    const d2x = p4.x - p3.x;
    const d2y = p4.y - p3.y;
    
    const cross = d1x * d2y - d1y * d2x;
    if (Math.abs(cross) < 0.0001) return null;
    
    const t = ((p3.x - p1.x) * d2y - (p3.y - p1.y) * d2x) / cross;
    const u = ((p3.x - p1.x) * d1y - (p3.y - p1.y) * d1x) / cross;
    
    if (t >= 0.01 && t <= 0.99 && u >= 0.01 && u <= 0.99) {
      return {
        x: Math.round(p1.x + t * d1x),
        y: Math.round(p1.y + t * d1y)
      };
    }
    return null;
  }, []);
  
  /** 점이 건물 위에 있는지 확인 */
  const isPointOnBuilding = useCallback((point: Point, buildings: Building[]): boolean => {
    return buildings.some(building => {
      // 건물 중심점과 가까운 경우 (건물 연결점) - 5px 이내
      if (distance(point, building.position) < 5) {
        return true;
      }
      
      const isHome = building.id.includes('-home');
      const width = isHome ? 36 : 40;
      const height = isHome ? 30 : 50;
      
      const left = building.position.x - width / 2 - 5;
      const right = building.position.x + width / 2 + 5;
      const top = building.position.y - height / 2 - 5;
      const bottom = building.position.y + height / 2 + 5;
      
      return point.x >= left && point.x <= right && point.y >= top && point.y <= bottom;
    });
  }, []);

  /** 점이 건물 근처(연결점)에 있는지 확인 - 건물 연결점에서만 교차로 제외 */
  const isNearBuilding = useCallback((point: Point, buildings: Building[]): boolean => {
    return buildings.some(building => {
      const isHome = building.id.includes('-home');
      const width = isHome ? 36 : 40;
      const height = isHome ? 30 : 50;
      
      // 건물 영역 + 25px 여백 (도로 연결점 포함 - 50에서 25로 줄임)
      const margin = 25;
      const left = building.position.x - width / 2 - margin;
      const right = building.position.x + width / 2 + margin;
      const top = building.position.y - height / 2 - margin;
      const bottom = building.position.y + height / 2 + margin;
      
      return point.x >= left && point.x <= right && point.y >= top && point.y <= bottom;
    });
  }, []);

  /** 점이 다리 끝점인지 확인 */
  const isBridgeEndpoint = useCallback((point: Point, roads: Road[]): boolean => {
    // 다리 도로들 찾기 (isBridge로 확인)
    const bridges = roads.filter(r => r.isBridge);
    
    // 이 점에서 다리가 시작하거나 끝나는지 확인
    const hasBridgeConnection = bridges.some(bridge => 
      distance(bridge.start, point) < 1 || distance(bridge.end, point) < 1
    );
    
    // 다리와 연결된 점이면 무조건 교차로가 아님
    if (hasBridgeConnection) {
      return true;
    }
    
    return false;
  }, []);

  /** 교차점 찾기 (끝점 교차 + 중간 교차) */
  const findIntersections = useCallback((roadList: Road[], buildings: Building[] = []): Intersection[] => {
    const points = new Map<string, number>();
    
    // 1. 도로 끝점 교차 (2개 이상의 도로가 같은 점에서 만남)
    roadList.forEach(road => {
      const startKey = `${road.start.x},${road.start.y}`;
      const endKey = `${road.end.x},${road.end.y}`;
      points.set(startKey, (points.get(startKey) || 0) + 1);
      points.set(endKey, (points.get(endKey) || 0) + 1);
    });
    
    const result: Intersection[] = [];
    points.forEach((count, key) => {
      if (count >= 2) {
        const [x, y] = key.split(',').map(Number);
        
        // 직선 구간인지 확인 (2갈래이고 각도가 180도에 가까운 경우 교차점 제외)
        if (count === 2) {
          const point = { x, y };
          const connectedRoads = roadList.filter(r => 
            distance(r.start, point) < 0.5 || 
            distance(r.end, point) < 0.5
          );
          
          if (connectedRoads.length === 2 && !connectedRoads[0].controlPoint && !connectedRoads[1].controlPoint) {
            const v1 = (distance(connectedRoads[0].start, point) < 0.5) 
              ? { x: connectedRoads[0].end.x - x, y: connectedRoads[0].end.y - y }
              : { x: connectedRoads[0].start.x - x, y: connectedRoads[0].start.y - y };

            const v2 = (distance(connectedRoads[1].start, point) < 0.5)
              ? { x: connectedRoads[1].end.x - x, y: connectedRoads[1].end.y - y }
              : { x: connectedRoads[1].start.x - x, y: connectedRoads[1].start.y - y };
            
            const len1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
            const len2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);
            
            if (len1 > 0 && len2 > 0) {
              const dot = (v1.x * v2.x + v1.y * v2.y) / (len1 * len2);
              if (dot < -0.95) { 
                return;
              }
            }
          }
        }

        // 건물 위 또는 건물 근처(연결점)의 점은 교차로로 취급하지 않음
        // 다리 끝점도 교차로로 취급하지 않음 (다리와 첫 연결 도로)
        const pointObj = { x, y };
        if (!isPointOnBuilding(pointObj, buildings) && 
            !isNearBuilding(pointObj, buildings) && 
            !isBridgeEndpoint(pointObj, roadList)) {
          result.push({ point: pointObj, vehicleCount: 0 });
        }
      }
    });
    
    // 2. 도로 중간 교차 (두 도로가 중간에서 만남)
    for (let i = 0; i < roadList.length; i++) {
      for (let j = i + 1; j < roadList.length; j++) {
        const road1 = roadList[i];
        const road2 = roadList[j];
        
        // 직선 도로 간 교차 감지
        if (!road1.controlPoint && !road2.controlPoint) {
          const intersection = getLineIntersection(
            road1.start, road1.end,
            road2.start, road2.end
          );
          if (intersection && !isPointOnBuilding(intersection, buildings) && !isNearBuilding(intersection, buildings)) {
            if (!result.some(r => 
              Math.abs(r.point.x - intersection.x) < 5 && 
              Math.abs(r.point.y - intersection.y) < 5
            )) {
              result.push({ point: intersection, vehicleCount: 0 });
            }
          }
        }
        
        // 곡선 도로와 직선 도로 간 교차 감지 (간략화: 곡선을 직선으로 근사)
        if ((road1.controlPoint && !road2.controlPoint) || (!road1.controlPoint && road2.controlPoint)) {
          const curveRoad = road1.controlPoint ? road1 : road2;
          const lineRoad = road1.controlPoint ? road2 : road1;
          
          // 곡선의 시작-끝을 직선으로 근사하여 교차 검사
          const intersection = getLineIntersection(
            curveRoad.start, curveRoad.end,
            lineRoad.start, lineRoad.end
          );
          if (intersection && !isPointOnBuilding(intersection, buildings) && !isNearBuilding(intersection, buildings)) {
            if (!result.some(r => 
              Math.abs(r.point.x - intersection.x) < 8 && 
              Math.abs(r.point.y - intersection.y) < 8
            )) {
              result.push({ point: intersection, vehicleCount: 0 });
            }
          }
        }
      }
    }
    
    return result;
  }, [getLineIntersection, isPointOnBuilding, isNearBuilding, isBridgeEndpoint]);

  return {
    getLineIntersection,
    findIntersections,
  };
}
