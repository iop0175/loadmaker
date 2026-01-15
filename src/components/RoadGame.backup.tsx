/**
 * City Road Builder - 도시 도로 건설 게임
 * 
 * 게임 규칙:
 * - 마우스 드래그로 도로 건설
 * - Shift + 드래그로 커브 도로 건설
 * - 강 위에는 도로 건설 불가
 * - 기존 도로와 겹치는 도로 건설 불가 (교차점만 허용)
 * - 차량이 집 → 회사 → 집 사이클 완료 시 점수 획득
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { Point, Road, Building, Vehicle, Intersection, RiverSegment } from '../types';
import { 
  CANVAS_WIDTH, 
  CANVAS_HEIGHT, 
  GRID_SIZE, 
  VEHICLE_SIZE,
  VEHICLE_SPEED,
  MAX_VEHICLES,
  VEHICLE_SPAWN_INTERVAL,
  OFFICE_WAIT_TIME,
  SCORE_PER_TRIP,
  MAX_VEHICLES_PER_HOME,
  MAX_VEHICLES_PER_OFFICE,
  ROAD_WIDTH,
  ROAD_OUTLINE_WIDTH,
  BUILDING_COLORS,
} from '../constants';
import { 
  distance, 
  snapToGrid, 
  shadeColor, 
  generateRandomRiver,
  generateRandomBuildings,
  generateBuildingPair,
  generateHome,
  generateOffice,
  doRoadsOverlap,
  getLaneOffset,
  interpolatePath,
} from '../utils';

// ============ 메인 컴포넌트 ============

const RoadGame: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // 게임 상태
  const [roads, setRoads] = useState<Road[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const vehiclesRef = useRef(vehicles);
  vehiclesRef.current = vehicles;

  // 맵 크기 상태
  const [mapSize, setMapSize] = useState({ width: CANVAS_WIDTH, height: CANVAS_HEIGHT });

  const [intersections, setIntersections] = useState<Intersection[]>([]);
  const [score, setScore] = useState(500);
  const [gameTime, setGameTime] = useState(0);
  const [bridgeCount, setBridgeCount] = useState(1);
  const [highwayCount, setHighwayCount] = useState(1);
  const [activeTool, setActiveTool] = useState<'normal' | 'bridge' | 'highway'>('normal');
  const [destroyedCount, setDestroyedCount] = useState(0);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isPaused, setIsPaused] = useState(false); // 일시정지 상태

  // 도로 그리기 상태
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState<Point | null>(null);
  const [currentEnd, setCurrentEnd] = useState<Point | null>(null);
  const [controlPoint, setControlPoint] = useState<Point | null>(null);
  const [isCurveMode, setIsCurveMode] = useState(false);
  const [isOrthoMode, setIsOrthoMode] = useState(false);
  const [gameSpeed, setGameSpeed] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [selectedRoad, setSelectedRoad] = useState<Road | null>(null);

  // 화면 패닝 상태
  const isPanning = useRef(false);
  const lastPanPos = useRef({ x: 0, y: 0 });

  // 월드 상태 (재생성 가능)
  // hasRiver 상태 삭제 (항상 강 있음)
  const [riverSegments, setRiverSegments] = useState<RiverSegment[]>(() => generateRandomRiver());
  const [buildings, setBuildings] = useState<Building[]>(() => generateRandomBuildings(riverSegments, 1));

  // 새 게임 시작 (항상 강 있음)
  const startNewGame = useCallback(() => {
    // 맵 크기 초기화
    const initialWidth = CANVAS_WIDTH;
    const initialHeight = CANVAS_HEIGHT;
    setMapSize({ width: initialWidth, height: initialHeight });

    // 강은 최대 크기(1000x750)로 미리 생성하여 확장 시 끊김 방지
    const newRiver = generateRandomRiver(1000, 750);
    setRiverSegments(newRiver);
    
    // 건물은 초기 크기 안에서만 생성
    setBuildings(generateRandomBuildings(newRiver, 1, initialWidth, initialHeight));
    
    setRoads([]);
    setVehicles([]);
    setIntersections([]);
    
    setScore(500); // 초기 자금 500점
    setGameTime(0);
    setBridgeCount(1);
    setHighwayCount(1);
    setActiveTool('normal');
    setDestroyedCount(0);
    setIsGameOver(false);
    setIsPaused(false);
  }, []);

  // 생존 시간 타이머
  useEffect(() => {
    if (isGameOver || isPaused) return;
    const timer = setInterval(() => {
      setGameTime(prev => prev + 1);
    }, 1000 / gameSpeed);
    return () => clearInterval(timer);
  }, [isGameOver, isPaused, gameSpeed]);

  // 점수에 따른 건물 추가 생성 (정교한 레벨링)
  useEffect(() => {
    // 맵 확장 로직 (레벨업)
    const basePairsCount = buildings.filter(b => !b.id.split('-')[2] && b.id.includes('home')).length;

    // 레벨 3 (4세트 진입 시점) -> 확장 (최대 1000x750 픽셀로 제한)
    if (basePairsCount >= 3 && mapSize.width === CANVAS_WIDTH) {
       setMapSize({ width: 1000, height: 750 });
    }
    // 추가 확장은 하지 않음 (사용자 요청: 무분별한 확장 방지)

    // 초기 5세트 (pairs) 관리: 1000, 3000, 6000, 10000
    const LEVEL_THRESHOLDS = [1000, 3000, 6000, 10000];
    
    if (basePairsCount < 5) {
      // 다음 레벨 체크
      if (basePairsCount > 0) { // Safety check
        const nextThreshold = LEVEL_THRESHOLDS[basePairsCount - 1]; 
        if (score >= nextThreshold) {
           // roads 정보 전달하여 건물 생성 시 도로 회피
           const newPair = generateBuildingPair(
             basePairsCount, 
             buildings, 
             riverSegments, 
             mapSize.width, 
             mapSize.height, 
             roads
           );
           setBuildings(prev => [...prev, ...newPair]);
        }
      }
    } else {
      // 5세트 완료 (10000점 도달) 후: 집/회사 개별 추가
      const baseScore = 10000;
      const extraScore = Math.max(0, score - baseScore);
      
      // 집: 5000점마다 추가
      // 기본 5개 + 추가분
      const targetHomes = 5 + Math.floor(extraScore / 5000);
      const currentHomes = buildings.filter(b => b.id.includes('home')).length;
      
      if (targetHomes > currentHomes) {
         // 색상은 순와하며 사용
         const colorIdx = (currentHomes) % 5;
         const newHome = generateHome(
           colorIdx, 
           buildings, 
           riverSegments, 
           mapSize.width, 
           mapSize.height, 
           roads
         );
         setBuildings(prev => [...prev, newHome]);
      }
      
      // 회사: 10000점마다 추가
      const targetOffices = 5 + Math.floor(extraScore / 10000);
      const currentOffices = buildings.filter(b => b.id.includes('office')).length;
      
      if (targetOffices > currentOffices) {
         const colorIdx = (currentOffices) % 5;
         const targetColor = BUILDING_COLORS[colorIdx];

         // 조건: 해당 색상의 집이 있어야 하고, 회사가 집보다 적어야 함
         const sameColorHomes = buildings.filter(b => b.id.includes('home') && b.color === targetColor).length;
         const sameColorOffices = buildings.filter(b => b.id.includes('office') && b.color === targetColor).length;

         if (sameColorHomes > 0 && sameColorOffices < sameColorHomes) {
             const newOffice = generateOffice(
               colorIdx, 
               buildings, 
               riverSegments, 
               mapSize.width, 
               mapSize.height, 
               roads
             );
             setBuildings(prev => [...prev, newOffice]);
         }
      }
    }
  }, [score, buildings, riverSegments, mapSize, roads]); // roads 의존성 추가

  // ============ 강 충돌 검사 ============

  /** X 좌표에서 강의 Y 위치와 너비 계산 */
  const getRiverYAtX = useCallback((x: number): { y: number; width: number } | null => {
    // 강이 없으면 null 반환
    if (riverSegments.length === 0) return null;
    
    for (let i = 0; i < riverSegments.length - 1; i++) {
      const seg1 = riverSegments[i];
      const seg2 = riverSegments[i + 1];
      if (x >= seg1.x && x <= seg2.x) {
        const t = (x - seg1.x) / (seg2.x - seg1.x);
        return {
          y: seg1.y + (seg2.y - seg1.y) * t,
          width: seg1.width + (seg2.width - seg1.width) * t,
        };
      }
    }
    if (x < riverSegments[0].x) {
      return { y: riverSegments[0].y, width: riverSegments[0].width };
    }
    const last = riverSegments[riverSegments.length - 1];
    return { y: last.y, width: last.width };
  }, [riverSegments]);

  /** 점이 강 위에 있는지 확인 */
  const isPointInRiver = useCallback((point: Point): boolean => {
    const riverInfo = getRiverYAtX(point.x);
    // 강이 없으면 false 반환
    if (!riverInfo) return false;
    return Math.abs(point.y - riverInfo.y) < riverInfo.width / 2 + 10;
  }, [getRiverYAtX]);

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

  // ============ 경로 탐색 ============

  /** 두 선분의 교차점 계산 */
  const getLineIntersection = useCallback((
    p1: Point, p2: Point, p3: Point, p4: Point
  ): Point | null => {
    const d1x = p2.x - p1.x;
    const d1y = p2.y - p1.y;
    const d2x = p4.x - p3.x;
    const d2y = p4.y - p3.y;
    
    const cross = d1x * d2y - d1y * d2x;
    if (Math.abs(cross) < 0.0001) return null; // 평행
    
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

  /** 교차점 찾기 (끝점 교차 + 중간 교차) */
  const findIntersections = useCallback((roadList: Road[]): Intersection[] => {
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
             
             // 두 도로가 모두 직선이고 연결되어 있는 경우
             if (connectedRoads.length === 2 && !connectedRoads[0].controlPoint && !connectedRoads[1].controlPoint) {
                 // 교차점에서 나가는 벡터 계산
                 const v1 = (distance(connectedRoads[0].start, point) < 0.5) 
                     ? { x: connectedRoads[0].end.x - x, y: connectedRoads[0].end.y - y }
                     : { x: connectedRoads[0].start.x - x, y: connectedRoads[0].start.y - y };

                 const v2 = (distance(connectedRoads[1].start, point) < 0.5)
                     ? { x: connectedRoads[1].end.x - x, y: connectedRoads[1].end.y - y }
                     : { x: connectedRoads[1].start.x - x, y: connectedRoads[1].start.y - y };
                 
                 const len1 = Math.sqrt(v1.x*v1.x + v1.y*v1.y);
                 const len2 = Math.sqrt(v2.x*v2.x + v2.y*v2.y);
                 
                 if (len1 > 0 && len2 > 0) {
                     const dot = (v1.x * v2.x + v1.y * v2.y) / (len1 * len2);
                     // 내적 값이 -1에 가까우면 서로 반대 방향 (직선)
                     // 허용 오차를 조금 더 여유롭게 (-0.99 -> -0.95)
                     if (dot < -0.95) { 
                         return; // 교차점 추가 건너뜀
                     }
                 }
             }
        }

        result.push({ point: { x, y }, vehicleCount: 0 });
      }
    });
    
    // 2. 도로 중간 교차 (두 도로가 중간에서 만남)
    for (let i = 0; i < roadList.length; i++) {
      for (let j = i + 1; j < roadList.length; j++) {
        const road1 = roadList[i];
        const road2 = roadList[j];
        
        // 직선 도로만 중간 교차 계산
        if (!road1.controlPoint && !road2.controlPoint) {
          const intersection = getLineIntersection(
            road1.start, road1.end,
            road2.start, road2.end
          );
          if (intersection) {
            // 이미 추가된 교차점이 아닌 경우만 추가
            if (!result.some(r => 
              Math.abs(r.point.x - intersection.x) < 5 && 
              Math.abs(r.point.y - intersection.y) < 5
            )) {
              result.push({ point: intersection, vehicleCount: 0 });
            }
          }
        }
      }
    }
    
    return result;
  }, [getLineIntersection]);

  /** BFS로 최단 경로 찾기 (교차점 포함) */
  const findPath = useCallback((start: Point, end: Point, roadList: Road[]): Point[] | null => {
    if (roadList.length === 0) return null;

    // 좌표 정규화 함수 (미세한 오차 무시 및 키 생성)
    const getNodeKey = (p: Point) => `${Math.round(p.x)},${Math.round(p.y)}`;
    const getPointFromKey = (key: string): Point => {
        const [x, y] = key.split(',').map(Number);
        return { x, y };
    };

    // 모든 노드 수집 (도로 끝점 + 실제 교차점)
    const allNodes = new Set<string>();
    const nodeConnections = new Map<string, { key: string; road: Road }[]>();
    
    // 도로 끝점 추가
    roadList.forEach(road => {
      allNodes.add(getNodeKey(road.start));
      allNodes.add(getNodeKey(road.end));
    });
    
    // 실제 교차점 찾기 (두 도로가 중간에서 만나는 경우)
    const realIntersections: { point: Point, key: string }[] = [];
    
    for (let i = 0; i < roadList.length; i++) {
      for (let j = i + 1; j < roadList.length; j++) {
        const road1 = roadList[i];
        const road2 = roadList[j];
        
        // 직선 도로만 교차점 계산
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
    
    // 그래프 생성 (도로별로 연결)
    roadList.forEach(road => {
      // 이 도로 위에 있는 모든 노드 수집
      const nodesOnRoad: { point: Point; t: number; key: string }[] = [
        { point: road.start, t: 0, key: getNodeKey(road.start) },
        { point: road.end, t: 1, key: getNodeKey(road.end) }
      ];
      
      // 이 도로를 지나는 교차점 추가
      if (!road.controlPoint) {
        realIntersections.forEach(({ point: intersection, key }) => {
          // 점이 도로 위에 있는지 확인
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
      
      // t 값으로 정렬
      nodesOnRoad.sort((a, b) => a.t - b.t);
      
      // 연속된 노드들을 연결
      for (let i = 0; i < nodesOnRoad.length - 1; i++) {
        const fromKey = nodesOnRoad[i].key;
        const toKey = nodesOnRoad[i + 1].key;
        
        if (fromKey === toKey) continue;

        if (!nodeConnections.has(fromKey)) nodeConnections.set(fromKey, []);
        if (!nodeConnections.has(toKey)) nodeConnections.set(toKey, []);
        
        // 중복 연결 방지
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

    // 가장 가까운 노드 찾기 (시작점/도착점)
    let closestStartKey: string | null = null;
    let closestEndKey: string | null = null;
    let closestStartDist = Infinity;
    let closestEndDist = Infinity;

    // 건물과 도로 연결 허용 거리 (픽셀)
    const MAX_BUILDING_TO_ROAD_DISTANCE = 50;

    allNodes.forEach(key => {
      const point = getPointFromKey(key);
      const distToStart = distance(point, start); // start는 건물 위치
      const distToEnd = distance(point, end);     // end는 건물 위치
      
      if (distToStart < closestStartDist) {
        closestStartDist = distToStart;
        closestStartKey = key;
      }
      if (distToEnd < closestEndDist) {
        closestEndDist = distToEnd;
        closestEndKey = key;
      }
    });

    // 건물이 도로와 너무 멀리 떨어져 있으면 경로 없음
    if (!closestStartKey || !closestEndKey) return null;
    if (closestStartDist > MAX_BUILDING_TO_ROAD_DISTANCE) return null;
    if (closestEndDist > MAX_BUILDING_TO_ROAD_DISTANCE) return null;

    // BFS 탐색
    const queue: { key: string; pathKeys: string[]; roads: Road[] }[] = [
      { key: closestStartKey, pathKeys: [closestStartKey], roads: [] }
    ];
    const visited = new Set<string>();
    visited.add(closestStartKey);

    while (queue.length > 0) {
      const { key, pathKeys, roads: pathRoads } = queue.shift()!;

      if (key === closestEndKey) {
        // 키 배열을 포인트 배열로 변환하여 반환
        return pathKeys.map(k => getPointFromKey(k));
      }

      const neighbors = nodeConnections.get(key) || [];
      for (const { key: neighborKey, road } of neighbors) {
        if (!visited.has(neighborKey)) {
          visited.add(neighborKey);
          queue.push({ 
            key: neighborKey, 
            pathKeys: [...pathKeys, neighborKey], 
            roads: [...pathRoads, road] 
          });
        }
      }
    }
    return null;
  }, [getLineIntersection]);

  // ============ 차량 관리 ============

  /** 집에 맞는 회사 찾기 */
  const findOfficeForHome = useCallback((homeBuilding: Building): Building | null => {
    const colorPrefix = homeBuilding.id.split('-')[0];
    // 해당 색상의 모든 회사 찾기 (suffix가 있는 경우 포함)
    const availableOffices = buildings.filter(b => b.id.startsWith(`${colorPrefix}-office`));
    if (availableOffices.length === 0) return null;
    
    // 랜덤하게 하나 선택 (부하 분산)
    return availableOffices[Math.floor(Math.random() * availableOffices.length)];
  }, [buildings]);

  /** 건물에서 차량 생성 */
  const spawnVehicleFromBuilding = useCallback((fromBuilding: Building) => {
    if (!fromBuilding.id.includes('-home')) return;
    const toBuilding = findOfficeForHome(fromBuilding);
    if (!toBuilding) return;

    const rawPath = findPath(fromBuilding.position, toBuilding.position, roads);
    if (rawPath && rawPath.length >= 2) {
      const path = interpolatePath(rawPath, roads);
      // 초기 위치에 차선 오프셋 적용
      const lane = 'right';
      const offset = getLaneOffset(path[0], path[1], lane);
      
      const newVehicle: Vehicle = {
        id: `vehicle-${Date.now()}-${Math.random()}`,
        position: { x: path[0].x + offset.x, y: path[0].y + offset.y },
        targetIndex: 1,
        path,
        speed: VEHICLE_SPEED,
        waitTime: 0,
        color: fromBuilding.color,
        lane,
        direction: 0,
        fromBuilding: fromBuilding.id,
        toBuilding: toBuilding.id,
        status: 'going-to-office',
        officeArrivalTime: 0,
        intersectionArrivalTimes: {},
      };
      setVehicles(prev => [...prev, newVehicle]);
    }
  }, [findPath, roads, findOfficeForHome]);

  /** 모든 가능한 집에서 차량 생성 (조건 만족 시) */
  const spawnVehicle = useCallback(() => {
    // Ref를 사용하여 차량 상태 접근 (렌더링 사이클 독립적)
    const currentVehicles = vehiclesRef.current;
    
    const homeBuildings = buildings.filter(b => b.id.includes('-home'));
    let currentTotal = currentVehicles.length;
    
    // 회사별 예정 차량 수 추적 (오버필 방지)
    const officeCounts = new Map<string, number>();
    currentVehicles.forEach(v => {
      const count = officeCounts.get(v.toBuilding) || 0;
      officeCounts.set(v.toBuilding, count + 1);
    });

    for (const home of homeBuildings) {
      if (currentTotal >= 100) break; // 전체 제한

      const office = findOfficeForHome(home);
      if (!office) continue;
      
      // 집 차량 수 제한
      const vehiclesFromHome = currentVehicles.filter(v => v.fromBuilding === home.id).length;
      if (vehiclesFromHome >= MAX_VEHICLES_PER_HOME) continue;

      // 회사 수용 제한 (실시간 추적)
      const currentOfficeCount = officeCounts.get(office.id) || 0;
      if (currentOfficeCount >= MAX_VEHICLES_PER_OFFICE) continue;

      // 경로 확인 (가장 마지막에 수행)
      const path = findPath(home.position, office.position, roads);
      if (!path || path.length < 2) continue;

      spawnVehicleFromBuilding(home);
      currentTotal++;
      officeCounts.set(office.id, currentOfficeCount + 1);
    }
  }, [buildings, spawnVehicleFromBuilding, findOfficeForHome, findPath, roads]); // vehicles 제거

  /** 귀가 경로 생성 */
  const createReturnPath = useCallback((vehicle: Vehicle): Point[] | null => {
    const officeBuilding = buildings.find(b => b.id === vehicle.toBuilding);
    const homeBuilding = buildings.find(b => b.id === vehicle.fromBuilding);
    if (!officeBuilding || !homeBuilding) return null;
    const rawPath = findPath(officeBuilding.position, homeBuilding.position, roads);
    return rawPath ? interpolatePath(rawPath, roads) : null;
  }, [buildings, roads, findPath]);

  // ============ 이벤트 핸들러 ============

  /** 기존 도로 끝점 또는 교차점에 스냅 (거리가 가까우면 스냅) */
  const snapToRoadEndpoint = useCallback((point: Point, snapDistance: number = 15): Point => {
    let closest: Point | null = null;
    let closestDist = Infinity;
    
    // 도로 끝점에 스냅
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
    
    // 교차점에도 스냅
    intersections.forEach(intersection => {
      const distToIntersection = distance(point, intersection.point);
      if (distToIntersection < closestDist && distToIntersection < snapDistance) {
        closestDist = distToIntersection;
        closest = intersection.point;
      }
    });

    // 건물에도 스냅 (건물에서 도로 시작 가능)
    buildings.forEach(building => {
      const distToBuilding = distance(point, building.position);
      // 건물이므로 스냅 거리를 조금 더 여유있게
      if (distToBuilding < closestDist && distToBuilding < snapDistance + 10) {
        closestDist = distToBuilding;
        closest = building.position;
      }
    });

    if (closest) return closest;

    // 2. 도로 선분 스냅 (직선 도로만 지원)
    roads.forEach(road => {
      if (road.controlPoint) return; // 커브는 제외 (복잡도)
      
      const dx = road.end.x - road.start.x;
      const dy = road.end.y - road.start.y;
      const len2 = dx * dx + dy * dy;
      if (len2 === 0) return;
      
      // 점을 선분에 투영
      const t = ((point.x - road.start.x) * dx + (point.y - road.start.y) * dy) / len2;
      
      // 선분 내부 (양 끝점 제외)
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

  /** 키보드 이벤트 (Shift로 커브 모드, F로 직각 모드) */
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

  /** 클릭한 위치의 도로 찾기 */
  const getRoadAtPoint = useCallback((point: Point): Road | null => {
    // 역순으로 검색 (위에 그려진 도로 우선)
    for (let i = roads.length - 1; i >= 0; i--) {
      const road = roads[i];
      // 직선/곡선 거리 체크
      if (road.controlPoint) {
        // 곡선: 샘플링
        const steps = 20; 
        for (let t = 0; t <= 1; t += 1/steps) {
            const bx = (1 - t) * (1 - t) * road.start.x + 2 * (1 - t) * t * road.controlPoint.x + t * t * road.end.x;
            const by = (1 - t) * (1 - t) * road.start.y + 2 * (1 - t) * t * road.controlPoint.y + t * t * road.end.y;
             if (distance(point, { x: bx, y: by }) < 20) return road;
        }
      } else {
        // 직선: 점과 선분 사이 거리 (간단히 샘플링으로 처리)
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

  // 휠 이벤트 - 줌 처리 (Native Event로 등록하여 preventDefault 적용)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const scaleAmount = -e.deltaY * 0.001;
      setZoom(prev => Math.min(Math.max(0.5, prev + scaleAmount), 3));
    };

    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  }, []);

  /** 마우스 다운 - 도로 그리기 시작 */
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // 0. 미들 클릭 패닝
    if (e.button === 1) {
      e.preventDefault();
      isPanning.current = true;
      lastPanPos.current = { x: e.clientX, y: e.clientY };
      return;
    }

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const rawPoint = { x: (e.clientX - rect.left) / zoom, y: (e.clientY - rect.top) / zoom };

    // 1. 기존 도로 끝점 스냅 시도
    const snappedToRoad = snapToRoadEndpoint(rawPoint);

    // 2. 그리기 시작 (선택 해제)
    setSelectedRoad(null); 
    
    const point = snappedToRoad !== rawPoint ? snappedToRoad : snapToGrid(rawPoint);
    setIsDrawing(true);
    setDrawStart(point);
    setCurrentEnd(point);
    setControlPoint(null);
  };

  /** 마우스 이동 - 도로 프리뷰 */
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // 패닝 처리
    if (isPanning.current) {
        const dx = e.clientX - lastPanPos.current.x;
        const dy = e.clientY - lastPanPos.current.y;
        if (canvasRef.current && canvasRef.current.parentElement) {
            canvasRef.current.parentElement.scrollLeft -= dx;
            canvasRef.current.parentElement.scrollTop -= dy;
        }
        lastPanPos.current = { x: e.clientX, y: e.clientY };
        return;
    }

    if (!isDrawing) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const rawPoint = { x: (e.clientX - rect.left) / zoom, y: (e.clientY - rect.top) / zoom };
    
    // 직선 모드일 때 직각 제한 (Orthogonal Constraint)
    let point: Point;
    if (isOrthoMode && drawStart) {
        let candidate = snapToRoadEndpoint(rawPoint);
        
        // 스냅된 지점이 대각선 방향이면 스냅 무시 (직각 연결만 허용)
        if (candidate !== rawPoint) {
            const dx = Math.abs(candidate.x - drawStart.x);
            const dy = Math.abs(candidate.y - drawStart.y);
            // 허용 오차 5px
            if (dx > 5 && dy > 5) {
                candidate = rawPoint; 
            }
        }
        
        if (candidate !== rawPoint) {
           point = candidate;
        } else {
           // 그리드 스냅 후 주축(Major Axis)으로 강제 정렬
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

    // 다리 모드 길이 제한 (120px: 강폭 70px + 여유)
    if (activeTool === 'bridge' && drawStart) {
       const dist = distance(drawStart, point);
       const MAX_BRIDGE_LENGTH = 120;
       if (dist > MAX_BRIDGE_LENGTH) {
          const dx = point.x - drawStart.x;
          const dy = point.y - drawStart.y;
          const ratio = MAX_BRIDGE_LENGTH / dist;
          point = {
             x: drawStart.x + dx * ratio,
             y: drawStart.y + dy * ratio
          };
       }
    }

    setCurrentEnd(point);

    // 커브 모드: 컨트롤 포인트 계산
    if (isCurveMode && drawStart) {
      const midX = (drawStart.x + point.x) / 2;
      const midY = (drawStart.y + point.y) / 2;
      const dx = point.x - drawStart.x;
      const dy = point.y - drawStart.y;
      const length = Math.sqrt(dx * dx + dy * dy);
      
      if (length > 0) {
        const perpX = -dy / length;
        const perpY = dx / length;
        const curveStrength = length * 0.4;
        const mouseToMidX = ((e.clientX - rect.left) / zoom) - midX; // Mouse also adjusted
        const mouseToMidY = ((e.clientY - rect.top) / zoom) - midY;
        const dotProduct = mouseToMidX * perpX + mouseToMidY * perpY;
        const side = dotProduct > 0 ? 1 : -1;
        setControlPoint({ 
          x: midX + perpX * curveStrength * side, 
          y: midY + perpY * curveStrength * side 
        });
      }
    } else {
      setControlPoint(null);
    }
  };

  /** 건물을 통과하는 도로인지 검사 */
  const doesRoadIntersectAnyBuilding = useCallback((start: Point, end: Point, control?: Point): boolean => {
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

      // 도로를 따라 샘플링하여 건물과 겹치는지 확인
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
        
        // 약간의 여유를 두고 충돌 검사
        if (pX > left - 2 && pX < right + 2 && pY > top - 2 && pY < bottom + 2) {
          return true;
        }
      }
      return false;
    });
  }, [buildings]);

  /** 마우스 업 - 도로 생성 */
  const handleMouseUp = () => {
    if (isPanning.current) {
        isPanning.current = false;
        return;
    }

    if (isDrawing && drawStart && currentEnd) {
      if (distance(drawStart, currentEnd) > GRID_SIZE) {
        // 강 충돌 검사
        const crossesRiver = controlPoint
          ? doesCurveRoadCrossRiver(drawStart, currentEnd, controlPoint)
          : doesRoadCrossRiver(drawStart, currentEnd);
        
        // 도로 중복 검사
        const overlapsRoad = doRoadsOverlap(drawStart, currentEnd, roads, controlPoint || undefined);

        // 건물 충돌 검사
        const overlapsBuilding = doesRoadIntersectAnyBuilding(drawStart, currentEnd, controlPoint || undefined);
        
        // 검사 통과 시 도로 생성 (강 위는 다리로 허용)
        if (!overlapsRoad && !overlapsBuilding) {

          const dist = distance(drawStart, currentEnd);
          let cost = Math.ceil(dist);
          
          let roadType: 'normal' | 'highway' = 'normal';
          let isBridgeVal: boolean | undefined = undefined;

          // 아이템 모드 체크 및 비용 계산
          if (activeTool === 'highway') {
               if (crossesRiver) {
                   alert("고속도로는 강을 건널 수 없습니다.");
                   setIsDrawing(false); setDrawStart(null); setCurrentEnd(null); setControlPoint(null);
                   return;
               }
               if (highwayCount <= 0) {
                   alert("고속도로 아이템이 부족합니다!");
                   setIsDrawing(false); setDrawStart(null); setCurrentEnd(null); setControlPoint(null);
                   return;
               }
               roadType = 'highway';
          } else if (activeTool === 'bridge') {
               if (crossesRiver) {
                   if (bridgeCount <= 0) {
                       alert("다리 건설권이 부족합니다!");
                       setIsDrawing(false); setDrawStart(null); setCurrentEnd(null); setControlPoint(null);
                       return;
                   }
                   // 다리는 아이템만 소모하고 비용은 0
                   cost = 0;
                   isBridgeVal = true;
               }
          } else {
               if (crossesRiver) {
                   alert("강을 건너려면 다리 모드를 선택하세요.");
                   setIsDrawing(false); setDrawStart(null); setCurrentEnd(null); setControlPoint(null);
                   return;
               }
          }

          // 자금 확인
          if (score < cost) {
             alert(`포인트가 부족합니다! (필요: ${cost}P)`);
             setIsDrawing(false); setDrawStart(null); setCurrentEnd(null); setControlPoint(null);
             return;
          }

          // 아이템 차감
          if (roadType === 'highway') {
              setHighwayCount(prev => prev - 1);
          }
          if (isBridgeVal) {
              setBridgeCount(prev => prev - 1);
          }

          let finalRoads = [...roads];

          // 도로 분할 로직 (중간 지점 연결 시 기존 도로 분할)
          const checkAndSplit = (snapPoint: Point) => {
             const targetIndex = finalRoads.findIndex(r => {
               if (r.controlPoint) return false;
               // 기존 끝점은 무시 (일반 연결)
               if (distance(snapPoint, r.start) < 2 || distance(snapPoint, r.end) < 2) return false;
               
               const dx = r.end.x - r.start.x;
               const dy = r.end.y - r.start.y;
               const len2 = dx * dx + dy * dy;
               if (len2 === 0) return false;
               
               const t = ((snapPoint.x - r.start.x) * dx + (snapPoint.y - r.start.y) * dy) / len2;
               if (t > 0.001 && t < 0.999) {
                 const projX = r.start.x + t * dx;
                 const projY = r.start.y + t * dy;
                 // 스냅된 점이 선분 위에 있는지 확인 (아주 가까워야 함 - snapToRoadEndpoint에서 보정됨)
                 return distance(snapPoint, { x: projX, y: projY }) < 3;
               }
               return false;
             });

             if (targetIndex !== -1) {
               const target = finalRoads[targetIndex];
               const timestamp = Date.now();
               // ID를 유니크하게 생성하여 키 충돌 방지
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
          setIntersections(findIntersections(finalRoads));
          setScore(prev => prev - cost);
        }
      } else {
        // 거리 40 미만 -> 클릭으로 간주하여 도로 선택
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
  };

  // ============ 게임 루프 ============

  /** 메인 게임 루프 */
  useEffect(() => {
    if (isGameOver || isPaused) return;
    const gameLoop = setInterval(() => {
      const currentTime = Date.now();
      
      setVehicles(prevVehicles => {
        // 1단계: 각 차량의 교차점 도착 시간 업데이트
        const vehiclesWithArrivalTimes = prevVehicles.map(vehicle => {
          if (vehicle.status !== 'going-to-office' && vehicle.status !== 'going-home') {
            return vehicle;
          }
          
          const newArrivalTimes = { ...vehicle.intersectionArrivalTimes };
          
          intersections.forEach(intersection => {
            const key = `${intersection.point.x},${intersection.point.y}`;
            const dist = distance(vehicle.position, intersection.point);
            
            // 교차점 영역(30px) 안에 진입하면 도착 시간 기록
            if (dist < 30) {
              if (!newArrivalTimes[key]) {
                newArrivalTimes[key] = currentTime;
              }
            } else {
              // 교차점 영역을 벗어나면 기록 삭제
              delete newArrivalTimes[key];
            }
          });
          
          return { ...vehicle, intersectionArrivalTimes: newArrivalTimes };
        });

        // 2단계: 교차점별 FIFO 큐 구성
        const intersectionQueues = new Map<string, { id: string; arrivalTime: number }[]>();
        
        vehiclesWithArrivalTimes.forEach(vehicle => {
          if (vehicle.status !== 'going-to-office' && vehicle.status !== 'going-home') {
            return;
          }
          
          Object.entries(vehicle.intersectionArrivalTimes).forEach(([key, arrivalTime]) => {
            if (!intersectionQueues.has(key)) {
              intersectionQueues.set(key, []);
            }
            intersectionQueues.get(key)!.push({ id: vehicle.id, arrivalTime });
          });
        });
        
        // 각 큐를 도착 시간순으로 정렬 (FIFO)
        intersectionQueues.forEach(queue => {
          queue.sort((a, b) => a.arrivalTime - b.arrivalTime);
        });

        let scoreIncrease = 0;
        
        const updatedVehicles = vehiclesWithArrivalTimes.map(vehicle => {
          // 회사 대기 중
          if (vehicle.status === 'at-office') {
            // 게임 속도 반영: 경과 시간에 배속 적용
            if ((currentTime - vehicle.officeArrivalTime) * gameSpeed >= OFFICE_WAIT_TIME) {
              const returnPath = createReturnPath(vehicle);
              if (returnPath && returnPath.length >= 2) {
                // 퇴근 시에도 차선 오프셋 적용하여 시작
                const offset = getLaneOffset(returnPath[0], returnPath[1], vehicle.lane);
                
                return {
                  ...vehicle,
                  status: 'going-home' as const,
                  path: returnPath,
                  targetIndex: 1,
                  position: { x: returnPath[0].x + offset.x, y: returnPath[0].y + offset.y },
                  intersectionArrivalTimes: {}, // 교차점 도착 시간 초기화
                };
              }
            }
            return vehicle;
          }

          // 집에 도착 (제거)
          if (vehicle.status === 'at-home') return null;
          
          // 목적지 도착
          if (vehicle.targetIndex >= vehicle.path.length) {
            if (vehicle.status === 'going-to-office') {
              return { ...vehicle, status: 'at-office' as const, officeArrivalTime: currentTime };
            } else if (vehicle.status === 'going-home') {
              scoreIncrease += SCORE_PER_TRIP;
              return null;
            }
            return vehicle;
          }

          // 이동 처리
          const target = vehicle.path[vehicle.targetIndex];
          const prevPoint = vehicle.path[Math.max(0, vehicle.targetIndex - 1)];
          const laneOffset = getLaneOffset(prevPoint, target, vehicle.lane);
          
          // 타겟에 레인 오프셋 적용
          const adjustedTarget = { x: target.x + laneOffset.x, y: target.y + laneOffset.y };
          
          const dx = adjustedTarget.x - vehicle.position.x;
          const dy = adjustedTarget.y - vehicle.position.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          // 대기 판단
          let shouldWait = false;
          
          // 교차점 안에 있는지 확인 (15px 이내)
          const insideIntersection = intersections.some(intersection => 
            distance(vehicle.position, intersection.point) < 15
          );
          
          // 교차점 안에서는 절대 멈추지 않음 - 빠르게 통과
          if (!insideIntersection) {
            // 저지선 FIFO 대기 - 교차점 진입 전(15-35px)에서 대기
            intersections.forEach(intersection => {
              const distToIntersection = distance(vehicle.position, intersection.point);
              // 저지선 영역: 15px~35px (교차점 직전)
              if (distToIntersection >= 15 && distToIntersection < 35) {
                const key = `${intersection.point.x},${intersection.point.y}`;
                const queue = intersectionQueues.get(key);
                
                // 같은 방향 차량만 체크 (반대 방향 차량은 다른 레인이므로 무시)
                const sameDirectionInIntersection = vehiclesWithArrivalTimes.some(other => 
                  other.id !== vehicle.id &&
                  other.status === vehicle.status && // 같은 방향만
                  distance(other.position, intersection.point) < 15
                );
                
                if (sameDirectionInIntersection) {
                  shouldWait = true;
                } else if (queue && queue.length >= 2) {
                  // 같은 방향 차량만 큐에서 체크
                  const sameDirectionQueue = queue.filter(q => {
                    const otherVehicle = vehiclesWithArrivalTimes.find(v => v.id === q.id);
                    return otherVehicle && otherVehicle.status === vehicle.status;
                  });
                  
                  if (sameDirectionQueue.length >= 2 && sameDirectionQueue[0].id !== vehicle.id) {
                    shouldWait = true;
                  }
                }
              }
            });
          }
          
          // 차량 충돌 방지 비활성화
          // 교차점 FIFO 로직만 사용

          if (shouldWait) {
            return { ...vehicle, waitTime: vehicle.waitTime + 0.016 * gameSpeed };
          }

          // 이동 속도 결정 (도로 타입 반영)
          const targetPt = vehicle.path[vehicle.targetIndex];
          const roadSpeedMult = targetPt.speedMultiplier || 1.0;
          const moveSpeed = vehicle.speed * roadSpeedMult * gameSpeed;

          // 이동
          if (dist < moveSpeed) {
            return {
              ...vehicle,
              position: adjustedTarget,
              targetIndex: vehicle.targetIndex + 1,
              direction: Math.atan2(dy, dx),
              waitTime: Math.max(0, vehicle.waitTime - 0.016 * gameSpeed),
            };
          } else {
            return {
              ...vehicle,
              position: { 
                x: vehicle.position.x + (dx / dist) * moveSpeed, 
                y: vehicle.position.y + (dy / dist) * moveSpeed 
              },
              direction: Math.atan2(dy, dx),
              waitTime: Math.max(0, vehicle.waitTime - 0.016 * gameSpeed),
            };
          }
        }).filter((v): v is Vehicle => v !== null);

        if (scoreIncrease > 0) {
          setScore(prev => prev + scoreIncrease);
        }
        return updatedVehicles;
      });
    }, 16);

    return () => clearInterval(gameLoop);
  }, [intersections, createReturnPath, gameSpeed, isGameOver, isPaused]);

  /** 자동 차량 생성 */
  useEffect(() => {
    if (isGameOver || isPaused || roads.length === 0) return;
    const spawnInterval = setInterval(() => {
      if (vehicles.length < MAX_VEHICLES) spawnVehicle();
    }, VEHICLE_SPAWN_INTERVAL / gameSpeed);
    return () => clearInterval(spawnInterval);
  }, [roads.length, vehicles.length, spawnVehicle, gameSpeed, isGameOver, isPaused]);

  // 건물 비활성화 체크 및 삭제 (30초 비활성 시 제거)
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      const now = Date.now();
      const TIMEOUT = 45000; // 15초 대기 + 30초 카운트다운
      const GRACE_PERIOD = 15000; 

      setBuildings(prev => {
        // 1. 현재 활동 중인 건물 식별
        const activeIds = new Set<string>();
        vehiclesRef.current.forEach(v => {
          // 집: 활동 차량이 있으면 유지
          activeIds.add(v.fromBuilding);
          
          // 회사: 차가 "들어가야"(도착해야) 활동 인정
          if (v.status === 'at-office') {
             activeIds.add(v.toBuilding);
          }
        });

        // 2. 상태 처리
        const mapped = prev.map(b => {
          if (activeIds.has(b.id)) {
             return { ...b, lastActiveTime: now };
          }
          return b;
        });

        const kept = mapped.filter(b => {
          if (activeIds.has(b.id)) return true;
          
          if (b.createdAt && now - b.createdAt < GRACE_PERIOD) return true;
          // createdAt 없는 경우(기존 데이터)는 현재를 기준으로 초기화되었다고 가정하거나 삭제 안함
          if (!b.createdAt) return true; 
          
          const lastActive = b.lastActiveTime || now;
          if (now - lastActive > TIMEOUT) {
             return false;
          }
          return true;
        });

        // 삭제된 건물 카운트 (Game Over 체크 - 집 또는 회사)
        const removed = mapped.filter(b => !kept.includes(b));
        if (removed.length > 0) {
            setTimeout(() => setDestroyedCount(c => c + removed.length), 0);
        }

        return kept;
      });
    }, 1000);
    return () => clearInterval(cleanupInterval);
  }, []);

  // 게임 오버 체크
  useEffect(() => {
    if (destroyedCount >= 3 && !isGameOver) {
      setIsGameOver(true);
    }
  }, [destroyedCount, isGameOver]);

  // ============ 렌더링 ============

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.save();
    ctx.scale(zoom, zoom);

    // 배경
    ctx.fillStyle = '#f5f5f4';
    ctx.fillRect(0, 0, mapSize.width, mapSize.height);

    // 강 렌더링 (강이 있을 때만)
    if (riverSegments.length > 0) {
      ctx.fillStyle = '#7dd3fc';
      ctx.beginPath();
      ctx.moveTo(riverSegments[0].x, riverSegments[0].y - riverSegments[0].width / 2);
      for (let i = 1; i < riverSegments.length; i++) {
        ctx.lineTo(riverSegments[i].x, riverSegments[i].y - riverSegments[i].width / 2);
      }
      for (let i = riverSegments.length - 1; i >= 0; i--) {
        ctx.lineTo(riverSegments[i].x, riverSegments[i].y + riverSegments[i].width / 2);
      }
      ctx.closePath();
      ctx.fill();

      // 강 하이라이트
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 2;
      ctx.setLineDash([10, 15]);
      ctx.beginPath();
      ctx.moveTo(riverSegments[0].x + 20, riverSegments[0].y);
      for (let i = 1; i < riverSegments.length; i++) {
        ctx.lineTo(riverSegments[i].x, riverSegments[i].y);
      }
      ctx.stroke();
      ctx.setLineDash([]);

      // 강 테두리
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(riverSegments[0].x, riverSegments[0].y - riverSegments[0].width / 2);
      for (let i = 1; i < riverSegments.length; i++) {
        ctx.lineTo(riverSegments[i].x, riverSegments[i].y - riverSegments[i].width / 2);
      }
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(riverSegments[0].x, riverSegments[0].y + riverSegments[0].width / 2);
      for (let i = 1; i < riverSegments.length; i++) {
        ctx.lineTo(riverSegments[i].x, riverSegments[i].y + riverSegments[i].width / 2);
      }
      ctx.stroke();
    }

    // 도로 외곽선
    ctx.lineWidth = ROAD_OUTLINE_WIDTH;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    roads.forEach(road => {
      ctx.strokeStyle = road.isBridge ? '#8b4513' : '#9ca3af';
      ctx.beginPath();
      ctx.moveTo(road.start.x, road.start.y);
      if (road.controlPoint) {
        ctx.quadraticCurveTo(road.controlPoint.x, road.controlPoint.y, road.end.x, road.end.y);
      } else {
        ctx.lineTo(road.end.x, road.end.y);
      }
      ctx.stroke();
    });

    // 교차점 외곽선 (도로보다 먼저 그려서 도로와 자연스럽게 연결)
    intersections.forEach(intersection => {
      ctx.fillStyle = '#9ca3af';
      ctx.beginPath();
      ctx.arc(intersection.point.x, intersection.point.y, 16, 0, Math.PI * 2);
      ctx.fill();
    });

    // 도로 본체
    ctx.lineWidth = ROAD_WIDTH;
    roads.forEach(road => {
      // 다리: 진한 갈색(#d4a373), 고속도로: 선명한 파랑(#93c5fd), 일반: 흰색
      ctx.strokeStyle = road.isBridge ? '#d4a373' : (road.type === 'highway' ? '#93c5fd' : '#ffffff');
      ctx.beginPath();
      ctx.moveTo(road.start.x, road.start.y);
      if (road.controlPoint) {
        ctx.quadraticCurveTo(road.controlPoint.x, road.controlPoint.y, road.end.x, road.end.y);
      } else {
        ctx.lineTo(road.end.x, road.end.y);
      }
      ctx.stroke();
    });

    // 교차점 본체 (흰색 원형 플랫폼)
    intersections.forEach(intersection => {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(intersection.point.x, intersection.point.y, 14, 0, Math.PI * 2);
      ctx.fill();
    });

    // 중앙선
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 2;
    roads.forEach(road => {
      ctx.beginPath();
      ctx.moveTo(road.start.x, road.start.y);
      if (road.controlPoint) {
        ctx.quadraticCurveTo(road.controlPoint.x, road.controlPoint.y, road.end.x, road.end.y);
      } else {
        ctx.lineTo(road.end.x, road.end.y);
      }
      ctx.stroke();
    });

    // 교차점 혼잡도 계산
    const intersectionCounts = new Map<string, number>();
    vehicles.forEach(v => {
      Object.keys(v.intersectionArrivalTimes).forEach(key => {
         intersectionCounts.set(key, (intersectionCounts.get(key) || 0) + 1);
      });
    });

    // 교차점 중앙 표시 (상태에 따라 색상 변경)
    intersections.forEach(intersection => {
      const key = `${intersection.point.x},${intersection.point.y}`;
      const count = intersectionCounts.get(key) || 0;
      const isCongested = count >= 5; // 차량 5대 이상이면 정체로 판단

      // 중앙 점 (정체시 빨간색)
      ctx.fillStyle = isCongested ? '#ef4444' : '#fbbf24';
      ctx.beginPath();
      ctx.arc(intersection.point.x, intersection.point.y, isCongested ? 5 : 4, 0, Math.PI * 2);
      ctx.fill();
      
      // 외곽 링
      ctx.strokeStyle = isCongested ? '#fca5a5' : '#9ca3af';
      ctx.lineWidth = isCongested ? 2 : 1;
      ctx.beginPath();
      ctx.arc(intersection.point.x, intersection.point.y, 12, 0, Math.PI * 2);
      ctx.stroke();

      // 혼잡도 텍스트 (정체시에만 표시)
      if (isCongested) {
         ctx.fillStyle = '#ffffff';
         ctx.font = 'bold 10px system-ui';
         ctx.textAlign = 'center';
         ctx.textBaseline = 'middle';
         ctx.fillText('!', intersection.point.x, intersection.point.y);
      }
      
      // 저지선 표시 (교차점에 연결된 각 도로에 흰색 선)
      roads.forEach(road => {
        // 이 도로가 교차점에 연결되어 있는지 확인
        const atStart = distance(road.start, intersection.point) < 5;
        const atEnd = distance(road.end, intersection.point) < 5;
        
        if (atStart || atEnd) {
          // 도로 방향 계산
          const roadStart = atStart ? road.start : road.end;
          const roadEnd = atStart ? road.end : road.start;
          const dx = roadEnd.x - roadStart.x;
          const dy = roadEnd.y - roadStart.y;
          const len = Math.sqrt(dx * dx + dy * dy);
          if (len === 0) return;
          
          // 정규화된 방향
          const nx = dx / len;
          const ny = dy / len;
          
          // 저지선 위치 (교차점에서 20px 떨어진 곳)
          const stopLineX = intersection.point.x + nx * 20;
          const stopLineY = intersection.point.y + ny * 20;
          
          // 수직 방향
          const perpX = -ny;
          const perpY = nx;
          
          // 저지선 그리기 (흰색)
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(stopLineX + perpX * 10, stopLineY + perpY * 10);
          ctx.lineTo(stopLineX - perpX * 10, stopLineY - perpY * 10);
          ctx.stroke();
        }
      });
    });

    // 선택된 도로 하이라이트
    if (selectedRoad) {
       ctx.shadowBlur = 15;
       ctx.shadowColor = '#06b6d4'; // Cyan
       ctx.strokeStyle = 'rgba(34, 211, 238, 0.6)';
       ctx.lineWidth = ROAD_WIDTH + 8;
       ctx.lineCap = 'round';
       ctx.lineJoin = 'round';
       ctx.beginPath();
       const road = selectedRoad;
       ctx.moveTo(road.start.x, road.start.y);
       if (road.controlPoint) {
         ctx.quadraticCurveTo(road.controlPoint.x, road.controlPoint.y, road.end.x, road.end.y);
       } else {
         ctx.lineTo(road.end.x, road.end.y);
       }
       ctx.stroke();
       ctx.shadowBlur = 0;
    }

    // 도로 프리뷰
    if (isDrawing && drawStart && currentEnd) {
      const crossesRiver = controlPoint
        ? doesCurveRoadCrossRiver(drawStart, currentEnd, controlPoint)
        : doesRoadCrossRiver(drawStart, currentEnd);
      const overlapsRoad = doRoadsOverlap(drawStart, currentEnd, roads, controlPoint || undefined);
      const overlapsBuilding = doesRoadIntersectAnyBuilding(drawStart, currentEnd, controlPoint || undefined);
      
      const isInvalid = overlapsRoad || overlapsBuilding;
      let previewColor = isInvalid ? 'rgba(239, 68, 68, 0.6)' : 'rgba(66, 133, 244, 0.5)';
      
      if (!isInvalid && crossesRiver) {
          previewColor = bridgeCount > 0 
            ? 'rgba(210, 180, 140, 0.8)' 
            : 'rgba(239, 68, 68, 0.6)'; // 다리 아이템 부족
      }

      ctx.strokeStyle = previewColor;
      ctx.lineWidth = 22;
      ctx.beginPath();
      ctx.moveTo(drawStart.x, drawStart.y);
      if (controlPoint) {
        ctx.quadraticCurveTo(controlPoint.x, controlPoint.y, currentEnd.x, currentEnd.y);
      } else {
        ctx.lineTo(currentEnd.x, currentEnd.y);
      }
      ctx.stroke();

      if (controlPoint) {
        ctx.fillStyle = 'rgba(66, 133, 244, 0.8)';
        ctx.beginPath();
        ctx.arc(controlPoint.x, controlPoint.y, 6, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 건물 렌더링 (2D)
    buildings.forEach(building => {
      const isHome = building.id.includes('-home');
      const cx = building.position.x;
      const cy = building.position.y;
      
      const now = Date.now();
      const lastActive = building.lastActiveTime || now;
      const inactiveTime = now - lastActive;
      // 45초 후 소멸 (15초 대기 + 30초 카운트다운)
      const timeLeft = Math.max(0, 45000 - inactiveTime);

      if (isHome) {
        // 집 - 2D 사각형 + 삼각형 지붕
        const houseWidth = 36;
        const houseHeight = 30;
        const roofHeight = 15;

        // 집 본체 (사각형)
        ctx.fillStyle = building.color;
        ctx.fillRect(cx - houseWidth/2, cy - houseHeight/2, houseWidth, houseHeight);
        
        // 집 테두리
        ctx.strokeStyle = shadeColor(building.color, -30);
        ctx.lineWidth = 2;
        ctx.strokeRect(cx - houseWidth/2, cy - houseHeight/2, houseWidth, houseHeight);

        // 지붕 (삼각형)
        ctx.fillStyle = shadeColor(building.color, -20);
        ctx.beginPath();
        ctx.moveTo(cx - houseWidth/2 - 5, cy - houseHeight/2);
        ctx.lineTo(cx, cy - houseHeight/2 - roofHeight);
        ctx.lineTo(cx + houseWidth/2 + 5, cy - houseHeight/2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        
        // 집 아이콘 (🏠)
        ctx.font = '14px system-ui';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ffffff';
        ctx.fillText('🏠', cx, cy);
        
        // 상태 표시 (차량 수 / 소멸 타이머)
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.font = 'bold 11px system-ui';
        
        // 집: 남은 차량 수 (Max - Active)
        const activeCount = vehicles.filter(v => v.fromBuilding === building.id).length;
        const remainingCount = Math.max(0, MAX_VEHICLES_PER_HOME - activeCount);
        
        ctx.fillStyle = '#1f2937';
        // P: 주차된(Parked) / 준비된 차량
        ctx.fillText(`🅿️ ${remainingCount}`, cx, cy - houseHeight/2 - roofHeight - 4);
        
        // 소멸 경고 (도넛 타이머 - 파괴 게이지)
        if (timeLeft < 30000) { 
            const ringY = cy - houseHeight/2 - roofHeight - 16;
            // 0(안전) -> 1(파괴) 순으로 차오름
            const danger = 1.0 - Math.max(0, timeLeft / 30000);
            const radius = 6;
            
            // 배경 링
            ctx.beginPath();
            ctx.arc(cx, ringY, radius, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
            ctx.lineWidth = 3;
            ctx.stroke();
            
            // 진행 링 (게이지 차오름)
            ctx.beginPath();
            ctx.arc(cx, ringY, radius, -Math.PI/2, -Math.PI/2 + (Math.PI * 2 * danger));
            ctx.strokeStyle = danger > 0.66 ? '#dc2626' : (danger > 0.33 ? '#ea580c' : '#22c55e');
            ctx.lineWidth = 3;
            ctx.stroke();
        }

      } else {
        // 회사 - 2D 사각형
        const buildingWidth = 40;
        const buildingHeight = 50;

        // 건물 본체 (사각형)
        ctx.fillStyle = building.color;
        ctx.fillRect(cx - buildingWidth/2, cy - buildingHeight/2, buildingWidth, buildingHeight);
        
        // 건물 테두리
        ctx.strokeStyle = shadeColor(building.color, -30);
        ctx.lineWidth = 2;
        ctx.strokeRect(cx - buildingWidth/2, cy - buildingHeight/2, buildingWidth, buildingHeight);

        // 회사 아이콘 (🏢)
        ctx.font = '16px system-ui';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ffffff';
        ctx.fillText('🏢', cx, cy - 5);
        
        // 상태 표시
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.font = 'bold 11px system-ui';
        
        // 회사: 도착한 차량 수 (At Office)
        const parkedCount = vehicles.filter(v => v.toBuilding === building.id && v.status === 'at-office').length;
        
        ctx.fillStyle = '#1f2937';
        ctx.fillText(`🅿️ ${parkedCount}/${MAX_VEHICLES_PER_OFFICE}`, cx, cy - buildingHeight/2 - 4);

        // 소멸 경고 (도넛 타이머 - 파괴 게이지)
        if (timeLeft < 30000) {
            const ringY = cy - buildingHeight/2 - 16;
            // 0(안전) -> 1(파괴) 순으로 차오름
            const danger = 1.0 - Math.max(0, timeLeft / 30000);
            const radius = 6;
            
            // 배경 링
            ctx.beginPath();
            ctx.arc(cx, ringY, radius, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
            ctx.lineWidth = 3;
            ctx.stroke();
            
            // 진행 링 (게이지 차오름)
            ctx.beginPath();
            ctx.arc(cx, ringY, radius, -Math.PI/2, -Math.PI/2 + (Math.PI * 2 * danger));
            ctx.strokeStyle = danger > 0.66 ? '#dc2626' : (danger > 0.33 ? '#ea580c' : '#22c55e');
            ctx.lineWidth = 3;
            ctx.stroke();
        }

        // 대기 차량 수 표시 (중복 제거)
      }
    });

    // 차량 렌더링
    vehicles.forEach(vehicle => {
      if (vehicle.status === 'at-office') return;
      
      ctx.fillStyle = vehicle.color;
      ctx.beginPath();
      ctx.arc(vehicle.position.x, vehicle.position.y, VEHICLE_SIZE, 0, Math.PI * 2);
      ctx.fill();
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
    
    ctx.restore();

  }, [
    roads, vehicles, isDrawing, drawStart, currentEnd, controlPoint, 
    intersections, riverSegments, buildings, doesRoadCrossRiver, doesCurveRoadCrossRiver,
    mapSize, zoom
  ]);

  // ============ UI ============

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-8 font-sans">
      {/* Header Area */}
      <div className="w-full max-w-[1000px] flex justify-between items-end mb-6">
          <div>
            <h1 className="text-4xl font-black text-slate-800 tracking-tighter mb-1">
              Load<span className="text-indigo-600">Maker</span>
            </h1>
            <p className="text-slate-500 font-medium tracking-tight">Survival Strategy Builder</p>
          </div>
          
          <div className="flex gap-4">
             {/* Stats: Money */}
             <div className="bg-white rounded-2xl px-5 py-3 shadow-sm border border-slate-200 flex flex-col justify-center min-w-[120px]">
                <div className="flex items-center gap-1.5 mb-1">
                   <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                   </svg>
                   <span className="text-xs text-slate-400 font-bold tracking-wider">MONEY</span>
                </div>
                <span className="text-2xl font-black text-emerald-600 tracking-tight leading-none">{score}</span>
             </div>

             {/* Stats: Time */}
             <div className="bg-white rounded-2xl px-5 py-3 shadow-sm border border-slate-200 flex flex-col justify-center min-w-[140px]">
                <div className="flex items-center gap-1.5 mb-1">
                   <svg className="w-4 h-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                   </svg>
                   <span className="text-xs text-slate-400 font-bold tracking-wider">TIME</span>
                </div>
                <span className="text-2xl font-black text-indigo-600 tracking-tight leading-none">
                  {Math.floor(gameTime / 60)}:{String(gameTime % 60).padStart(2, '0')}
                </span>
             </div>

             {/* Stats: Broken */}
             <div className="bg-white rounded-2xl px-5 py-3 shadow-sm border border-slate-200 flex flex-col justify-center min-w-[100px]">
                <div className="flex items-center gap-1.5 mb-1">
                   <svg className="w-4 h-4 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                   </svg>
                   <span className="text-xs text-slate-400 font-bold tracking-wider">BROKEN</span>
                </div>
                <span className={`text-2xl font-black tracking-tight leading-none ${destroyedCount > 0 ? 'text-rose-500' : 'text-slate-700'}`}>
                   {destroyedCount}/3
                </span>
             </div>
          </div>
      </div>

      {/* Toolbar Area */}
      <div className="w-full max-w-[1000px] bg-white rounded-2xl p-2.5 shadow-sm border border-slate-200 mb-4 flex justify-between items-center">
         <div className="flex gap-2">
            <button 
               onClick={() => startNewGame()} 
               className="group flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 active:bg-blue-800 transition-all shadow-blue-200 hover:shadow-lg hover:-translate-y-0.5"
            >
               <svg className="w-4 h-4 group-hover:rotate-180 transition-transform duration-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
               </svg>
               <span>Reset</span>
            </button>
            <button 
               onClick={() => setIsPaused(prev => !prev)}
               className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all border hover:shadow-md hover:-translate-y-0.5 ${
                 isPaused 
                   ? 'bg-amber-100 text-amber-700 border-amber-300 ring-2 ring-amber-200' 
                   : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
               }`}
            >
               {isPaused ? (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    </svg>
                    <span>Resume</span>
                  </>
               ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 9v6m4-6v6" />
                    </svg>
                    <span>Pause</span>
                  </>
               )}
            </button>
            <button 
              onClick={() => setGameSpeed(prev => prev === 1 ? 2 : 1)} 
              className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all border hover:shadow-md hover:-translate-y-0.5 ${
                gameSpeed === 2 
                  ? 'bg-emerald-50 text-emerald-600 border-emerald-200 ring-2 ring-emerald-100' 
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span>{gameSpeed === 2 ? '2x Speed' : '1x Speed'}</span>
            </button>
         </div>

         <div className="flex gap-6 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wide">
            <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-blue-500 shadow-sm"></span> Road</span>
            <span className={`flex items-center gap-2 ${isOrthoMode ? 'text-blue-600' : ''}`}><span className="w-2 h-2 rounded-full bg-indigo-500 shadow-sm"></span> Straight (F)</span>
            <span className={`flex items-center gap-2 ${isCurveMode ? 'text-purple-600' : ''}`}><span className="w-2 h-2 rounded-full bg-purple-500 shadow-sm"></span> Curve (Shift)</span>
         </div>
      </div>

      {/* 캔버스 */}
      <div className="rounded-2xl overflow-hidden shadow-2xl border border-white/50 ring-1 ring-slate-200/50 max-w-full max-h-[80vh] relative bg-slate-100">
        <canvas
          ref={canvasRef}
          width={mapSize.width * zoom}
          height={mapSize.height * zoom}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          className="cursor-crosshair bg-white"
        />
        
        {/* 도로 선택 오버레이 */}
        {selectedRoad && (() => {
          const road = selectedRoad;
          let cx, cy;
          if (road.controlPoint) {
              const t = 0.5;
              cx = (1-t)*(1-t)*road.start.x + 2*(1-t)*t*road.controlPoint.x + t*t*road.end.x;
              cy = (1-t)*(1-t)*road.start.y + 2*(1-t)*t*road.controlPoint.y + t*t*road.end.y;
          } else {
              cx = (road.start.x + road.end.x)/2;
              cy = (road.start.y + road.end.y)/2;
          }
          return (
            <div 
              className="absolute z-10 p-2 pointer-events-none" 
              style={{ left: cx * zoom, top: cy * zoom, transform: 'translate(-50%, -100%)' }}
            >
               <div className="flex bg-white rounded-lg shadow-xl border border-slate-200 overflow-hidden divide-x divide-slate-100 pointer-events-auto">
                  <button 
                     onClick={(e) => { e.stopPropagation(); alert('Feature coming soon'); }}
                     className="px-3 py-2 text-slate-400 hover:bg-slate-50 active:bg-slate-100 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                  <button 
                     onClick={(e) => {
                        e.stopPropagation();
                        setRoads(prev => prev.filter(r => r !== road));
                        setSelectedRoad(null);
                     }}
                     className="px-3 py-2 text-rose-500 hover:bg-rose-50 active:bg-rose-100 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
               </div>
               <div className="w-2.5 h-2.5 bg-white border-r border-b border-slate-200 transform rotate-45 mx-auto -mt-1.5 shadow-sm"></div>
            </div>
          );
        })()}
        
        {/* 게임 오버 오버레이 */}
        {isGameOver && (
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center">
             <div className="bg-white rounded-3xl p-8 shadow-2xl text-center max-w-md w-full border border-slate-200 animate-bounce-in">
                <div className="w-20 h-20 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-6 text-rose-500">
                    <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                </div>
                <h2 className="text-3xl font-black text-slate-800 mb-2 tracking-tight">GAME OVER</h2>
                <p className="text-slate-500 mb-8 font-medium">Critical Infrastructure Failure</p>
                
                <div className="bg-slate-50 rounded-2xl p-6 mb-8 border border-slate-100">
                    <p className="text-xs text-slate-400 uppercase font-extrabold tracking-widest mb-2">SURVIVAL TIME</p>
                    <p className="text-5xl font-black text-indigo-600 tracking-tighter mb-4">
                      {Math.floor(gameTime / 60)}<span className="text-2xl text-indigo-300 font-bold ml-1">m</span> {gameTime % 60}<span className="text-2xl text-indigo-300 font-bold ml-1">s</span>
                    </p>
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg text-sm font-bold border border-emerald-100">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {score} REMAINING
                    </div>
                </div>
                
                <button 
                  onClick={() => startNewGame()}
                  className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold text-lg hover:bg-indigo-700 active:transform active:scale-95 transition-all shadow-xl shadow-indigo-200"
                >
                  Try Again
                </button>
             </div>
          </div>
        )}
      </div>

      {/* 교차점 표시 */}
      {intersections.length > 0 && (
        <div className="mt-6 text-sm">
          <span className="inline-flex items-center gap-2 bg-white/60 backdrop-blur-md border border-white/50 rounded-full px-4 py-1.5 text-slate-600 shadow-sm ring-1 ring-slate-200/50">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
            </span>
            <span className="font-bold">{intersections.length}</span> Active Intersections
          </span>
        </div>
      )}

      {/* HUD UI: 툴 선택 바 */}
      <div className="mt-4 z-40">
        <div className="flex bg-white/80 backdrop-blur-xl border border-white/50 ring-1 ring-slate-200/50 rounded-3xl shadow-2xl p-2.5 gap-3">
           {/* Normal Tool */}
           <button
             onClick={() => setActiveTool('normal')}
             className={`w-16 h-16 rounded-2xl flex flex-col items-center justify-center transition-all duration-300 ${activeTool === 'normal' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 scale-110' : 'bg-white text-slate-400 hover:bg-slate-50 hover:text-slate-600'}`}
           >
              <svg className="w-7 h-7 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
              </svg>
              <span className="text-[10px] font-extrabold tracking-wide uppercase">Road</span>
           </button>

           {/* Bridge Tool */}
           <button
             onClick={() => setActiveTool('bridge')}
             className={`w-16 h-16 rounded-2xl flex flex-col items-center justify-center transition-all duration-300 relative ${activeTool === 'bridge' ? 'bg-amber-600 text-white shadow-lg shadow-amber-200 scale-110' : 'bg-white text-slate-400 hover:bg-slate-50 hover:text-slate-600'}`}
           >
              <svg className="w-7 h-7 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5" />
              </svg>
              <span className="text-[10px] font-extrabold tracking-wide uppercase">Bridge</span>
              {/* Count Badge */}
              <div className={`absolute -top-1.5 -right-1.5 min-w-[22px] h-[22px] px-1.5 rounded-full flex items-center justify-center text-[11px] font-black border-[3px] border-white shadow-sm ${bridgeCount > 0 ? 'bg-blue-500 text-white' : 'bg-slate-200 text-slate-400'}`}>
                 {bridgeCount}
              </div>
           </button>

           {/* Highway Tool */}
           <button
             onClick={() => setActiveTool('highway')}
             className={`w-16 h-16 rounded-2xl flex flex-col items-center justify-center transition-all duration-300 relative ${activeTool === 'highway' ? 'bg-sky-500 text-white shadow-lg shadow-sky-200 scale-110' : 'bg-white text-slate-400 hover:bg-slate-50 hover:text-slate-600'}`}
           >
              <svg className="w-7 h-7 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span className="text-[10px] font-extrabold tracking-wide uppercase">Highway</span>
              {/* Count Badge */}
              <div className={`absolute -top-1.5 -right-1.5 min-w-[22px] h-[22px] px-1.5 rounded-full flex items-center justify-center text-[11px] font-black border-[3px] border-white shadow-sm ${highwayCount > 0 ? 'bg-blue-500 text-white' : 'bg-slate-200 text-slate-400'}`}>
                 {highwayCount}
              </div>
           </button>
        </div>
      </div>
    </div>
  );
};

export default RoadGame;
