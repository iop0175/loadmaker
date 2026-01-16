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
    // isNearBridgeEndpoint, // 현재 사용하지 않음
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

  /** 점이 다리의 중간에 연결되는지 확인 (끝점이 아닌 중간 연결 시 true) */
  const isConnectingToBridgeMiddle = useCallback((point: Point): boolean => {
    // 다리들만 필터링
    const bridges = roads.filter(r => r.isBridge);
    
    for (const bridge of bridges) {
      // 다리의 시작점이나 끝점인 경우는 OK
      if (distance(point, bridge.start) < 3 || distance(point, bridge.end) < 3) {
        continue;
      }
      
      // 다리 중간에 연결하려는 경우 체크
      if (!bridge.controlPoint) {
        const dx = bridge.end.x - bridge.start.x;
        const dy = bridge.end.y - bridge.start.y;
        const len2 = dx * dx + dy * dy;
        if (len2 === 0) continue;
        
        // 점이 다리 선분 위에 있는지 확인
        const t = ((point.x - bridge.start.x) * dx + (point.y - bridge.start.y) * dy) / len2;
        
        if (t > 0.05 && t < 0.95) {
          const projX = bridge.start.x + t * dx;
          const projY = bridge.start.y + t * dy;
          const dist = Math.sqrt((point.x - projX) ** 2 + (point.y - projY) ** 2);
          
          // 다리 중간에 가깝다면 중간 연결 시도
          if (dist < 20) {
            return true;
          }
        }
      }
    }
    
    return false;
  }, [roads]);

  /** 다리 끝점에 이미 도로가 연결되어 있는지 확인 */
  const isBridgeEndpointAlreadyConnected = useCallback((point: Point): boolean => {
    // 다리들만 필터링
    const bridges = roads.filter(r => r.isBridge);
    
    for (const bridge of bridges) {
      // 점이 다리의 끝점인지 확인
      const isAtBridgeStart = distance(point, bridge.start) < 3;
      const isAtBridgeEnd = distance(point, bridge.end) < 3;
      
      if (isAtBridgeStart || isAtBridgeEnd) {
        const bridgeEndpoint = isAtBridgeStart ? bridge.start : bridge.end;
        
        // 이 끝점에 연결된 도로 수 세기 (다리 자체 제외)
        const connectedRoads = roads.filter(r => {
          if (r.id === bridge.id) return false; // 다리 자체 제외
          return distance(r.start, bridgeEndpoint) < 3 || distance(r.end, bridgeEndpoint) < 3;
        });
        
        // 이미 1개 이상의 도로가 연결되어 있으면 추가 연결 불가
        if (connectedRoads.length >= 1) {
          return true;
        }
      }
    }
    
    return false;
  }, [roads]);

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
    // pan 도구일 때는 도로 그리기 비활성화
    if (activeTool === 'pan') {
      return;
    }

    if (e.button === 1) {
      e.preventDefault();
      isPanning.current = true;
      lastPanPos.current = { x: e.clientX, y: e.clientY };
      return;
    }

    const canvas = e.target as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();
    
    // 캔버스 스케일링 비율 계산 (CSS 크기 vs 실제 캔버스 크기)
    // CSS transform scale 적용 시 getBoundingClientRect()가 확대된 크기를 반환하므로
    // scaleX/scaleY에 이미 zoom이 반영되어 있음
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const rawPoint = { 
      x: (e.clientX - rect.left) * scaleX, 
      y: (e.clientY - rect.top) * scaleY 
    };

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
  }, [activeTool, intersections, trafficLightCount, snapToRoadEndpoint, setIntersections, setTrafficLightCount, setActiveTool, showWarning, t]);

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
    
    const canvas = e.target as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();
    
    // 캔버스 스케일링 비율 계산 (CSS 크기 vs 실제 캔버스 크기)
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const rawPoint = { 
      x: (e.clientX - rect.left) * scaleX, 
      y: (e.clientY - rect.top) * scaleY 
    };
    
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
  }, [isDrawing, drawStart, isOrthoMode, isCurveMode, activeTool, snapToRoadEndpoint]);

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
        
        // 다리 중간 연결 체크 (시작점 또는 끝점이 다리 중간에 연결되는 경우)
        const connectsToBridgeMiddle = isConnectingToBridgeMiddle(drawStart) || isConnectingToBridgeMiddle(currentEnd);
        
        if (connectsToBridgeMiddle) {
          showWarning(language === 'ko' ? '다리의 양쪽 끝점에만 도로를 연결할 수 있습니다' : 'Roads can only connect to bridge endpoints');
          setIsDrawing(false);
          setDrawStart(null);
          setCurrentEnd(null);
          setControlPoint(null);
          return;
        }
        
        // 다리 끝점에 이미 도로가 연결되어 있는지 체크
        const bridgeEndpointConnected = isBridgeEndpointAlreadyConnected(drawStart) || isBridgeEndpointAlreadyConnected(currentEnd);
        
        if (bridgeEndpointConnected) {
          showWarning(language === 'ko' ? '다리 끝점에는 1개의 도로만 연결할 수 있습니다' : 'Only one road can connect to a bridge endpoint');
          setIsDrawing(false);
          setDrawStart(null);
          setCurrentEnd(null);
          setControlPoint(null);
          return;
        }
        
        if (!overlapsRoad && !overlapsBuilding) {
          const dist = distance(drawStart, currentEnd);
          let cost = Math.ceil(dist);
          
          let roadType: 'normal' | 'highway' = 'normal';
          let isBridgeVal: boolean | undefined = undefined;

          if (activeTool === 'highway') {
            // 고속도로: 강을 건너면 무조건 불가
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
            // 일반 도로: 강을 건너면 무조건 불가 (다리 끝점 연결 여부와 무관)
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
    activeTool, score, bridgeCount, highwayCount, language,
    doesRoadCrossRiver, doesCurveRoadCrossRiver, doesRoadIntersectAnyBuilding,
    findIntersections, getRoadAtPoint, isConnectingToBridgeMiddle, isBridgeEndpointAlreadyConnected,
    setRoads, setIntersections, setScore, setBridgeCount, setHighwayCount, showWarning, t
  ]);

  /** 도로 삭제 */
  const deleteRoad = useCallback((road: Road) => {
    // 도로 타입에 따라 아이템 복구
    if (road.isBridge) {
      setBridgeCount(prev => prev + 1);
    } else if (road.type === 'highway') {
      setHighwayCount(prev => prev + 1);
    }
    
    setRoads(prev => prev.filter(r => r !== road));
    setSelectedRoad(null);
  }, [setRoads, setBridgeCount, setHighwayCount]);

  /** 터치 시작 (모바일) */
  const handleTouchStart = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    // pan 도구일 때는 도로 그리기 비활성화
    if (activeTool === 'pan') {
      return;
    }

    if (e.touches.length !== 1) return;
    e.preventDefault();
    const touch = e.touches[0];
    const canvas = e.target as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();
    
    // 캔버스 스케일링 비율 계산 (CSS 크기 vs 실제 캔버스 크기)
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const rawPoint = { 
      x: (touch.clientX - rect.left) * scaleX, 
      y: (touch.clientY - rect.top) * scaleY 
    };

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
  }, [activeTool, intersections, trafficLightCount, snapToRoadEndpoint, setIntersections, setTrafficLightCount, setActiveTool, showWarning, t]);

  /** 터치 이동 (모바일) */
  const handleTouchMove = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length !== 1) return;
    e.preventDefault();
    if (!isDrawing || !drawStart) return;
    
    const touch = e.touches[0];
    const canvas = e.target as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();
    
    // 캔버스 스케일링 비율 계산 (CSS 크기 vs 실제 캔버스 크기)
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const rawPoint = { 
      x: (touch.clientX - rect.left) * scaleX, 
      y: (touch.clientY - rect.top) * scaleY 
    };
    
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
    setControlPoint(null); // 모바일에서는 커브 모드 비활성화
  }, [isDrawing, drawStart, isOrthoMode, activeTool, snapToRoadEndpoint]);

  /** 터치 종료 (모바일) */
  const handleTouchEnd = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    handleMouseUp();
  }, [handleMouseUp]);

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
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    deleteRoad,
    getRoadAtPoint,
    snapToRoadEndpoint,
  };
}
