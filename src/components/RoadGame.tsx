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
  LANE_OFFSET,
  MAX_VEHICLES,
  VEHICLE_SPAWN_INTERVAL,
  OFFICE_WAIT_TIME,
  SCORE_PER_TRIP,
} from '../constants';
import { 
  distance, 
  snapToGrid, 
  shadeColor, 
  sampleBezierCurve,
  generateRandomRiver,
  generateRandomBuildings,
  doRoadsOverlap,
} from '../utils';

// ============ 메인 컴포넌트 ============

const RoadGame: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // 게임 상태
  const [roads, setRoads] = useState<Road[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [intersections, setIntersections] = useState<Intersection[]>([]);
  const [score, setScore] = useState(0);
  
  // 도로 그리기 상태
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState<Point | null>(null);
  const [currentEnd, setCurrentEnd] = useState<Point | null>(null);
  const [controlPoint, setControlPoint] = useState<Point | null>(null);
  const [isCurveMode, setIsCurveMode] = useState(false);
  
  // 월드 상태 (한 번만 생성)
  const [riverSegments] = useState<RiverSegment[]>(() => generateRandomRiver());
  const [buildings] = useState<Building[]>(() => generateRandomBuildings(riverSegments));

  // ============ 강 충돌 검사 ============

  /** X 좌표에서 강의 Y 위치와 너비 계산 */
  const getRiverYAtX = useCallback((x: number): { y: number; width: number } => {
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
    const { y: riverY, width: riverWidth } = getRiverYAtX(point.x);
    return Math.abs(point.y - riverY) < riverWidth / 2 + 10;
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

  /** 교차점 찾기 */
  const findIntersections = useCallback((roadList: Road[]): Intersection[] => {
    const points = new Map<string, number>();
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
        result.push({ point: { x, y }, vehicleCount: 0 });
      }
    });
    return result;
  }, []);

  /** BFS로 최단 경로 찾기 */
  const findPath = useCallback((start: Point, end: Point, roadList: Road[]): Point[] | null => {
    if (roadList.length === 0) return null;

    // 그래프 생성
    const graph = new Map<string, { point: Point; road: Road }[]>();
    roadList.forEach(road => {
      const startKey = `${road.start.x},${road.start.y}`;
      const endKey = `${road.end.x},${road.end.y}`;
      if (!graph.has(startKey)) graph.set(startKey, []);
      if (!graph.has(endKey)) graph.set(endKey, []);
      graph.get(startKey)!.push({ point: road.end, road });
      graph.get(endKey)!.push({ point: road.start, road });
    });

    // 가장 가까운 노드 찾기
    let closestStart: Point | null = null;
    let closestEnd: Point | null = null;
    let closestStartDist = Infinity;
    let closestEndDist = Infinity;

    graph.forEach((_, key) => {
      const [x, y] = key.split(',').map(Number);
      const point: Point = { x, y };
      const distToStart = distance(point, start);
      const distToEnd = distance(point, end);
      if (distToStart < closestStartDist) {
        closestStartDist = distToStart;
        closestStart = point;
      }
      if (distToEnd < closestEndDist) {
        closestEndDist = distToEnd;
        closestEnd = point;
      }
    });

    if (!closestStart || !closestEnd) return null;

    // BFS 탐색
    const startNode: Point = closestStart;
    const endNode: Point = closestEnd;
    
    const queue: { point: Point; path: Point[]; roads: Road[] }[] = [
      { point: startNode, path: [start, startNode], roads: [] }
    ];
    const visited = new Set<string>();
    visited.add(`${startNode.x},${startNode.y}`);

    while (queue.length > 0) {
      const { point, path, roads: pathRoads } = queue.shift()!;
      const key = `${point.x},${point.y}`;

      if (point.x === endNode.x && point.y === endNode.y) {
        // 경로 구성 (커브 포함)
        const finalPath: Point[] = [start];
        for (let i = 0; i < pathRoads.length; i++) {
          const road = pathRoads[i];
          const fromPoint = path[i + 1];
          
          if (road.controlPoint) {
            const isForward = road.start.x === fromPoint.x && road.start.y === fromPoint.y;
            const curvePoints = sampleBezierCurve(
              isForward ? road.start : road.end,
              road.controlPoint,
              isForward ? road.end : road.start,
              8
            );
            for (let j = 1; j < curvePoints.length; j++) {
              finalPath.push(curvePoints[j]);
            }
          } else {
            finalPath.push(path[i + 2]);
          }
        }
        finalPath.push(end);
        return finalPath;
      }

      const neighbors = graph.get(key) || [];
      for (const { point: neighbor, road } of neighbors) {
        const neighborKey = `${neighbor.x},${neighbor.y}`;
        if (!visited.has(neighborKey)) {
          visited.add(neighborKey);
          queue.push({ 
            point: neighbor, 
            path: [...path, neighbor], 
            roads: [...pathRoads, road] 
          });
        }
      }
    }
    return null;
  }, []);

  // ============ 차량 관리 ============

  /** 집에 맞는 회사 찾기 */
  const findOfficeForHome = useCallback((homeBuilding: Building): Building | null => {
    const colorPrefix = homeBuilding.id.split('-')[0];
    return buildings.find(b => b.id === `${colorPrefix}-office`) || null;
  }, [buildings]);

  /** 건물에서 차량 생성 */
  const spawnVehicleFromBuilding = useCallback((fromBuilding: Building) => {
    if (!fromBuilding.id.includes('-home')) return;
    const toBuilding = findOfficeForHome(fromBuilding);
    if (!toBuilding) return;

    const path = findPath(fromBuilding.position, toBuilding.position, roads);
    if (path && path.length >= 2) {
      const newVehicle: Vehicle = {
        id: `vehicle-${Date.now()}-${Math.random()}`,
        position: { ...path[0] },
        targetIndex: 1,
        path,
        speed: 1.2 + Math.random() * 1,
        waitTime: 0,
        color: fromBuilding.color,
        lane: 'right',
        direction: 0,
        fromBuilding: fromBuilding.id,
        toBuilding: toBuilding.id,
        status: 'going-to-office',
        officeArrivalTime: 0,
      };
      setVehicles(prev => [...prev, newVehicle]);
    }
  }, [findPath, roads, findOfficeForHome]);

  /** 랜덤 집에서 차량 생성 (도로 연결된 집만) */
  const spawnVehicle = useCallback(() => {
    const homeBuildings = buildings.filter(b => b.id.includes('-home'));
    
    // 도로가 연결된 집만 필터링
    const connectedHomes = homeBuildings.filter(home => {
      const office = findOfficeForHome(home);
      if (!office) return false;
      const path = findPath(home.position, office.position, roads);
      return path && path.length >= 2;
    });
    
    if (connectedHomes.length === 0) return;
    
    const randomHome = connectedHomes[Math.floor(Math.random() * connectedHomes.length)];
    spawnVehicleFromBuilding(randomHome);
  }, [buildings, spawnVehicleFromBuilding, findOfficeForHome, findPath, roads]);

  /** 귀가 경로 생성 */
  const createReturnPath = useCallback((vehicle: Vehicle): Point[] | null => {
    const officeBuilding = buildings.find(b => b.id === vehicle.toBuilding);
    const homeBuilding = buildings.find(b => b.id === vehicle.fromBuilding);
    if (!officeBuilding || !homeBuilding) return null;
    return findPath(officeBuilding.position, homeBuilding.position, roads);
  }, [buildings, roads, findPath]);

  // ============ 이벤트 핸들러 ============

  /** 키보드 이벤트 (Shift로 커브 모드) */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift') setIsCurveMode(true);
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') setIsCurveMode(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  /** 마우스 다운 - 도로 그리기 시작 */
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const point = snapToGrid({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    setIsDrawing(true);
    setDrawStart(point);
    setCurrentEnd(point);
    setControlPoint(null);
  };

  /** 마우스 이동 - 도로 프리뷰 */
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const point = snapToGrid({ x: e.clientX - rect.left, y: e.clientY - rect.top });
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
        const mouseToMidX = (e.clientX - rect.left) - midX;
        const mouseToMidY = (e.clientY - rect.top) - midY;
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

  /** 마우스 업 - 도로 생성 */
  const handleMouseUp = () => {
    if (isDrawing && drawStart && currentEnd) {
      if (distance(drawStart, currentEnd) > GRID_SIZE) {
        // 강 충돌 검사
        const crossesRiver = controlPoint
          ? doesCurveRoadCrossRiver(drawStart, currentEnd, controlPoint)
          : doesRoadCrossRiver(drawStart, currentEnd);
        
        // 도로 중복 검사
        const overlapsRoad = doRoadsOverlap(drawStart, currentEnd, roads, controlPoint || undefined);
        
        // 검사 통과 시 도로 생성
        if (!crossesRiver && !overlapsRoad) {
          const newRoad: Road = {
            id: `road-${Date.now()}`,
            start: drawStart,
            end: currentEnd,
            controlPoint: controlPoint || undefined,
          };
          setRoads(prev => {
            const updated = [...prev, newRoad];
            setIntersections(findIntersections(updated));
            return updated;
          });
        }
      }
    }
    setIsDrawing(false);
    setDrawStart(null);
    setCurrentEnd(null);
    setControlPoint(null);
  };

  // ============ 게임 루프 ============

  /** 차선 오프셋 계산 */
  const getLaneOffset = (from: Point, to: Point, lane: 'left' | 'right'): Point => {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    if (length === 0) return { x: 0, y: 0 };
    const perpX = -dy / length;
    const perpY = dx / length;
    const offset = lane === 'right' ? LANE_OFFSET : -LANE_OFFSET;
    return { x: perpX * offset, y: perpY * offset };
  };

  /** 메인 게임 루프 */
  useEffect(() => {
    const gameLoop = setInterval(() => {
      const currentTime = Date.now();
      
      setVehicles(prevVehicles => {
        // 교차점 대기열 생성
        const intersectionQueues = new Map<string, { id: string; arrivalTime: number }[]>();
        const movingVehicles = prevVehicles.filter(v =>
          (v.status === 'going-to-office' || v.status === 'going-home') && 
          v.targetIndex < v.path.length
        );

        movingVehicles.forEach(vehicle => {
          intersections.forEach(intersection => {
            const dist = distance(vehicle.position, intersection.point);
            if (dist < 30) {
              const key = `${intersection.point.x},${intersection.point.y}`;
              if (!intersectionQueues.has(key)) intersectionQueues.set(key, []);
              const queue = intersectionQueues.get(key)!;
              if (!queue.find(v => v.id === vehicle.id)) {
                queue.push({ id: vehicle.id, arrivalTime: currentTime - vehicle.waitTime * 1000 });
              }
            }
          });
        });

        let scoreIncrease = 0;
        
        const updatedVehicles = prevVehicles.map(vehicle => {
          // 회사 대기 중
          if (vehicle.status === 'at-office') {
            if (currentTime - vehicle.officeArrivalTime >= OFFICE_WAIT_TIME) {
              const returnPath = createReturnPath(vehicle);
              if (returnPath && returnPath.length >= 2) {
                return {
                  ...vehicle,
                  status: 'going-home' as const,
                  path: returnPath,
                  targetIndex: 1,
                  position: { ...returnPath[0] },
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
          const laneOffset = getLaneOffset(
            vehicle.path[Math.max(0, vehicle.targetIndex - 1)],
            target,
            vehicle.lane
          );
          const adjustedTarget = { x: target.x + laneOffset.x, y: target.y + laneOffset.y };
          const dx = adjustedTarget.x - vehicle.position.x;
          const dy = adjustedTarget.y - vehicle.position.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          // 대기 판단
          let shouldWait = false;
          
          // 교차점 대기
          intersections.forEach(intersection => {
            const distToIntersection = distance(vehicle.position, intersection.point);
            if (distToIntersection < 30 && distToIntersection > 5) {
              const key = `${intersection.point.x},${intersection.point.y}`;
              const queue = intersectionQueues.get(key);
              if (queue && queue.length > 0) {
                queue.sort((a, b) => a.arrivalTime - b.arrivalTime);
                if (queue[0].id !== vehicle.id) {
                  const myIndex = queue.findIndex(v => v.id === vehicle.id);
                  if (myIndex > 0) shouldWait = true;
                }
              }
            }
          });

          // 차량 충돌 방지
          movingVehicles.forEach(otherVehicle => {
            if (otherVehicle.id !== vehicle.id) {
              const distToOther = distance(vehicle.position, otherVehicle.position);
              if (distToOther < VEHICLE_SIZE * 3) {
                const myProgress = vehicle.targetIndex / vehicle.path.length;
                const otherProgress = otherVehicle.targetIndex / otherVehicle.path.length;
                if (myProgress > otherProgress) shouldWait = true;
              }
            }
          });

          if (shouldWait) {
            return { ...vehicle, waitTime: vehicle.waitTime + 0.016 };
          }

          // 이동
          if (dist < vehicle.speed) {
            return {
              ...vehicle,
              position: adjustedTarget,
              targetIndex: vehicle.targetIndex + 1,
              direction: Math.atan2(dy, dx),
              waitTime: Math.max(0, vehicle.waitTime - 0.016),
            };
          } else {
            return {
              ...vehicle,
              position: { 
                x: vehicle.position.x + (dx / dist) * vehicle.speed, 
                y: vehicle.position.y + (dy / dist) * vehicle.speed 
              },
              direction: Math.atan2(dy, dx),
              waitTime: Math.max(0, vehicle.waitTime - 0.016),
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
  }, [intersections, createReturnPath]);

  /** 자동 차량 생성 */
  useEffect(() => {
    if (roads.length === 0) return;
    const spawnInterval = setInterval(() => {
      if (vehicles.length < MAX_VEHICLES) spawnVehicle();
    }, VEHICLE_SPAWN_INTERVAL);
    return () => clearInterval(spawnInterval);
  }, [roads.length, vehicles.length, spawnVehicle]);

  // ============ 렌더링 ============

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 배경
    ctx.fillStyle = '#f5f5f4';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // 강 렌더링
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

    // 도로 외곽선
    ctx.strokeStyle = '#9ca3af';
    ctx.lineWidth = 28;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
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

    // 도로 본체
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 24;
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

    // 도로 프리뷰
    if (isDrawing && drawStart && currentEnd) {
      const crossesRiver = controlPoint
        ? doesCurveRoadCrossRiver(drawStart, currentEnd, controlPoint)
        : doesRoadCrossRiver(drawStart, currentEnd);
      const overlapsRoad = doRoadsOverlap(drawStart, currentEnd, roads, controlPoint || undefined);
      const previewColor = (crossesRiver || overlapsRoad) 
        ? 'rgba(239, 68, 68, 0.5)' 
        : 'rgba(66, 133, 244, 0.3)';

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

    // 교차점
    intersections.forEach(intersection => {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(intersection.point.x, intersection.point.y, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#9ca3af';
      ctx.lineWidth = 2;
      ctx.stroke();
    });

    // 건물 렌더링
    buildings.forEach(building => {
      const isHome = building.id.includes('-home');
      const cx = building.position.x;
      const cy = building.position.y;

      if (isHome) {
        // 집 - 등각 투영
        const houseWidth = 44;
        const houseDepth = 32;
        const wallHeight = 28;
        const roofHeight = 22;

        // 왼쪽 벽
        ctx.fillStyle = shadeColor(building.color, -20);
        ctx.beginPath();
        ctx.moveTo(cx - houseWidth/2, cy);
        ctx.lineTo(cx, cy + houseDepth/2);
        ctx.lineTo(cx, cy + houseDepth/2 - wallHeight);
        ctx.lineTo(cx - houseWidth/2, cy - wallHeight);
        ctx.closePath();
        ctx.fill();

        // 오른쪽 벽
        ctx.fillStyle = building.color;
        ctx.beginPath();
        ctx.moveTo(cx + houseWidth/2, cy);
        ctx.lineTo(cx, cy + houseDepth/2);
        ctx.lineTo(cx, cy + houseDepth/2 - wallHeight);
        ctx.lineTo(cx + houseWidth/2, cy - wallHeight);
        ctx.closePath();
        ctx.fill();

        // 왼쪽 지붕
        ctx.fillStyle = shadeColor(building.color, -40);
        ctx.beginPath();
        ctx.moveTo(cx - houseWidth/2 - 4, cy - wallHeight + 4);
        ctx.lineTo(cx, cy + houseDepth/2 - wallHeight + 4);
        ctx.lineTo(cx, cy - wallHeight - roofHeight);
        ctx.lineTo(cx - houseWidth/2 - 4, cy - wallHeight - roofHeight + 8);
        ctx.closePath();
        ctx.fill();

        // 오른쪽 지붕
        ctx.fillStyle = shadeColor(building.color, -25);
        ctx.beginPath();
        ctx.moveTo(cx + houseWidth/2 + 4, cy - wallHeight + 4);
        ctx.lineTo(cx, cy + houseDepth/2 - wallHeight + 4);
        ctx.lineTo(cx, cy - wallHeight - roofHeight);
        ctx.lineTo(cx + houseWidth/2 + 4, cy - wallHeight - roofHeight + 8);
        ctx.closePath();
        ctx.fill();
      } else {
        // 회사 - 등각 투영
        const buildingWidth = 50;
        const buildingDepth = 35;
        const buildingHeight = 55;

        // 왼쪽 벽
        ctx.fillStyle = shadeColor(building.color, -15);
        ctx.beginPath();
        ctx.moveTo(cx - buildingWidth/2, cy);
        ctx.lineTo(cx, cy + buildingDepth/2);
        ctx.lineTo(cx, cy + buildingDepth/2 - buildingHeight);
        ctx.lineTo(cx - buildingWidth/2, cy - buildingHeight);
        ctx.closePath();
        ctx.fill();

        // 오른쪽 벽
        ctx.fillStyle = building.color;
        ctx.beginPath();
        ctx.moveTo(cx + buildingWidth/2, cy);
        ctx.lineTo(cx, cy + buildingDepth/2);
        ctx.lineTo(cx, cy + buildingDepth/2 - buildingHeight);
        ctx.lineTo(cx + buildingWidth/2, cy - buildingHeight);
        ctx.closePath();
        ctx.fill();

        // 지붕
        ctx.fillStyle = shadeColor(building.color, 20);
        ctx.beginPath();
        ctx.moveTo(cx - buildingWidth/2, cy - buildingHeight);
        ctx.lineTo(cx, cy + buildingDepth/2 - buildingHeight);
        ctx.lineTo(cx + buildingWidth/2, cy - buildingHeight);
        ctx.lineTo(cx, cy - buildingDepth/2 - buildingHeight);
        ctx.closePath();
        ctx.fill();

        // 대기 차량 수
        const waitingCount = vehicles.filter(v => 
          v.status === 'at-office' && v.toBuilding === building.id
        ).length;
        
        if (waitingCount > 0) {
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(cx + 30, cy - buildingHeight + 10, 12, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = building.color;
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.fillStyle = building.color;
          ctx.font = 'bold 11px system-ui';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(waitingCount.toString(), cx + 30, cy - buildingHeight + 10);
        }
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

  }, [
    roads, vehicles, isDrawing, drawStart, currentEnd, controlPoint, 
    intersections, riverSegments, buildings, doesRoadCrossRiver, doesCurveRoadCrossRiver
  ]);

  // ============ UI ============

  const clearRoads = () => {
    setRoads([]);
    setVehicles([]);
    setIntersections([]);
    setScore(0);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex flex-col items-center justify-center p-8">
      <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
        City Road Builder
      </h1>
      <p className="text-slate-500 mb-6">도로를 건설하고 출퇴근 시스템을 구축하세요</p>

      {/* 상태 표시 */}
      <div className="flex gap-6 mb-5">
        <div className="bg-white/80 backdrop-blur-sm border border-slate-200/60 rounded-xl px-6 py-3 shadow-sm">
          <p className="text-xs text-slate-400 uppercase tracking-wider font-medium">점수</p>
          <p className="text-2xl font-bold text-indigo-600">{score}</p>
        </div>
        <div className="bg-white/80 backdrop-blur-sm border border-slate-200/60 rounded-xl px-6 py-3 shadow-sm">
          <p className="text-xs text-slate-400 uppercase tracking-wider font-medium">차량</p>
          <p className="text-2xl font-bold text-emerald-600">{vehicles.length}</p>
        </div>
        <div className="bg-white/80 backdrop-blur-sm border border-slate-200/60 rounded-xl px-6 py-3 shadow-sm">
          <p className="text-xs text-slate-400 uppercase tracking-wider font-medium">도로</p>
          <p className="text-2xl font-bold text-blue-600">{roads.length}</p>
        </div>
      </div>

      {/* 버튼 */}
      <div className="flex gap-3 mb-5">
        <button 
          onClick={clearRoads} 
          className="px-5 py-2.5 bg-white border border-slate-200 rounded-xl font-medium text-slate-600 shadow-sm hover:bg-slate-50"
        >
          초기화
        </button>
        <button 
          onClick={spawnVehicle} 
          disabled={roads.length === 0} 
          className="px-5 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl font-medium text-white shadow-sm disabled:opacity-50"
        >
          차량 추가
        </button>
      </div>

      {/* 도움말 */}
      <div className="bg-white/60 backdrop-blur-sm border border-slate-200/60 rounded-xl px-5 py-3 mb-5 shadow-sm">
        <div className="flex flex-wrap justify-center gap-6 text-sm text-slate-500">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 bg-blue-400 rounded-full"></div>
            <span>드래그로 직선 도로</span>
          </div>
          <div className={`flex items-center gap-2 ${isCurveMode ? 'text-purple-600 font-semibold' : ''}`}>
            <div className={`w-2.5 h-2.5 rounded-full ${isCurveMode ? 'bg-purple-500 animate-pulse' : 'bg-purple-400'}`}></div>
            <span>Shift + 드래그로 커브 도로</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 bg-emerald-400 rounded-full"></div>
            <span>집 → 회사 → 집 사이클</span>
          </div>
        </div>
      </div>

      {/* 캔버스 */}
      <div className="rounded-xl overflow-hidden shadow-xl border border-white/50 ring-1 ring-slate-200/50">
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          className="cursor-crosshair bg-white"
        />
      </div>

      {/* 교차점 표시 */}
      {intersections.length > 0 && (
        <div className="mt-5 text-sm">
          <span className="inline-flex items-center gap-2 bg-white/80 backdrop-blur-sm border border-amber-200/60 rounded-full px-4 py-1.5 text-amber-600 shadow-sm">
            <span className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
            {intersections.length}개의 교차점 감지됨
          </span>
        </div>
      )}
    </div>
  );
};

export default RoadGame;
