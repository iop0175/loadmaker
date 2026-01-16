/**
 * useGameState Hook
 * 게임 핵심 상태 관리 (점수, 시간, 아이템, 게임오버, 일시정지)
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type { Road, Building, Vehicle, Intersection, RiverSegment } from '../types';
import type { Language } from '../i18n';
import { detectLanguage } from '../i18n';
import { 
  CANVAS_WIDTH, 
  CANVAS_HEIGHT,
  BUILDING_COLORS,
} from '../constants';
import { 
  generateRandomRiver,
  generateRandomBuildings,
  generateBuildingPair,
  generateHome,
  generateOffice,
} from '../utils';
import type { ActiveTool } from '../components/ui';

interface GameStateReturn {
  // 게임 상태
  score: number;
  setScore: React.Dispatch<React.SetStateAction<number>>;
  gameTime: number;
  destroyedCount: number;
  setDestroyedCount: React.Dispatch<React.SetStateAction<number>>;
  isGameOver: boolean;
  isPaused: boolean;
  setIsPaused: React.Dispatch<React.SetStateAction<boolean>>;
  gameSpeed: number;
  setGameSpeed: React.Dispatch<React.SetStateAction<number>>;
  
  // 아이템
  bridgeCount: number;
  setBridgeCount: React.Dispatch<React.SetStateAction<number>>;
  highwayCount: number;
  setHighwayCount: React.Dispatch<React.SetStateAction<number>>;
  trafficLightCount: number;
  setTrafficLightCount: React.Dispatch<React.SetStateAction<number>>;
  activeTool: ActiveTool;
  setActiveTool: React.Dispatch<React.SetStateAction<ActiveTool>>;
  
  // 맵/월드
  mapSize: { width: number; height: number };
  riverSegments: RiverSegment[];
  buildings: Building[];
  setBuildings: React.Dispatch<React.SetStateAction<Building[]>>;
  
  // 도로/교차점
  roads: Road[];
  setRoads: React.Dispatch<React.SetStateAction<Road[]>>;
  intersections: Intersection[];
  setIntersections: React.Dispatch<React.SetStateAction<Intersection[]>>;
  
  // 차량
  vehicles: Vehicle[];
  setVehicles: React.Dispatch<React.SetStateAction<Vehicle[]>>;
  vehiclesRef: React.MutableRefObject<Vehicle[]>;
  
  // 언어
  language: Language;
  setLanguage: React.Dispatch<React.SetStateAction<Language>>;
  
  // 경고 메시지
  warningMessage: string;
  showWarning: (message: string) => void;
  
  // 기능
  startNewGame: () => void;
}

export function useGameState(): GameStateReturn {
  // 언어
  const [language, setLanguage] = useState<Language>(detectLanguage);
  
  // 경고 메시지
  const [warningMessage, setWarningMessage] = useState('');
  const warningTimeoutRef = useRef<number | null>(null);
  
  const showWarning = useCallback((message: string) => {
    setWarningMessage(message);
    if (warningTimeoutRef.current) {
      clearTimeout(warningTimeoutRef.current);
    }
    warningTimeoutRef.current = window.setTimeout(() => {
      setWarningMessage('');
    }, 3000);
  }, []);

  // 맵 크기
  const [mapSize, setMapSize] = useState({ width: CANVAS_WIDTH, height: CANVAS_HEIGHT });

  // 월드 상태
  const [riverSegments, setRiverSegments] = useState<RiverSegment[]>(() => generateRandomRiver());
  const [buildings, setBuildings] = useState<Building[]>(() => generateRandomBuildings(riverSegments, 1));

  // 게임 상태
  const [roads, setRoads] = useState<Road[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const vehiclesRef = useRef(vehicles);
  vehiclesRef.current = vehicles;

  const [intersections, setIntersections] = useState<Intersection[]>([]);
  const [score, setScore] = useState(1000);
  const [gameTime, setGameTime] = useState(0);
  const [bridgeCount, setBridgeCount] = useState(1);
  const [highwayCount, setHighwayCount] = useState(1);
  const [trafficLightCount, setTrafficLightCount] = useState(1);
  const [activeTool, setActiveTool] = useState<ActiveTool>('normal');
  const [destroyedCount, setDestroyedCount] = useState(0);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [gameSpeed, setGameSpeed] = useState(1);

  // 새 게임 시작
  const startNewGame = useCallback(() => {
    const initialWidth = CANVAS_WIDTH;
    const initialHeight = CANVAS_HEIGHT;
    setMapSize({ width: initialWidth, height: initialHeight });

    const newRiver = generateRandomRiver(1000, 750);
    setRiverSegments(newRiver);
    setBuildings(generateRandomBuildings(newRiver, 1, initialWidth, initialHeight));
    
    setRoads([]);
    setVehicles([]);
    setIntersections([]);
    
    setScore(1000);
    setGameTime(0);
    setBridgeCount(1);
    setHighwayCount(1);
    setTrafficLightCount(1);
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

  // 게임 오버 체크
  useEffect(() => {
    if (destroyedCount >= 3 && !isGameOver) {
      setIsGameOver(true);
    }
  }, [destroyedCount, isGameOver]);

  // 시간에 따른 건물 추가 생성
  useEffect(() => {
    if (isGameOver || isPaused) return;
    
    const basePairsCount = buildings.filter(b => !b.id.split('-')[2] && b.id.includes('home')).length;

    // 레벨 3 -> 맵 확장
    if (basePairsCount >= 3 && mapSize.width === CANVAS_WIDTH) {
      setMapSize({ width: 1000, height: 750 });
    }

    // 시간 기반 건물 생성 (초 단위)
    // 60초마다 새 건물 쌍 추가 (최대 5쌍까지)
    const TIME_THRESHOLDS = [60, 120, 180, 240]; // 1분, 2분, 3분, 4분
    
    if (basePairsCount < 5) {
      if (basePairsCount > 0) {
        const nextThreshold = TIME_THRESHOLDS[basePairsCount - 1];
        if (gameTime >= nextThreshold) {
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
      // 5쌍 이후에는 2분마다 집 추가, 4분마다 회사 추가
      const baseTime = 240; // 4분 기준
      const extraTime = Math.max(0, gameTime - baseTime);
      
      const targetHomes = 5 + Math.floor(extraTime / 120); // 2분마다 집 1개
      const currentHomes = buildings.filter(b => b.id.includes('home')).length;
      
      if (targetHomes > currentHomes) {
        const colorIdx = currentHomes % 5;
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
      
      const targetOffices = 5 + Math.floor(extraTime / 240); // 4분마다 회사 1개
      const currentOffices = buildings.filter(b => b.id.includes('office')).length;
      
      if (targetOffices > currentOffices) {
        const colorIdx = currentOffices % 5;
        const targetColor = BUILDING_COLORS[colorIdx];
        
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
  }, [gameTime, buildings, riverSegments, mapSize, roads, isGameOver, isPaused]);

  // 건물 비활성화 체크
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      // 일시정지 중에는 건물 비활성화 및 파괴 카운트 증가 안함
      if (isPaused || isGameOver) return;

      const now = Date.now();
      const TIMEOUT = 45000;
      const GRACE_PERIOD = 15000;

      setBuildings(prev => {
        const activeIds = new Set<string>();
        vehiclesRef.current.forEach(v => {
          activeIds.add(v.fromBuilding);
          if (v.status === 'at-office') {
            activeIds.add(v.toBuilding);
          }
        });

        const mapped = prev.map(b => {
          if (activeIds.has(b.id)) {
            return { ...b, lastActiveTime: now };
          }
          return b;
        });

        const kept = mapped.filter(b => {
          if (activeIds.has(b.id)) return true;
          if (b.createdAt && now - b.createdAt < GRACE_PERIOD) return true;
          if (!b.createdAt) return true;
          
          const lastActive = b.lastActiveTime || now;
          if (now - lastActive > TIMEOUT) {
            return false;
          }
          return true;
        });

        const removed = mapped.filter(b => !kept.includes(b));
        if (removed.length > 0) {
          setTimeout(() => setDestroyedCount(c => c + removed.length), 0);
        }

        return kept;
      });
    }, 1000);
    return () => clearInterval(cleanupInterval);
  }, [isPaused, isGameOver]);

  return {
    score,
    setScore,
    gameTime,
    destroyedCount,
    setDestroyedCount,
    isGameOver,
    isPaused,
    setIsPaused,
    gameSpeed,
    setGameSpeed,
    bridgeCount,
    setBridgeCount,
    highwayCount,
    setHighwayCount,
    trafficLightCount,
    setTrafficLightCount,
    activeTool,
    setActiveTool,
    mapSize,
    riverSegments,
    buildings,
    setBuildings,
    roads,
    setRoads,
    intersections,
    setIntersections,
    vehicles,
    setVehicles,
    vehiclesRef,
    language,
    setLanguage,
    warningMessage,
    showWarning,
    startNewGame,
  };
}
