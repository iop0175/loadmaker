/**
 * useVehicleLogic Hook
 * 차량 생성, 이동, 귀가 로직
 */

import { useCallback, useEffect } from 'react';
import type { Point, Road, Building, Vehicle, Intersection } from '../types';
import { 
  VEHICLE_SPEED,
  MAX_VEHICLES,
  VEHICLE_SPAWN_INTERVAL_MIN,
  VEHICLE_SPAWN_INTERVAL_MAX,
  OFFICE_WAIT_TIME,
  SCORE_PER_TRIP,
  MAX_VEHICLES_PER_HOME,
  MAX_VEHICLES_PER_OFFICE,
} from '../constants';
import { 
  distance,
  getLaneOffset,
  interpolatePath,
} from '../utils';
import { usePathfinding } from './usePathfinding';

interface UseVehicleLogicProps {
  buildings: Building[];
  roads: Road[];
  vehicles: Vehicle[];
  setVehicles: React.Dispatch<React.SetStateAction<Vehicle[]>>;
  vehiclesRef: React.MutableRefObject<Vehicle[]>;
  intersections: Intersection[];
  setScore: React.Dispatch<React.SetStateAction<number>>;
  gameSpeed: number;
  isGameOver: boolean;
  isPaused: boolean;
}

export function useVehicleLogic({
  buildings,
  roads,
  setVehicles,
  vehiclesRef,
  intersections,
  setScore,
  gameSpeed,
  isGameOver,
  isPaused,
}: UseVehicleLogicProps) {
  const { findPath } = usePathfinding();

  /** 집에 맞는 회사 찾기 */
  const findOfficeForHome = useCallback((homeBuilding: Building): Building | null => {
    const colorPrefix = homeBuilding.id.split('-')[0];
    const availableOffices = buildings.filter(b => b.id.startsWith(`${colorPrefix}-office`));
    if (availableOffices.length === 0) return null;
    return availableOffices[Math.floor(Math.random() * availableOffices.length)];
  }, [buildings]);

  /** 건물에서 차량 생성 */
  const spawnVehicleFromBuilding = useCallback((fromBuilding: Building) => {
    if (!fromBuilding.id.includes('-home')) return;
    const toBuilding = findOfficeForHome(fromBuilding);
    if (!toBuilding) return;

    const rawPath = findPath(fromBuilding.position, toBuilding.position, roads);
    if (rawPath && rawPath.length >= 2) {
      const path = interpolatePath(rawPath, roads, intersections);
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
  }, [findPath, roads, findOfficeForHome, setVehicles]);

  /** 모든 가능한 집에서 차량 생성 */
  const spawnVehicle = useCallback(() => {
    const currentVehicles = vehiclesRef.current;
    const homeBuildings = buildings.filter(b => b.id.includes('-home'));
    let currentTotal = currentVehicles.length;
    
    const officeCounts = new Map<string, number>();
    currentVehicles.forEach(v => {
      const count = officeCounts.get(v.toBuilding) || 0;
      officeCounts.set(v.toBuilding, count + 1);
    });

    for (const home of homeBuildings) {
      if (currentTotal >= 100) break;

      const office = findOfficeForHome(home);
      if (!office) continue;
      
      const vehiclesFromHome = currentVehicles.filter(v => v.fromBuilding === home.id).length;
      if (vehiclesFromHome >= MAX_VEHICLES_PER_HOME) continue;

      const currentOfficeCount = officeCounts.get(office.id) || 0;
      if (currentOfficeCount >= MAX_VEHICLES_PER_OFFICE) continue;

      const path = findPath(home.position, office.position, roads);
      if (!path || path.length < 2) continue;

      spawnVehicleFromBuilding(home);
      currentTotal++;
      officeCounts.set(office.id, currentOfficeCount + 1);
    }
  }, [buildings, spawnVehicleFromBuilding, findOfficeForHome, findPath, roads, vehiclesRef]);

  /** 귀가 경로 생성 */
  const createReturnPath = useCallback((vehicle: Vehicle): Point[] | null => {
    const officeBuilding = buildings.find(b => b.id === vehicle.toBuilding);
    const homeBuilding = buildings.find(b => b.id === vehicle.fromBuilding);
    if (!officeBuilding || !homeBuilding) return null;
    const rawPath = findPath(officeBuilding.position, homeBuilding.position, roads);
    return rawPath ? interpolatePath(rawPath, roads, intersections) : null;
  }, [buildings, roads, intersections, findPath]);

  /** 메인 게임 루프 */
  useEffect(() => {
    if (isGameOver || isPaused) return;
    
    const gameLoop = setInterval(() => {
      const currentTime = Date.now();
      
      setVehicles(prevVehicles => {
        // 교차점 도착 시간 업데이트
        const vehiclesWithArrivalTimes = prevVehicles.map(vehicle => {
          if (vehicle.status !== 'going-to-office' && vehicle.status !== 'going-home') {
            return vehicle;
          }
          
          const newArrivalTimes = { ...vehicle.intersectionArrivalTimes };
          
          intersections.forEach(intersection => {
            const key = `${intersection.point.x},${intersection.point.y}`;
            const dist = distance(vehicle.position, intersection.point);
            
            // 교차로 근처(35px 이내)에 있을 때만 큐에 추가
            // 교차로 밖(35px 초과)으로 나가면 즉시 큐에서 제거
            if (dist < 35) {
              if (!newArrivalTimes[key]) {
                newArrivalTimes[key] = currentTime;
              }
            } else {
              // 교차로에서 벗어나면 즉시 제거
              delete newArrivalTimes[key];
            }
          });
          
          return { ...vehicle, intersectionArrivalTimes: newArrivalTimes };
        });

        // FIFO 큐 구성
        const intersectionQueues = new Map<string, { id: string; arrivalTime: number }[]>();
        
        vehiclesWithArrivalTimes.forEach(vehicle => {
          if (vehicle.status !== 'going-to-office' && vehicle.status !== 'going-home') return;
          
          Object.entries(vehicle.intersectionArrivalTimes).forEach(([key, arrivalTime]) => {
            if (!intersectionQueues.has(key)) {
              intersectionQueues.set(key, []);
            }
            intersectionQueues.get(key)!.push({ id: vehicle.id, arrivalTime });
          });
        });
        
        intersectionQueues.forEach(queue => {
          queue.sort((a, b) => a.arrivalTime - b.arrivalTime);
        });

        let scoreIncrease = 0;
        
        const updatedVehicles = vehiclesWithArrivalTimes.map(vehicle => {
          // 회사 대기 중
          if (vehicle.status === 'at-office') {
            if ((currentTime - vehicle.officeArrivalTime) * gameSpeed >= OFFICE_WAIT_TIME) {
              const returnPath = createReturnPath(vehicle);
              if (returnPath && returnPath.length >= 2) {
                const offset = getLaneOffset(returnPath[0], returnPath[1], vehicle.lane);
                return {
                  ...vehicle,
                  status: 'going-home' as const,
                  path: returnPath,
                  targetIndex: 1,
                  position: { x: returnPath[0].x + offset.x, y: returnPath[0].y + offset.y },
                  intersectionArrivalTimes: {},
                };
              }
            }
            return vehicle;
          }

          if (vehicle.status === 'at-home') return null;
          
          if (vehicle.targetIndex >= vehicle.path.length) {
            if (vehicle.status === 'going-to-office') {
              return { ...vehicle, status: 'at-office' as const, officeArrivalTime: currentTime };
            } else if (vehicle.status === 'going-home') {
              scoreIncrease += SCORE_PER_TRIP;
              return null;
            }
            return vehicle;
          }

          const target = vehicle.path[vehicle.targetIndex];
          const prevPoint = vehicle.path[Math.max(0, vehicle.targetIndex - 1)];
          const laneOffset = getLaneOffset(prevPoint, target, vehicle.lane);
          const adjustedTarget = { x: target.x + laneOffset.x, y: target.y + laneOffset.y };
          
          const dx = adjustedTarget.x - vehicle.position.x;
          const dy = adjustedTarget.y - vehicle.position.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          let shouldWait = false;
          
          const insideIntersection = intersections.some(intersection => 
            distance(vehicle.position, intersection.point) < 15
          );
          
          // 교차로 안에서는 절대 멈추지 않음 - 무조건 통과
          if (!insideIntersection) {
            // 같은 차선에서 앞에 있는 차량과의 충돌 방지
            const aheadVehicle = vehiclesWithArrivalTimes.find(other => {
              if (other.id === vehicle.id) return false;
              if (other.status !== vehicle.status) return false;
              
              // 같은 도로 위에 있는지 확인 (목표 지점이 비슷한지)
              const sameRoad = other.path.length > 0 && vehicle.path.length > 0 &&
                other.targetIndex < other.path.length && vehicle.targetIndex < vehicle.path.length &&
                distance(other.path[other.targetIndex], target) < 10;
              
              if (!sameRoad) return false;
              
              // 앞에 있는지 확인 (목표까지의 거리가 더 가까운 차량)
              const otherDist = distance(other.position, other.path[other.targetIndex]);
              const myDist = distance(vehicle.position, target);
              
              return otherDist < myDist && distance(vehicle.position, other.position) < 25;
            });
            
            if (aheadVehicle) {
              shouldWait = true;
            }
          }
          
          if (!insideIntersection && !shouldWait) {
            intersections.forEach(intersection => {
              // 원형 교차로에서는 대기 없이 바로 통과
              if (intersection.isRoundabout) return;
              
              const distToIntersection = distance(vehicle.position, intersection.point);
              if (distToIntersection >= 15 && distToIntersection < 35) {
                const key = `${intersection.point.x},${intersection.point.y}`;
                const queue = intersectionQueues.get(key);
                
                // 교차로 안에 있는 같은 방향 차량이 있는지 확인
                const sameDirectionInIntersection = vehiclesWithArrivalTimes.some(other => 
                  other.id !== vehicle.id &&
                  other.status === vehicle.status &&
                  distance(other.position, intersection.point) < 15
                );
                
                if (sameDirectionInIntersection) {
                  shouldWait = true;
                } else if (queue && queue.length >= 2) {
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

          if (shouldWait) {
            return { ...vehicle, waitTime: vehicle.waitTime + 0.016 * gameSpeed };
          }

          const targetPt = vehicle.path[vehicle.targetIndex];
          const roadSpeedMult = targetPt.speedMultiplier || 1.0;
          const moveSpeed = vehicle.speed * roadSpeedMult * gameSpeed;

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
  }, [intersections, createReturnPath, gameSpeed, isGameOver, isPaused, setVehicles, setScore]);

  /** 각 집마다 개별 스폰 시간으로 차량 생성 */
  useEffect(() => {
    if (isGameOver || isPaused || roads.length === 0) return;
    
    const spawnCheckInterval = setInterval(() => {
      const currentTime = Date.now();
      const currentVehicles = vehiclesRef.current;
      
      if (currentVehicles.length >= MAX_VEHICLES) return;
      
      const homeBuildings = buildings.filter(b => b.id.includes('-home'));
      
      const officeCounts = new Map<string, number>();
      currentVehicles.forEach(v => {
        const count = officeCounts.get(v.toBuilding) || 0;
        officeCounts.set(v.toBuilding, count + 1);
      });
      
      for (const home of homeBuildings) {
        // 스폰 시간이 아직 설정되지 않았거나, 현재 시간이 스폰 시간을 지났는지 확인
        const nextSpawnTime = home.nextSpawnTime || 0;
        if (currentTime < nextSpawnTime) continue;
        
        const office = findOfficeForHome(home);
        if (!office) continue;
        
        const vehiclesFromHome = currentVehicles.filter(v => v.fromBuilding === home.id).length;
        if (vehiclesFromHome >= MAX_VEHICLES_PER_HOME) continue;
        
        const currentOfficeCount = officeCounts.get(office.id) || 0;
        if (currentOfficeCount >= MAX_VEHICLES_PER_OFFICE) continue;
        
        const path = findPath(home.position, office.position, roads);
        if (!path || path.length < 2) continue;
        
        // 차량 생성
        spawnVehicleFromBuilding(home);
        officeCounts.set(office.id, currentOfficeCount + 1);
        
        // 다음 스폰 시간 설정 (각 집마다 랜덤 간격)
        const randomInterval = VEHICLE_SPAWN_INTERVAL_MIN + 
          Math.random() * (VEHICLE_SPAWN_INTERVAL_MAX - VEHICLE_SPAWN_INTERVAL_MIN);
        home.nextSpawnTime = currentTime + (randomInterval / gameSpeed);
      }
    }, 100); // 100ms마다 체크
    
    return () => clearInterval(spawnCheckInterval);
  }, [roads.length, buildings, spawnVehicleFromBuilding, findOfficeForHome, findPath, gameSpeed, isGameOver, isPaused, vehiclesRef]);

  /** 도로 변경 시 이동 중인 차량 경로 재계산 */
  useEffect(() => {
    if (roads.length === 0) return;
    
    setVehicles(prevVehicles => {
      return prevVehicles.map(vehicle => {
        // 이동 중인 차량만 경로 재계산
        if (vehicle.status !== 'going-to-office' && vehicle.status !== 'going-home') {
          return vehicle;
        }
        
        // 현재 목표 건물 찾기
        const targetBuildingId = vehicle.status === 'going-to-office' ? vehicle.toBuilding : vehicle.fromBuilding;
        const targetBuilding = buildings.find(b => b.id === targetBuildingId);
        if (!targetBuilding) return vehicle;
        
        // 새 경로 계산
        const newRawPath = findPath(vehicle.position, targetBuilding.position, roads);
        if (!newRawPath || newRawPath.length < 2) return vehicle;
        
        const newPath = interpolatePath(newRawPath, roads, intersections);
        if (newPath.length < 2) return vehicle;
        
        // 새 경로가 더 짧으면 경로 변경
        const currentRemainingPath = vehicle.path.slice(vehicle.targetIndex);
        const currentRemainingDist = currentRemainingPath.reduce((acc, pt, i) => {
          if (i === 0) return acc;
          return acc + distance(currentRemainingPath[i - 1], pt);
        }, 0);
        
        const newPathDist = newPath.reduce((acc, pt, i) => {
          if (i === 0) return acc;
          return acc + distance(newPath[i - 1], pt);
        }, 0);
        
        // 새 경로가 20% 이상 짧으면 변경
        if (newPathDist < currentRemainingDist * 0.8) {
          return {
            ...vehicle,
            path: newPath,
            targetIndex: 1,
          };
        }
        
        return vehicle;
      });
    });
  }, [roads.length, buildings, findPath, setVehicles]);

  return {
    spawnVehicle,
    createReturnPath,
  };
}
