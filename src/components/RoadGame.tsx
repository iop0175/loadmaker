/**
 * City Road Builder - 도시 도로 건설 게임 (리팩토링 버전)
 * 
 * 게임 규칙:
 * - 마우스 드래그로 도로 건설
 * - Shift + 드래그로 커브 도로 건설
 * - 강 위에는 도로 건설 불가
 * - 기존 도로와 겹치는 도로 건설 불가 (교차점만 허용)
 * - 차량이 집 → 회사 → 집 사이클 완료 시 점수 획득
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { 
  VEHICLE_SIZE,
  MAX_VEHICLES_PER_HOME,
  MAX_VEHICLES_PER_OFFICE,
  ROAD_WIDTH,
  ROAD_OUTLINE_WIDTH,
} from '../constants';
import { 
  distance, 
  shadeColor, 
  doRoadsOverlap,
} from '../utils';
import { useGameState, useVehicleLogic, useRoadDrawing, useCollision } from '../hooks';
import { 
  Header, 
  Toolbar, 
  HUD, 
  GameOverOverlay, 
  RoadPopover,
  BuildingPopover,
  getUpgradeCost,
  WarningMessage,
  Shop,
} from './ui';
import type { Building } from '../types';

// 모바일 감지 함수 - 화면 크기에 따라 초기 줌 설정
const getInitialZoom = (): number => {
  if (typeof window !== 'undefined') {
    const { innerWidth, innerHeight } = window;
    
    // 가로 모드 (높이가 500px 미만) - 매우 작게 시작
    if (innerHeight < 500) {
      return 0.4;
    }
    // 모바일 세로 모드 (너비 768px 미만)
    if (innerWidth < 768) {
      return 0.5;
    }
    // 데스크톱
    return 0.75;
  }
  return 0.75;
};

const RoadGame: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(getInitialZoom); // 모바일: 40%, 데스크톱: 75%
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 }); // 맵 이동 오프셋
  const isPanningRef = useRef(false);
  const [isShopOpen, setIsShopOpen] = useState(false);
  const [selectedBuilding, setSelectedBuilding] = useState<Building | null>(null);
  const [isBuildMode, setIsBuildMode] = useState(false); // 빌드 모드 (도로 건설/아이템 사용)
  const lastPanPosRef = useRef({ x: 0, y: 0 });

  // 게임 상태 훅
  const gameState = useGameState();
  const {
    score,
    setScore,
    gameTime,
    destroyedCount,
    isGameOver,
    isPaused,
    setIsPaused,
    gameSpeed,
    setGameSpeed,
    isNightMode,
    bridgeCount,
    setBridgeCount,
    highwayCount,
    setHighwayCount,
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
  } = gameState;

  // 도로 그리기 훅
  const roadDrawing = useRoadDrawing({
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
    language,
    showWarning,
  });

  const {
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
  } = roadDrawing;

  // 상점 구매 핸들러
  const handleShopBuy = useCallback((item: 'bridge' | 'highway', price: number) => {
    if (score >= price) {
      setScore(prev => prev - price);
      if (item === 'bridge') {
        setBridgeCount(prev => prev + 1);
      } else if (item === 'highway') {
        setHighwayCount(prev => prev + 1);
      }
    }
  }, [score, setScore, setBridgeCount, setHighwayCount]);

  // 빌드 모드 토글 (도로 건설 모드)
  const toggleBuildMode = useCallback(() => {
    setIsBuildMode(prev => {
      const newMode = !prev;
      // 빌드 모드 진입 시 일시정지, 빌드 모드 종료 시 재개
      setIsPaused(newMode);
      // 빌드 모드 종료 시 도구 초기화
      if (!newMode) {
        setActiveTool('normal');
        setSelectedBuilding(null);
        setSelectedRoad(null);
      }
      return newMode;
    });
  }, [setIsPaused, setActiveTool, setSelectedRoad]);

  // 건물에 연결된 도로 개수 계산
  const getConnectedRoadCount = useCallback((buildingId: string): number => {
    const building = buildings.find(b => b.id === buildingId);
    if (!building) return 0;
    
    return roads.filter(road => {
      const startDist = distance(road.start, building.position);
      const endDist = distance(road.end, building.position);
      return startDist < 30 || endDist < 30;
    }).length;
  }, [buildings, roads]);

  // 건물 업그레이드 핸들러
  const handleBuildingUpgrade = useCallback(() => {
    if (!selectedBuilding) return;
    
    const currentLevel = selectedBuilding.upgradeLevel || 1;
    const upgradeCost = getUpgradeCost(currentLevel);
    
    if (score >= upgradeCost) {
      setScore(prev => prev - upgradeCost);
      setBuildings(prev => prev.map(b => 
        b.id === selectedBuilding.id 
          ? { ...b, upgradeLevel: currentLevel + 1 }
          : b
      ));
      // 업그레이드 후 선택된 건물 정보 업데이트
      setSelectedBuilding(prev => prev ? { ...prev, upgradeLevel: currentLevel + 1 } : null);
    }
  }, [selectedBuilding, score, setScore, setBuildings]);

  // 캔버스 마우스 다운 래퍼 (모드에 따른 동작 분기)
  const handleCanvasMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = e.target as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const rawPoint = { 
      x: (e.clientX - rect.left) * scaleX, 
      y: (e.clientY - rect.top) * scaleY 
    };
    
    // 빌드 모드가 아닐 때 (일반 모드) - 건물 클릭만 허용
    if (!isBuildMode) {
      const clickedBuilding = buildings.find(b => distance(rawPoint, b.position) < 30);
      
      if (clickedBuilding) {
        setSelectedBuilding(clickedBuilding);
        setSelectedRoad(null);
      } else {
        setSelectedBuilding(null);
      }
      return; // 일반 모드에서는 도로 그리기 불가
    }
    
    // 빌드 모드 - pan 도구일 때만 건물 클릭 체크
    if (activeTool === 'pan') {
      const clickedBuilding = buildings.find(b => distance(rawPoint, b.position) < 30);
      
      if (clickedBuilding) {
        setSelectedBuilding(clickedBuilding);
        setSelectedRoad(null);
        return;
      }
    }
    
    // 건물 선택 해제
    setSelectedBuilding(null);
    
    // 빌드 모드에서 도로 그리기 핸들러 호출
    handleMouseDown(e);
  }, [isBuildMode, activeTool, buildings, handleMouseDown, setSelectedRoad]);

  // 캔버스 터치 시작 래퍼 (모드에 따른 동작 분기)
  const handleCanvasTouchStart = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length !== 1) return;
    
    const touch = e.touches[0];
    const canvas = e.target as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const rawPoint = { 
      x: (touch.clientX - rect.left) * scaleX, 
      y: (touch.clientY - rect.top) * scaleY 
    };
    
    // 빌드 모드가 아닐 때 (일반 모드) - 건물 클릭만 허용
    if (!isBuildMode) {
      const clickedBuilding = buildings.find(b => distance(rawPoint, b.position) < 30);
      
      if (clickedBuilding) {
        setSelectedBuilding(clickedBuilding);
        setSelectedRoad(null);
      } else {
        setSelectedBuilding(null);
      }
      return; // 일반 모드에서는 도로 그리기 불가
    }
    
    // 빌드 모드 - pan 도구일 때만 건물 클릭 체크
    if (activeTool === 'pan') {
      const clickedBuilding = buildings.find(b => distance(rawPoint, b.position) < 30);
      
      if (clickedBuilding) {
        setSelectedBuilding(clickedBuilding);
        setSelectedRoad(null);
        return;
      }
    }
    
    // 건물 선택 해제
    setSelectedBuilding(null);
    
    // 빌드 모드에서 도로 그리기 핸들러 호출
    handleTouchStart(e);
  }, [isBuildMode, activeTool, buildings, handleTouchStart, setSelectedRoad]);

  // 마우스 휠로 줌 조절 - useEffect로 non-passive 이벤트 등록
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setZoom(prev => Math.max(0.3, Math.min(1.5, prev + delta)));
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleWheel);
    };
  }, []);

  // 패닝 시작 (휠 클릭 또는 pan 도구 선택 시 좌클릭)
  const handleContainerMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    // 중간 버튼 (휠 클릭) 또는 pan 도구 선택 시 좌클릭
    if (e.button === 1 || (e.button === 0 && activeTool === 'pan')) {
      e.preventDefault();
      isPanningRef.current = true;
      lastPanPosRef.current = { x: e.clientX, y: e.clientY };
    }
  }, [activeTool]);

  // 패닝 범위 제한 함수
  const clampPanOffset = useCallback((offset: { x: number; y: number }) => {
    // 맵이 화면보다 클 때만 이동 허용
    const scaledWidth = mapSize.width * zoom;
    const scaledHeight = mapSize.height * zoom;
    
    // 최대 이동 범위 계산 (맵이 컨테이너보다 클 때만)
    const maxX = Math.max(0, (scaledWidth - mapSize.width) / 2);
    const maxY = Math.max(0, (scaledHeight - mapSize.height) / 2);
    
    return {
      x: Math.max(-maxX, Math.min(maxX, offset.x)),
      y: Math.max(-maxY, Math.min(maxY, offset.y)),
    };
  }, [mapSize, zoom]);

  // 패닝 중 이동
  const handleContainerMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!isPanningRef.current) return;
    
    const dx = e.clientX - lastPanPosRef.current.x;
    const dy = e.clientY - lastPanPosRef.current.y;
    
    setPanOffset(prev => clampPanOffset({
      x: prev.x + dx,
      y: prev.y + dy,
    }));
    
    lastPanPosRef.current = { x: e.clientX, y: e.clientY };
  }, [clampPanOffset]);

  // 패닝 종료
  const handleContainerMouseUp = useCallback(() => {
    isPanningRef.current = false;
  }, []);

  // 모바일 터치 패닝 - useEffect로 non-passive 이벤트 등록
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleTouchStart = (e: TouchEvent) => {
      if (activeTool === 'pan' && e.touches.length === 1) {
        e.preventDefault();
        isPanningRef.current = true;
        lastPanPosRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isPanningRef.current || e.touches.length !== 1) return;
      e.preventDefault();
      
      const dx = e.touches[0].clientX - lastPanPosRef.current.x;
      const dy = e.touches[0].clientY - lastPanPosRef.current.y;
      
      setPanOffset(prev => {
        const newOffset = {
          x: prev.x + dx,
          y: prev.y + dy,
        };
        // 패닝 범위 제한
        const scaledWidth = mapSize.width * zoom;
        const scaledHeight = mapSize.height * zoom;
        const maxX = Math.max(0, (scaledWidth - mapSize.width) / 2);
        const maxY = Math.max(0, (scaledHeight - mapSize.height) / 2);
        return {
          x: Math.max(-maxX, Math.min(maxX, newOffset.x)),
          y: Math.max(-maxY, Math.min(maxY, newOffset.y)),
        };
      });
      
      lastPanPosRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    };

    const handleTouchEnd = () => {
      isPanningRef.current = false;
    };

    // passive: false로 이벤트 리스너 등록하여 preventDefault 가능하게
    container.addEventListener('touchstart', handleTouchStart, { passive: false });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd);

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [activeTool, mapSize, zoom]);

  // 패닝 리셋 (zoom이 0.75 이하일 때)
  useEffect(() => {
    if (zoom <= 0.75) {
      setPanOffset({ x: 0, y: 0 });
    }
  }, [zoom]);

  // 차량 로직 훅
  useVehicleLogic({
    buildings,
    roads,
    vehicles,
    setVehicles,
    vehiclesRef,
    intersections,
    setScore,
    gameSpeed,
    isGameOver,
    isPaused,
  });

  // 충돌 검사 훅
  const { 
    doesRoadCrossRiver, 
    doesCurveRoadCrossRiver,
    doesRoadIntersectAnyBuilding,
  } = useCollision(riverSegments, roads, buildings);

  // 캔버스 렌더링
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.save();
    // CSS transform으로 줌 처리하므로 캔버스 스케일은 1로 유지

    // 낮/밤 테마 색상
    const theme = {
      background: isNightMode ? '#1a1a2e' : '#f5f5f4',
      river: isNightMode ? '#1e3a5f' : '#7dd3fc',
      road: isNightMode ? '#4a5568' : '#9ca3af',
      roadStripe: isNightMode ? '#a0aec0' : '#ffffff',
      text: isNightMode ? '#e2e8f0' : '#1f2937',
      building: isNightMode ? 0.7 : 1.0, // 건물 색상 밝기
    };

    // 배경
    ctx.fillStyle = theme.background;
    ctx.fillRect(0, 0, mapSize.width, mapSize.height);

    // 강 렌더링
    if (riverSegments.length > 0) {
      // 강의 방향 감지 (수직 vs 수평)
      const firstSeg = riverSegments[0];
      const lastSeg = riverSegments[riverSegments.length - 1];
      const deltaX = Math.abs(lastSeg.x - firstSeg.x);
      const deltaY = Math.abs(lastSeg.y - firstSeg.y);
      const isVertical = deltaY > deltaX;

      ctx.fillStyle = theme.river;
      ctx.beginPath();
      
      if (isVertical) {
        // 수직 강: 좌우로 폭 적용
        ctx.moveTo(riverSegments[0].x - riverSegments[0].width / 2, riverSegments[0].y);
        for (let i = 1; i < riverSegments.length; i++) {
          ctx.lineTo(riverSegments[i].x - riverSegments[i].width / 2, riverSegments[i].y);
        }
        for (let i = riverSegments.length - 1; i >= 0; i--) {
          ctx.lineTo(riverSegments[i].x + riverSegments[i].width / 2, riverSegments[i].y);
        }
      } else {
        // 수평 강: 위아래로 폭 적용
        ctx.moveTo(riverSegments[0].x, riverSegments[0].y - riverSegments[0].width / 2);
        for (let i = 1; i < riverSegments.length; i++) {
          ctx.lineTo(riverSegments[i].x, riverSegments[i].y - riverSegments[i].width / 2);
        }
        for (let i = riverSegments.length - 1; i >= 0; i--) {
          ctx.lineTo(riverSegments[i].x, riverSegments[i].y + riverSegments[i].width / 2);
        }
      }
      ctx.closePath();
      ctx.fill();

      // 강 테두리
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      if (isVertical) {
        ctx.moveTo(riverSegments[0].x - riverSegments[0].width / 2, riverSegments[0].y);
        for (let i = 1; i < riverSegments.length; i++) {
          ctx.lineTo(riverSegments[i].x - riverSegments[i].width / 2, riverSegments[i].y);
        }
      } else {
        ctx.moveTo(riverSegments[0].x, riverSegments[0].y - riverSegments[0].width / 2);
        for (let i = 1; i < riverSegments.length; i++) {
          ctx.lineTo(riverSegments[i].x, riverSegments[i].y - riverSegments[i].width / 2);
        }
      }
      ctx.stroke();
      ctx.beginPath();
      if (isVertical) {
        ctx.moveTo(riverSegments[0].x + riverSegments[0].width / 2, riverSegments[0].y);
        for (let i = 1; i < riverSegments.length; i++) {
          ctx.lineTo(riverSegments[i].x + riverSegments[i].width / 2, riverSegments[i].y);
        }
      } else {
        ctx.moveTo(riverSegments[0].x, riverSegments[0].y + riverSegments[0].width / 2);
        for (let i = 1; i < riverSegments.length; i++) {
          ctx.lineTo(riverSegments[i].x, riverSegments[i].y + riverSegments[i].width / 2);
        }
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

    // 교차점 외곽선
    intersections.forEach(intersection => {
      ctx.fillStyle = theme.road;
      ctx.beginPath();
      ctx.arc(intersection.point.x, intersection.point.y, 16, 0, Math.PI * 2);
      ctx.fill();
    });

    // 도로 본체
    ctx.lineWidth = ROAD_WIDTH;
    roads.forEach(road => {
      const baseColor = road.isBridge ? '#d4a373' : (road.type === 'highway' ? '#93c5fd' : theme.roadStripe);
      ctx.strokeStyle = baseColor;
      ctx.beginPath();
      ctx.moveTo(road.start.x, road.start.y);
      if (road.controlPoint) {
        ctx.quadraticCurveTo(road.controlPoint.x, road.controlPoint.y, road.end.x, road.end.y);
      } else {
        ctx.lineTo(road.end.x, road.end.y);
      }
      ctx.stroke();
    });

    // 교차점 본체
    intersections.forEach(intersection => {
      ctx.fillStyle = theme.roadStripe;
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

    // 교차점 혼잡도
    const intersectionCounts = new Map<string, number>();
    vehicles.forEach(v => {
      Object.keys(v.intersectionArrivalTimes).forEach(key => {
        intersectionCounts.set(key, (intersectionCounts.get(key) || 0) + 1);
      });
    });

    // 교차점 중앙 표시
    intersections.forEach(intersection => {
      const key = `${intersection.point.x},${intersection.point.y}`;
      const count = intersectionCounts.get(key) || 0;
      const isCongested = count >= 5;

      ctx.fillStyle = isCongested ? '#ef4444' : '#fbbf24';
      ctx.beginPath();
      ctx.arc(intersection.point.x, intersection.point.y, isCongested ? 5 : 4, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.strokeStyle = isCongested ? '#fca5a5' : '#9ca3af';
      ctx.lineWidth = isCongested ? 2 : 1;
      ctx.beginPath();
      ctx.arc(intersection.point.x, intersection.point.y, 12, 0, Math.PI * 2);
      ctx.stroke();

      if (isCongested) {
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 10px system-ui';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('!', intersection.point.x, intersection.point.y);
      }
      
      // 저지선
      roads.forEach(road => {
        const atStart = distance(road.start, intersection.point) < 5;
        const atEnd = distance(road.end, intersection.point) < 5;
        
        if (atStart || atEnd) {
          const roadStart = atStart ? road.start : road.end;
          const roadEnd = atStart ? road.end : road.start;
          const dx = roadEnd.x - roadStart.x;
          const dy = roadEnd.y - roadStart.y;
          const len = Math.sqrt(dx * dx + dy * dy);
          if (len === 0) return;
          
          const nx = dx / len;
          const ny = dy / len;
          
          const stopLineX = intersection.point.x + nx * 20;
          const stopLineY = intersection.point.y + ny * 20;
          
          const perpX = -ny;
          const perpY = nx;
          
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
      ctx.shadowColor = '#06b6d4';
      ctx.strokeStyle = 'rgba(34, 211, 238, 0.6)';
      ctx.lineWidth = ROAD_WIDTH + 8;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(selectedRoad.start.x, selectedRoad.start.y);
      if (selectedRoad.controlPoint) {
        ctx.quadraticCurveTo(selectedRoad.controlPoint.x, selectedRoad.controlPoint.y, selectedRoad.end.x, selectedRoad.end.y);
      } else {
        ctx.lineTo(selectedRoad.end.x, selectedRoad.end.y);
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
      
      // 비용 계산
      const dist = distance(drawStart, currentEnd);
      let cost = Math.ceil(dist);
      let isBridge = false;
      
      if (!isInvalid && crossesRiver) {
        if (activeTool === 'bridge' && bridgeCount > 0) {
          previewColor = 'rgba(210, 180, 140, 0.8)';
          cost = 0;
          isBridge = true;
        } else {
          previewColor = 'rgba(239, 68, 68, 0.6)';
        }
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

      // 비용 표시
      if (dist > 10) {
        const midX = (drawStart.x + currentEnd.x) / 2;
        const midY = (drawStart.y + currentEnd.y) / 2;
        
        // 배경
        const costText = isBridge ? 'FREE' : `${cost}`;
        ctx.font = 'bold 14px system-ui';
        const textWidth = ctx.measureText(costText).width;
        
        ctx.fillStyle = isInvalid ? 'rgba(239, 68, 68, 0.9)' : (score >= cost ? 'rgba(34, 197, 94, 0.9)' : 'rgba(239, 68, 68, 0.9)');
        ctx.beginPath();
        ctx.roundRect(midX - textWidth / 2 - 8, midY - 12, textWidth + 16, 24, 6);
        ctx.fill();
        
        // 텍스트
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(costText, midX, midY);
      }

      if (controlPoint) {
        ctx.fillStyle = 'rgba(66, 133, 244, 0.8)';
        ctx.beginPath();
        ctx.arc(controlPoint.x, controlPoint.y, 6, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 건물 렌더링
    buildings.forEach(building => {
      const isHome = building.id.includes('-home');
      const cx = building.position.x;
      const cy = building.position.y;
      
      const now = Date.now();
      const lastActive = building.lastActiveTime || now;
      const inactiveTime = now - lastActive;
      const timeLeft = Math.max(0, 45000 - inactiveTime);
      
      // 새 건물 하이라이트 효과 (5초간)
      const createdAt = building.createdAt || now;
      const age = now - createdAt;
      const isNewBuilding = age < 5000; // 5초간 하이라이트

      if (isHome) {
        const houseWidth = 36;
        const houseHeight = 30;
        const roofHeight = 15;
        
        // 새 건물 펄스 애니메이션 (건물 모양 하이라이트)
        if (isNewBuilding) {
          const pulse = 1 + Math.sin(age / 150) * 0.1;
          const alpha = 0.6 + Math.sin(age / 200) * 0.4;
          
          ctx.save();
          ctx.strokeStyle = `rgba(34, 197, 94, ${alpha})`; // 초록색
          ctx.lineWidth = 4 * pulse;
          ctx.shadowColor = '#22c55e';
          ctx.shadowBlur = 15 * pulse;
          
          // 집 본체 하이라이트
          ctx.strokeRect(cx - houseWidth/2 - 5, cy - houseHeight/2 - 5, houseWidth + 10, houseHeight + 10);
          
          // 지붕 하이라이트
          ctx.beginPath();
          ctx.moveTo(cx - houseWidth/2 - 10, cy - houseHeight/2 - 5);
          ctx.lineTo(cx, cy - houseHeight/2 - roofHeight - 7);
          ctx.lineTo(cx + houseWidth/2 + 10, cy - houseHeight/2 - 5);
          ctx.closePath();
          ctx.stroke();
          ctx.restore();
        }

        ctx.fillStyle = building.color;
        ctx.fillRect(cx - houseWidth/2, cy - houseHeight/2, houseWidth, houseHeight);
        
        ctx.strokeStyle = shadeColor(building.color, -30);
        ctx.lineWidth = 2;
        ctx.strokeRect(cx - houseWidth/2, cy - houseHeight/2, houseWidth, houseHeight);

        ctx.fillStyle = shadeColor(building.color, -20);
        ctx.beginPath();
        ctx.moveTo(cx - houseWidth/2 - 5, cy - houseHeight/2);
        ctx.lineTo(cx, cy - houseHeight/2 - roofHeight);
        ctx.lineTo(cx + houseWidth/2 + 5, cy - houseHeight/2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        
        // 집 표시 (H = Home)
        ctx.font = 'bold 16px system-ui';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ffffff';
        ctx.fillText('H', cx, cy);
        
        // 상태 표시 (차량 수)
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.font = 'bold 11px system-ui';
        
        const activeCount = vehicles.filter(v => v.fromBuilding === building.id).length;
        const remainingCount = Math.max(0, MAX_VEHICLES_PER_HOME - activeCount);
        
        ctx.fillStyle = theme.text;
        ctx.fillText(`P:${remainingCount}`, cx, cy - houseHeight/2 - roofHeight - 4);
        
        if (timeLeft < 30000) { 
          const ringY = cy - houseHeight/2 - roofHeight - 16;
          const danger = 1.0 - Math.max(0, timeLeft / 30000);
          const radius = 6;
          
          ctx.beginPath();
          ctx.arc(cx, ringY, radius, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
          ctx.lineWidth = 3;
          ctx.stroke();
          
          ctx.beginPath();
          ctx.arc(cx, ringY, radius, -Math.PI/2, -Math.PI/2 + (Math.PI * 2 * danger));
          ctx.strokeStyle = danger > 0.66 ? '#dc2626' : (danger > 0.33 ? '#ea580c' : '#22c55e');
          ctx.lineWidth = 3;
          ctx.stroke();
        }

      } else {
        const buildingWidth = 40;
        const buildingHeight = 50;

        // 새 건물 펄스 애니메이션 (건물 모양 하이라이트)
        if (isNewBuilding) {
          const pulse = 1 + Math.sin(age / 150) * 0.1;
          const alpha = 0.6 + Math.sin(age / 200) * 0.4;
          
          ctx.save();
          ctx.strokeStyle = `rgba(59, 130, 246, ${alpha})`; // 파란색
          ctx.lineWidth = 4 * pulse;
          ctx.shadowColor = '#3b82f6';
          ctx.shadowBlur = 15 * pulse;
          
          // 회사 본체 하이라이트
          ctx.strokeRect(cx - buildingWidth/2 - 5, cy - buildingHeight/2 - 5, buildingWidth + 10, buildingHeight + 10);
          ctx.restore();
        }

        ctx.fillStyle = building.color;
        ctx.fillRect(cx - buildingWidth/2, cy - buildingHeight/2, buildingWidth, buildingHeight);
        
        ctx.strokeStyle = shadeColor(building.color, -30);
        ctx.lineWidth = 2;
        ctx.strokeRect(cx - buildingWidth/2, cy - buildingHeight/2, buildingWidth, buildingHeight);

        // 회사 표시 (W = Work)
        ctx.font = 'bold 16px system-ui';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ffffff';
        ctx.fillText('W', cx, cy - 5);
        
        // 상태 표시
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.font = 'bold 11px system-ui';
        
        const parkedCount = vehicles.filter(v => v.toBuilding === building.id && v.status === 'at-office').length;
        
        ctx.fillStyle = theme.text;
        ctx.fillText(`P ${parkedCount}/${MAX_VEHICLES_PER_OFFICE}`, cx, cy - buildingHeight/2 - 4);

        if (timeLeft < 30000) {
          const ringY = cy - buildingHeight/2 - 16;
          const danger = 1.0 - Math.max(0, timeLeft / 30000);
          const radius = 6;
          
          ctx.beginPath();
          ctx.arc(cx, ringY, radius, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
          ctx.lineWidth = 3;
          ctx.stroke();
          
          ctx.beginPath();
          ctx.arc(cx, ringY, radius, -Math.PI/2, -Math.PI/2 + (Math.PI * 2 * danger));
          ctx.strokeStyle = danger > 0.66 ? '#dc2626' : (danger > 0.33 ? '#ea580c' : '#22c55e');
          ctx.lineWidth = 3;
          ctx.stroke();
        }
      }
    });

    // 선택된 건물 하이라이트 (주황색 건물 모양)
    // 차량 렌더링 이후, 밤 모드 이후에 그려서 가장 위에 표시

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

      if (vehicle.status === 'going-home') {
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 8px system-ui';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('H', vehicle.position.x, vehicle.position.y);
      }
    });

    // 밤 모드일 때 어두운 오버레이 추가
    if (isNightMode) {
      ctx.fillStyle = 'rgba(0, 0, 20, 0.3)';
      ctx.fillRect(0, 0, mapSize.width, mapSize.height);
      
      // 건물에 불빛 효과
      buildings.forEach(building => {
        const cx = building.position.x;
        const cy = building.position.y;
        const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, 30);
        gradient.addColorStop(0, 'rgba(255, 230, 150, 0.3)');
        gradient.addColorStop(1, 'rgba(255, 230, 150, 0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(cx - 30, cy - 30, 60, 60);
      });
    }
    
    // 선택된 건물 하이라이트 (주황색 건물 모양) - 가장 마지막에 그려서 위에 표시
    if (selectedBuilding) {
      const building = buildings.find(b => b.id === selectedBuilding.id);
      if (building) {
        const isHome = building.id.includes('-home');
        const cx = building.position.x;
        const cy = building.position.y;
        
        ctx.strokeStyle = '#f97316'; // 주황색
        ctx.lineWidth = 4;
        ctx.shadowColor = '#f97316';
        ctx.shadowBlur = 15;
        
        if (isHome) {
          const houseWidth = 36;
          const houseHeight = 30;
          const roofHeight = 15;
          
          // 집 본체 하이라이트
          ctx.strokeRect(cx - houseWidth/2 - 4, cy - houseHeight/2 - 4, houseWidth + 8, houseHeight + 8);
          
          // 지붕 하이라이트
          ctx.beginPath();
          ctx.moveTo(cx - houseWidth/2 - 9, cy - houseHeight/2 - 4);
          ctx.lineTo(cx, cy - houseHeight/2 - roofHeight - 6);
          ctx.lineTo(cx + houseWidth/2 + 9, cy - houseHeight/2 - 4);
          ctx.closePath();
          ctx.stroke();
        } else {
          const buildingWidth = 40;
          const buildingHeight = 50;
          
          // 회사 본체 하이라이트
          ctx.strokeRect(cx - buildingWidth/2 - 4, cy - buildingHeight/2 - 4, buildingWidth + 8, buildingHeight + 8);
        }
        
        ctx.shadowBlur = 0;
      }
    }
    
    ctx.restore();

  }, [
    roads, vehicles, isDrawing, drawStart, currentEnd, controlPoint, 
    intersections, riverSegments, buildings, doesRoadCrossRiver, doesCurveRoadCrossRiver,
    doesRoadIntersectAnyBuilding, mapSize, zoom, selectedRoad, bridgeCount, isNightMode, selectedBuilding
  ]);

  return (
    <div className="h-screen h-dvh bg-slate-50 flex flex-col landscape-mode items-center justify-between p-1 sm:p-4 md:p-8 font-sans overflow-hidden pb-safe gap-1 sm:gap-2">
      {/* 가로 모드 사이드바 - 왼쪽 */}
      <div className="hidden landscape-sidebar pl-safe pt-safe">
        {/* 미니 스탯 */}
        <div className="flex flex-col gap-2 safe-top-margin">
          <div className="bg-white rounded-xl px-3 py-2 shadow-md border border-slate-200 text-center min-w-[70px]">
            <span className="text-xs text-emerald-500 font-medium">$</span>
            <div className="text-lg font-bold text-emerald-600">{score}</div>
          </div>
          <div className="bg-white rounded-xl px-3 py-2 shadow-md border border-slate-200 text-center min-w-[70px]">
            <span className="text-xs text-indigo-500 font-medium">T</span>
            <div className="text-lg font-bold text-indigo-600">{Math.floor(gameTime / 60)}:{String(gameTime % 60).padStart(2, '0')}</div>
          </div>
          <div className="bg-white rounded-xl px-3 py-2 shadow-md border border-slate-200 text-center min-w-[70px]">
            <span className="text-xs text-rose-500 font-medium">X</span>
            <div className={`text-lg font-bold ${destroyedCount > 0 ? 'text-rose-500' : 'text-slate-600'}`}>{destroyedCount}/3</div>
          </div>
        </div>
        
        {/* 미니 컨트롤 */}
        <div className="flex flex-col gap-2">
          <button 
            onClick={startNewGame}
            className="px-3 py-3 bg-blue-600 text-white rounded-xl text-sm font-bold shadow-md hover:bg-blue-700 active:scale-95 transition-transform"
          >
            NEW
          </button>
          <button 
            onClick={() => setGameSpeed(prev => prev === 1 ? 2 : 1)}
            className={`px-3 py-3 rounded-xl text-sm font-bold shadow-md transition-transform active:scale-95 ${gameSpeed === 2 ? 'bg-emerald-500 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}
          >
            {gameSpeed}x
          </button>
          <button 
            onClick={() => setIsShopOpen(true)}
            className="px-3 py-3 bg-amber-400 text-amber-900 rounded-xl text-sm font-bold shadow-md hover:bg-amber-500 active:scale-95 transition-transform"
          >
            Shop
          </button>
        </div>
      </div>

      {/* 세로 모드 헤더 */}
      <div className="landscape-hide w-full flex justify-center px-2 shrink-0">
        <Header
          score={score}
          gameTime={gameTime}
          destroyedCount={destroyedCount}
          language={language}
          onLanguageChange={setLanguage}
        />
      </div>

      {/* Toolbar - 세로 모드만 */}
      <div className="landscape-hide w-full flex justify-center px-2 shrink-0">
        <Toolbar
          isBuildMode={isBuildMode}
          gameSpeed={gameSpeed}
          isOrthoMode={isOrthoMode}
          isCurveMode={isCurveMode}
          language={language}
          onNewGame={startNewGame}
          onToggleBuildMode={toggleBuildMode}
          onToggleSpeed={() => setGameSpeed(prev => prev === 1 ? 2 : 1)}
          onOpenShop={() => setIsShopOpen(true)}
        />
      </div>

      {/* 메인 게임 영역 */}
      <div 
        ref={containerRef}
        className="landscape-main flex-1 flex items-center justify-center min-h-0 overflow-hidden shrink"
        onMouseDown={handleContainerMouseDown}
        onMouseMove={handleContainerMouseMove}
        onMouseUp={handleContainerMouseUp}
        onMouseLeave={handleContainerMouseUp}
      >
        {/* 캔버스 컨테이너 - 단순화된 줌 */}
        <div 
          className="rounded-xl sm:rounded-2xl overflow-hidden border border-white/50 ring-1 ring-slate-200/50 landscape-canvas relative bg-slate-100"
          style={{
            width: mapSize.width * zoom,
            height: mapSize.height * zoom,
            maxWidth: '100%',
            maxHeight: '100%',
            aspectRatio: `${mapSize.width} / ${mapSize.height}`,
            cursor: activeTool === 'pan' ? 'grab' : 'default',
          }}
        >
          <canvas
            ref={canvasRef}
            width={mapSize.width}
            height={mapSize.height}
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleCanvasTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            className="cursor-crosshair bg-white touch-none"
            style={{ 
              width: '100%', 
              height: '100%',
              transform: `translate(${panOffset.x}px, ${panOffset.y}px)`,
            }}
          />
          
          {/* 경고 메시지 */}
          <WarningMessage message={warningMessage} />
          
          {/* 도로 선택 팝오버 */}
          {selectedRoad && (
            <RoadPopover
              road={selectedRoad}
              mapWidth={mapSize.width}
              mapHeight={mapSize.height}
              onDelete={() => deleteRoad(selectedRoad)}
              onClose={() => setSelectedRoad(null)}
            />
          )}
          
          {/* 건물 선택 팝오버 */}
          {selectedBuilding && (
            <BuildingPopover
              building={selectedBuilding}
              mapWidth={mapSize.width}
              mapHeight={mapSize.height}
              language={language}
              score={score}
              connectedRoadCount={getConnectedRoadCount(selectedBuilding.id)}
              onUpgrade={handleBuildingUpgrade}
              onClose={() => setSelectedBuilding(null)}
            />
          )}
          
          {/* 게임 오버 오버레이 */}
          {isGameOver && (
            <GameOverOverlay
              score={score}
              gameTime={gameTime}
              destroyedCount={destroyedCount}
              language={language}
              onPlayAgain={startNewGame}
            />
          )}
        </div>
      </div>

      {/* 상점 모달 */}
      <Shop
        isOpen={isShopOpen}
        onClose={() => setIsShopOpen(false)}
        score={score}
        bridgeCount={bridgeCount}
        highwayCount={highwayCount}
        language={language}
        onBuy={handleShopBuy}
      />

      {/* 교차점 표시 - 세로 모드에서만 */}
      {intersections.length > 0 && (
        <div className="hidden sm:block landscape-hide mt-4 sm:mt-6 text-sm">
          <span className="inline-flex items-center gap-2 bg-white/60 backdrop-blur-md border border-white/50 rounded-full px-4 py-1.5 text-slate-600 shadow-sm ring-1 ring-slate-200/50">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
            </span>
            <span className="font-bold">{intersections.length}</span> Active Intersections
          </span>
        </div>
      )}

      {/* HUD - 세로 모드 */}
      <div className="landscape-hide w-full flex justify-center shrink-0 mb-[env(safe-area-inset-bottom,0)] pb-2 sm:pb-0">
        <HUD
          activeTool={activeTool}
          bridgeCount={bridgeCount}
          highwayCount={highwayCount}
          language={language}
          isBuildMode={isBuildMode}
          onToolChange={setActiveTool}
          zoom={zoom}
          onZoomIn={() => setZoom(prev => Math.min(1.5, prev + 0.25))}
          onZoomOut={() => setZoom(prev => Math.max(0.3, prev - 0.25))}
        />
      </div>

      {/* HUD - 가로 모드 (오른쪽 사이드바) */}
      <div className="hidden landscape-sidebar pr-safe">
        <div className="flex flex-col gap-2">
          {/* 빌드 모드 토글 버튼 */}
          <button
            onClick={toggleBuildMode}
            className={`w-full py-3 px-2 rounded-xl flex flex-col items-center justify-center text-xs font-bold shadow-md transition-transform active:scale-95 ${
              isBuildMode 
                ? 'bg-orange-500 text-white animate-pulse' 
                : 'bg-emerald-500 text-white'
            }`}
          >
            {isBuildMode ? (
              <>
                <svg className="w-6 h-6 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /></svg>
                <span>시작</span>
              </>
            ) : (
              <>
                <svg className="w-6 h-6 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                <span>건설</span>
              </>
            )}
          </button>
          
          {/* 빌드 모드일 때만 도구 버튼 표시 */}
          {isBuildMode && (
            <>
              <div className="h-px w-12 bg-slate-200 self-center my-1" />
              
              {/* Pan Tool */}
              <button
                onClick={() => setActiveTool('pan')}
                className={`w-full py-2 px-2 rounded-xl flex flex-col items-center justify-center text-xs font-bold shadow-md transition-transform active:scale-95 ${
                  activeTool === 'pan' ? 'bg-slate-600 text-white' : 'bg-white text-slate-500 border border-slate-200'
                }`}
              >
                <svg className="w-6 h-6 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11" /></svg>
                <span>이동</span>
              </button>
              {/* 도구 버튼들 */}
              <button
                onClick={() => setActiveTool('normal')}
                className={`w-full py-2 px-2 rounded-xl flex flex-col items-center justify-center text-xs font-bold shadow-md transition-transform active:scale-95 ${
                  activeTool === 'normal' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-500 border border-slate-200'
                }`}
              >
                <svg className="w-6 h-6 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2z" /></svg>
                <span>도로</span>
              </button>
              <button
                onClick={() => setActiveTool('bridge')}
                className={`w-full py-2 px-2 rounded-xl flex flex-col items-center justify-center text-xs font-bold shadow-md transition-transform active:scale-95 relative ${
                  activeTool === 'bridge' ? 'bg-amber-600 text-white' : 'bg-white text-slate-500 border border-slate-200'
                }`}
              >
                <svg className="w-6 h-6 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5" /></svg>
                <span>다리</span>
                <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">{bridgeCount}</span>
              </button>
              <button
                onClick={() => setActiveTool('highway')}
                className={`w-full py-2 px-2 rounded-xl flex flex-col items-center justify-center text-xs font-bold shadow-md transition-transform active:scale-95 relative ${
                  activeTool === 'highway' ? 'bg-sky-500 text-white' : 'bg-white text-slate-500 border border-slate-200'
                }`}
              >
                <svg className="w-6 h-6 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                <span>고속</span>
                <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">{highwayCount}</span>
              </button>
            </>
          )}

          {/* 구분선 */}
          <div className="h-px w-12 bg-slate-200 self-center my-1" />

          {/* 줌 컨트롤 */}
          <button
            onClick={() => setZoom(prev => Math.min(1.5, prev + 0.25))}
            disabled={zoom >= 1.5}
            className={`w-full py-3 rounded-xl flex items-center justify-center text-xl font-bold shadow-md transition-transform active:scale-95 ${
              zoom >= 1.5 ? 'bg-slate-100 text-slate-300 cursor-not-allowed' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            +
          </button>
          <div className="w-full py-2 rounded-xl bg-slate-100 flex items-center justify-center text-sm font-bold text-slate-700">
            {Math.round(zoom * 100)}%
          </div>
          <button
            onClick={() => setZoom(prev => Math.max(0.3, prev - 0.25))}
            disabled={zoom <= 0.3}
            className={`w-full py-3 rounded-xl flex items-center justify-center text-xl font-bold shadow-md transition-transform active:scale-95 ${
              zoom <= 0.3 ? 'bg-slate-100 text-slate-300 cursor-not-allowed' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            -
          </button>
        </div>
      </div>
    </div>
  );
};

export default RoadGame;
