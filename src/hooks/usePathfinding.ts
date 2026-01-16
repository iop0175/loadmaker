import { useCallback } from 'react';
import type { Point, Road } from '../types';
import { distance } from '../utils';

/**
 * 경로 탐색 로직을 담당하는 훅
 */
export function usePathfinding() {
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

  /** BFS로 최단 경로 찾기 (교차점 포함) */
  const findPath = useCallback((start: Point, end: Point, roadList: Road[]): Point[] | null => {
    if (roadList.length === 0) return null;

    // 디버깅: 고가도로 개수 확인
    const overpassRoads = roadList.filter(r => r.isOverpass);
    if (overpassRoads.length > 0) {
      console.log(`[Pathfinding] Total roads: ${roadList.length}, Overpasses: ${overpassRoads.length}`);
    }

    const getNodeKey = (p: Point) => `${Math.round(p.x)},${Math.round(p.y)}`;
    const getPointFromKey = (key: string): Point => {
      const [x, y] = key.split(',').map(Number);
      return { x, y };
    };

    const allNodes = new Set<string>();
    const nodeConnections = new Map<string, { key: string; road: Road }[]>();
    
    roadList.forEach(road => {
      allNodes.add(getNodeKey(road.start));
      allNodes.add(getNodeKey(road.end));
    });
    
    const realIntersections: { point: Point, key: string }[] = [];
    
    for (let i = 0; i < roadList.length; i++) {
      for (let j = i + 1; j < roadList.length; j++) {
        const road1 = roadList[i];
        const road2 = roadList[j];
        
        // 고가도로는 다른 도로와 교차점을 생성하지 않음
        if (road1.isOverpass || road2.isOverpass) continue;
        
        if (!road1.controlPoint && !road2.controlPoint) {
          const intersection = getLineIntersection(
            road1.start, road1.end,
            road2.start, road2.end
          );
          if (intersection) {
            const key = getNodeKey(intersection);
            realIntersections.push({ point: intersection, key });
            allNodes.add(key);
          }
        }
      }
    }
    
    roadList.forEach(road => {
      const nodesOnRoad: { point: Point; t: number; key: string }[] = [
        { point: road.start, t: 0, key: getNodeKey(road.start) },
        { point: road.end, t: 1, key: getNodeKey(road.end) }
      ];
      
      if (!road.controlPoint) {
        realIntersections.forEach(({ point: intersection, key }) => {
          const dx = road.end.x - road.start.x;
          const dy = road.end.y - road.start.y;
          const len = Math.sqrt(dx * dx + dy * dy);
          if (len === 0) return;
          
          const t = ((intersection.x - road.start.x) * dx + (intersection.y - road.start.y) * dy) / (len * len);
          if (t > 0.01 && t < 0.99) {
            const projX = road.start.x + t * dx;
            const projY = road.start.y + t * dy;
            const distToLine = Math.sqrt((intersection.x - projX) ** 2 + (intersection.y - projY) ** 2);
            if (distToLine < 3) {
              nodesOnRoad.push({ point: intersection, t, key });
            }
          }
        });
      }
      
      nodesOnRoad.sort((a, b) => a.t - b.t);
      
      for (let i = 0; i < nodesOnRoad.length - 1; i++) {
        const fromKey = nodesOnRoad[i].key;
        const toKey = nodesOnRoad[i + 1].key;
        
        if (fromKey === toKey) continue;

        if (!nodeConnections.has(fromKey)) nodeConnections.set(fromKey, []);
        if (!nodeConnections.has(toKey)) nodeConnections.set(toKey, []);
        
        const fromConns = nodeConnections.get(fromKey)!;
        if (!fromConns.some(c => c.key === toKey)) {
          fromConns.push({ key: toKey, road });
        }

        const toConns = nodeConnections.get(toKey)!;
        if (!toConns.some(c => c.key === fromKey)) {
          toConns.push({ key: fromKey, road });
        }
      }
    });

    let closestStartKey: string | null = null;
    let closestEndKey: string | null = null;
    let closestStartDist = Infinity;
    let closestEndDist = Infinity;

    const MAX_BUILDING_TO_ROAD_DISTANCE = 50;

    allNodes.forEach(key => {
      const point = getPointFromKey(key);
      const distToStart = distance(point, start);
      const distToEnd = distance(point, end);
      
      if (distToStart < closestStartDist) {
        closestStartDist = distToStart;
        closestStartKey = key;
      }
      if (distToEnd < closestEndDist) {
        closestEndDist = distToEnd;
        closestEndKey = key;
      }
    });

    if (!closestStartKey || !closestEndKey) return null;
    if (closestStartDist > MAX_BUILDING_TO_ROAD_DISTANCE) return null;
    if (closestEndDist > MAX_BUILDING_TO_ROAD_DISTANCE) return null;

    const queue: { key: string; pathKeys: string[] }[] = [
      { key: closestStartKey, pathKeys: [closestStartKey] }
    ];
    const visited = new Set<string>();
    visited.add(closestStartKey);

    while (queue.length > 0) {
      const { key, pathKeys } = queue.shift()!;

      if (key === closestEndKey) {
        return pathKeys.map(k => getPointFromKey(k));
      }

      const neighbors = nodeConnections.get(key) || [];
      for (const { key: neighborKey } of neighbors) {
        if (!visited.has(neighborKey)) {
          visited.add(neighborKey);
          queue.push({ 
            key: neighborKey, 
            pathKeys: [...pathKeys, neighborKey]
          });
        }
      }
    }
    return null;
  }, [getLineIntersection]);

  return {
    getLineIntersection,
    findPath,
  };
}
