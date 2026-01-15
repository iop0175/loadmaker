/**
 * useRoadDrawing Hook
 * 도로 그리기 관련 로직 (마우스 이벤트, 스냅, 비용 계산)
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type { Point, Road, Building, Intersection, RiverSegment } from '../types';
import type { Language } from '../i18n';
import { getTranslations } from '../i18n';
import type { ActiveTool } from '../components/ui';
import { GRID_SIZE } from '../constants';
import { distance, snapToGrid, doRoadsOverlap } from '../utils';
import { useCollision } from './useCollision';
import { useIntersections } from './useIntersections';

interface UseRoadDrawingProps {
  roads: Road[];
  setRoads: React.Dispatch<React.SetStateAction<Road[]>>;
  buildings: Building[];
  intersections: Intersection[];
  setIntersections: React.Dispatch<React.SetStateAction<Intersection[]>>;
  riverSegments: RiverSegment[];
  activeTool: ActiveTool;
  setActiveTool: React.Dispatch<React.SetStateAction<ActiveTool>>;
  score: number;
  setScore: React.Dispatch<React.SetStateAction<number>>;
  bridgeCount: number;
  setBridgeCount: React.Dispatch<React.SetStateAction<number>>;
  highwayCount: number;
  setHighwayCount: React.Dispatch<React.SetStateAction<number>>;
  trafficLightCount: number;
  setTrafficLightCount: React.Dispatch<React.SetStateAction<number>>;
  zoom: number;
  language: Language;
  showWarning: (message: string) => void;
}

export function useRoadDrawing({
  roads,
  setRoads,
  buildings,
  intersections,
  setIntersections,
  riverSegments,
  activeTool,
  setActiveTool,
  score,
  setScore,
  bridgeCount,
  setBridgeCount,
  highwayCount,
  setHighwayCount,
  trafficLightCount,
  setTrafficLightCount,
  zoom,
  language,
  showWarning,
}: UseRoadDrawingProps) {
  const t = getTranslations(language);
  
  // 그리기 상태
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState<Point | null>(null);
  const [currentEnd, setCurrentEnd] = useState<Point | null>(null);
  const [controlPoint, setControlPoint] = useState<Point | null>(null);
  const [isCurveMode, setIsCurveMode] = useState(false);
  const [isOrthoMode, setIsOrthoMode] = useState(false);
  const [selectedRoad, setSelectedRoad] = useState<Road | null>(null);

  // 패닝 상태
  const isPanning = useRef(false);
  const lastPanPos = useRef({ x: 0, y: 0 });

  // 충돌 검사 훅
  const { 
    doesRoadCrossRiver, 
    doesCurveRoadCrossRiver,
    doesRoadIntersectAnyBuilding,
  } = useCollision(riverSegments, roads, buildings);
  
  const { findIntersections } = useIntersections();

  /** 기존 도로 끝점에 스냅 */
  const snapToRoadEndpoint = useCallback((point: Point, snapDistance: number = 15): Point => {
    let closest: Point | null = null;
    let closestDist = Infinity;
    
    roads.forEach(road => {
      const distToStart = distance(point, road.start);
      const distToEnd = distance(point, road.end);
      
      if (distToStart < closestDist && distToStart < snapDistance) {
        closestDist = distToStart;
        closest = road.start;
      }
      if (distToEnd < closestDist && distToEnd < snapDistance) {
        closestDist = distToEnd;
        closest = road.end;
      }
    });
    
    intersections.forEach(intersection => {
      const distToIntersection = distance(point, intersection.point);
      if (distToIntersection < closestDist && distToIntersection < snapDistance) {
        closestDist = distToIntersection;
        closest = intersection.point;
      }
    });

    buildings.forEach(building => {
      const distToBuilding = distance(point, building.position);
      if (distToBuilding < closestDist && distToBuilding < snapDistance + 10) {
        closestDist = distToBuilding;
        closest = building.position;
      }
    });

    if (closest) return closest;

    roads.forEach(road => {
      if (road.controlPoint) return;
      
      const dx = road.end.x - road.start.x;
      const dy = road.end.y - road.start.y;
      const len2 = dx * dx + dy * dy;
      if (len2 === 0) return;
      
      const t = ((point.x - road.start.x) * dx + (point.y - road.start.y) * dy) / len2;
      
      if (t > 0.05 && t < 0.95) {
        const projX = road.start.x + t * dx;
        const projY = road.start.y + t * dy;
        const dist = Math.sqrt((point.x - projX) ** 2 + (point.y - projY) ** 2);
        
        if (dist < closestDist && dist < snapDistance) {
          closestDist = dist;
          closest = { x: projX, y: projY };
        }
      }
    });
    
    return closest || point;
  }, [roads, intersections, buildings]);

  /** 클릭한 위치의 도로 찾기 */
  const getRoadAtPoint = useCallback((point: Point): Road | null => {
    for (let i = roads.length - 1; i >= 0; i--) {
      const road = roads[i];
      if (road.controlPoint) {
        const steps = 20;
        for (let t = 0; t <= 1; t += 1 / steps) {
          const bx = (1 - t) * (1 - t) * road.start.x + 2 * (1 - t) * t * road.controlPoint.x + t * t * road.end.x;
          const by = (1 - t) * (1 - t) * road.start.y + 2 * (1 - t) * t * road.controlPoint.y + t * t * road.end.y;
          if (distance(point, { x: bx, y: by }) < 20) return road;
        }
      } else {
        const d = distance(road.start, road.end);
        const steps = Math.ceil(d / 10);
        for (let j = 0; j <= steps; j++) {
          const t = j / steps;
          const lx = road.start.x + (road.end.x - road.start.x) * t;
          const ly = road.start.y + (road.end.y - road.start.y) * t;
          if (distance(point, { x: lx, y: ly }) < 20) return road;
        }
      }
    }
    return null;
  }, [roads]);

  /** 키보드 이벤트 */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift') setIsCurveMode(true);
      if (e.code === 'KeyF') setIsOrthoMode(true);
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') setIsCurveMode(false);
      if (e.code === 'KeyF') setIsOrthoMode(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  /** 마우스 다운 */
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button === 1) {
      e.preventDefault();
      isPanning.current = true;
      lastPanPos.current = { x: e.clientX, y: e.clientY };
      return;
    }

    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
    const rawPoint = { x: (e.clientX - rect.left) / zoom, y: (e.clientY - rect.top) / zoom };

    // 신호등 모드: 교차로에 신호등 설치
    if (activeTool === 'traffic-light') {
      const nearestIntersection = intersections.find(
        inter => distance(rawPoint, inter.point) < 25
      );
      
      if (nearestIntersection) {
        if (trafficLightCount <= 0) {
          showWarning(t.noTrafficLights);
          return;
        }
        if (nearestIntersection.hasTrafficLight) {
          showWarning(t.alreadyTrafficLight);
          return;
        }
        
        setIntersections(prev => prev.map(inter => {
          if (inter.point.x === nearestIntersection.point.x && 
              inter.point.y === nearestIntersection.point.y) {
            return {
              ...inter,
              hasTrafficLight: true,
              trafficLightPhase: 'ns',
              phaseStartTime: Date.now(),
            };
          }
          return inter;
        }));
        setTrafficLightCount(prev => prev - 1);
        setActiveTool('normal');
      } else {
        showWarning(t.clickNearIntersection);
      }
      return;
    }

    const snappedToRoad = snapToRoadEndpoint(rawPoint);
    setSelectedRoad(null);
    
    const point = snappedToRoad !== rawPoint ? snappedToRoad : snapToGrid(rawPoint);
    setIsDrawing(true);
    setDrawStart(point);
    setCurrentEnd(point);
    setControlPoint(null);
  }, [zoom, activeTool, intersections, trafficLightCount, snapToRoadEndpoint, setIntersections, setTrafficLightCount, setActiveTool, showWarning, t]);

  /** 마우스 이동 */
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isPanning.current) {
      const dx = e.clientX - lastPanPos.current.x;
      const dy = e.clientY - lastPanPos.current.y;
      const target = e.target as HTMLCanvasElement;
      if (target.parentElement) {
        target.parentElement.scrollLeft -= dx;
        target.parentElement.scrollTop -= dy;
      }
      lastPanPos.current = { x: e.clientX, y: e.clientY };
      return;
    }

    if (!isDrawing || !drawStart) return;
    
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
    const rawPoint = { x: (e.clientX - rect.left) / zoom, y: (e.clientY - rect.top) / zoom };
    
    let point: Point;
    if (isOrthoMode) {
      let candidate = snapToRoadEndpoint(rawPoint);
      
      if (candidate !== rawPoint) {
        const dx = Math.abs(candidate.x - drawStart.x);
        const dy = Math.abs(candidate.y - drawStart.y);
        if (dx > 5 && dy > 5) {
          candidate = rawPoint;
        }
      }
      
      if (candidate !== rawPoint) {
        point = candidate;
      } else {
        const gridP = snapToGrid(rawPoint);
        const dx = Math.abs(gridP.x - drawStart.x);
        const dy = Math.abs(gridP.y - drawStart.y);
        if (dx > dy) {
          point = { x: gridP.x, y: drawStart.y };
        } else {
          point = { x: drawStart.x, y: gridP.y };
        }
      }
    } else {
      const snapped = snapToRoadEndpoint(rawPoint);
      point = snapped !== rawPoint ? snapped : snapToGrid(rawPoint);
    }

    // 다리 모드 길이 제한
    if (activeTool === 'bridge') {
      const dist = distance(drawStart, point);
      const MAX_BRIDGE_LENGTH = 120;
      if (dist > MAX_BRIDGE_LENGTH) {
        const dx = point.x - drawStart.x;
        const dy = point.y - drawStart.y;
        const ratio = MAX_BRIDGE_LENGTH / dist;
        point = {
          x: drawStart.x + dx * ratio,
          y: drawStart.y + dy * ratio,
        };
      }
    }

    setCurrentEnd(point);

    if (isCurveMode) {
      const midX = (drawStart.x + point.x) / 2;
      const midY = (drawStart.y + point.y) / 2;
      const dx = point.x - drawStart.x;
      const dy = point.y - drawStart.y;
      const length = Math.sqrt(dx * dx + dy * dy);
      
      if (length > 0) {
        const perpX = -dy / length;
        const perpY = dx / length;
        const curveStrength = length * 0.4;
        const mouseToMidX = rawPoint.x - midX;
        const mouseToMidY = rawPoint.y - midY;
        const dotProduct = mouseToMidX * perpX + mouseToMidY * perpY;
        const side = dotProduct > 0 ? 1 : -1;
        setControlPoint({
          x: midX + perpX * curveStrength * side,
          y: midY + perpY * curveStrength * side,
        });
      }
    } else {
      setControlPoint(null);
    }
  }, [isDrawing, drawStart, zoom, isOrthoMode, isCurveMode, activeTool, snapToRoadEndpoint]);

  /** 마우스 업 */
  const handleMouseUp = useCallback(() => {
    if (isPanning.current) {
      isPanning.current = false;
      return;
    }

    if (isDrawing && drawStart && currentEnd) {
      if (distance(drawStart, currentEnd) > GRID_SIZE) {
        const crossesRiver = controlPoint
          ? doesCurveRoadCrossRiver(drawStart, currentEnd, controlPoint)
          : doesRoadCrossRiver(drawStart, currentEnd);
        
        const overlapsRoad = doRoadsOverlap(drawStart, currentEnd, roads, controlPoint || undefined);
        const overlapsBuilding = doesRoadIntersectAnyBuilding(drawStart, currentEnd, controlPoint || undefined);
        
        if (!overlapsRoad && !overlapsBuilding) {
          const dist = distance(drawStart, currentEnd);
          let cost = Math.ceil(dist);
          
          let roadType: 'normal' | 'highway' = 'normal';
          let isBridgeVal: boolean | undefined = undefined;

          if (activeTool === 'highway') {
            if (crossesRiver) {
              showWarning(t.highwayCannotCrossRiver);
              setIsDrawing(false);
              setDrawStart(null);
              setCurrentEnd(null);
              setControlPoint(null);
              return;
            }
            if (highwayCount <= 0) {
              showWarning(t.noHighwayItems);
              setIsDrawing(false);
              setDrawStart(null);
              setCurrentEnd(null);
              setControlPoint(null);
              return;
            }
            roadType = 'highway';
          } else if (activeTool === 'bridge') {
            if (crossesRiver) {
              if (bridgeCount <= 0) {
                showWarning(t.noBridgeItems);
                setIsDrawing(false);
                setDrawStart(null);
                setCurrentEnd(null);
                setControlPoint(null);
                return;
              }
              cost = 0;
              isBridgeVal = true;
            }
          } else {
            if (crossesRiver) {
              showWarning(t.needBridgeMode);
              setIsDrawing(false);
              setDrawStart(null);
              setCurrentEnd(null);
              setControlPoint(null);
              return;
            }
          }

          if (score < cost) {
            showWarning(t.notEnoughPoints);
            setIsDrawing(false);
            setDrawStart(null);
            setCurrentEnd(null);
            setControlPoint(null);
            return;
          }

          if (roadType === 'highway') {
            setHighwayCount(prev => prev - 1);
          }
          if (isBridgeVal) {
            setBridgeCount(prev => prev - 1);
          }

          let finalRoads = [...roads];

          const checkAndSplit = (snapPoint: Point) => {
            const targetIndex = finalRoads.findIndex(r => {
              if (r.controlPoint) return false;
              if (distance(snapPoint, r.start) < 2 || distance(snapPoint, r.end) < 2) return false;
              
              const dx = r.end.x - r.start.x;
              const dy = r.end.y - r.start.y;
              const len2 = dx * dx + dy * dy;
              if (len2 === 0) return false;
              
              const t = ((snapPoint.x - r.start.x) * dx + (snapPoint.y - r.start.y) * dy) / len2;
              if (t > 0.001 && t < 0.999) {
                const projX = r.start.x + t * dx;
                const projY = r.start.y + t * dy;
                return distance(snapPoint, { x: projX, y: projY }) < 3;
              }
              return false;
            });

            if (targetIndex !== -1) {
              const target = finalRoads[targetIndex];
              const timestamp = Date.now();
              const r1: Road = { ...target, id: `${target.id}-splitA-${timestamp}`, end: snapPoint };
              const r2: Road = { ...target, id: `${target.id}-splitB-${timestamp}`, start: snapPoint };
              finalRoads.splice(targetIndex, 1, r1, r2);
            }
          };

          checkAndSplit(drawStart);
          checkAndSplit(currentEnd);

          const newRoad: Road = {
            id: `road-${Date.now()}`,
            start: drawStart,
            end: currentEnd,
            controlPoint: controlPoint || undefined,
            isBridge: isBridgeVal,
            type: roadType,
          };
          
          finalRoads.push(newRoad);
          setRoads(finalRoads);
          setIntersections(findIntersections(finalRoads, buildings));
          setScore(prev => prev - cost);
        }
      } else {
        const road = getRoadAtPoint(drawStart);
        if (road) {
          setSelectedRoad(road);
        } else {
          setSelectedRoad(null);
        }
      }
    }
    setIsDrawing(false);
    setDrawStart(null);
    setCurrentEnd(null);
    setControlPoint(null);
  }, [
    isDrawing, drawStart, currentEnd, controlPoint, roads, buildings,
    activeTool, score, bridgeCount, highwayCount,
    doesRoadCrossRiver, doesCurveRoadCrossRiver, doesRoadIntersectAnyBuilding,
    findIntersections, getRoadAtPoint, setRoads, setIntersections, setScore,
    setBridgeCount, setHighwayCount, showWarning, t
  ]);

  /** 도로 삭제 */
  const deleteRoad = useCallback((road: Road) => {
    setRoads(prev => prev.filter(r => r !== road));
    setSelectedRoad(null);
  }, [setRoads]);

  return {
    isDrawing,
    drawStart,
    currentEnd,
    controlPoint,
    isCurveMode,
    isOrthoMode,
    selectedRoad,
    setSelectedRoad,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    deleteRoad,
    getRoadAtPoint,
    snapToRoadEndpoint,
  };
}
