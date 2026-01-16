/**
 * BuildingPopover Component
 * 건물 선택 시 표시되는 팝오버 (업그레이드)
 */

import React from 'react';
import type { Building } from '../../types';
import type { Language } from '../../i18n';
import { getTranslations } from '../../i18n';

interface BuildingPopoverProps {
  building: Building;
  mapWidth: number;
  mapHeight: number;
  language: Language;
  score: number;
  connectedRoadCount: number;
  onUpgrade: () => void;
  onClose: () => void;
}

// 업그레이드 비용 계산 (레벨당 300씩 증가)
const getUpgradeCost = (currentLevel: number): number => {
  return 300 * currentLevel;
};

export const BuildingPopover: React.FC<BuildingPopoverProps> = ({
  building,
  mapWidth,
  mapHeight,
  language,
  score,
  connectedRoadCount,
  onUpgrade,
  onClose,
}) => {
  const t = getTranslations(language);
  
  const currentLevel = building.upgradeLevel || 1;
  const maxRoads = currentLevel; // 레벨 = 연결 가능한 도로 수
  const upgradeCost = getUpgradeCost(currentLevel);
  const canAfford = score >= upgradeCost;
  const isMaxLevel = currentLevel >= 3; // 최대 레벨 3
  
  // 팝오버 위치 계산 (백분율로 변환)
  const leftPercent = (building.position.x / mapWidth) * 100;
  const topPercent = (building.position.y / mapHeight) * 100;
  
  // 건물 타입 (home 또는 office)
  const isHome = building.id.includes('home');
  const buildingType = isHome ? t.home : t.office;
  
  return (
    <div 
      className="absolute z-10 p-2 pointer-events-none" 
      style={{ left: `${leftPercent}%`, top: `${topPercent}%`, transform: 'translate(-50%, -120%)' }}
    >
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden pointer-events-auto min-w-[140px]">
        {/* 헤더 */}
        <div className="px-3 py-2 bg-gradient-to-r from-slate-100 to-slate-50 border-b border-slate-100">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <span 
                className="w-3 h-3 rounded-sm" 
                style={{ backgroundColor: building.color }}
              />
              <span className="text-xs font-bold text-slate-700">{buildingType}</span>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="text-slate-400 hover:text-slate-600"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        
        {/* 현재 상태 */}
        <div className="px-3 py-2 text-xs space-y-1">
          <div className="flex justify-between items-center text-slate-500">
            <span>Lv.{currentLevel}</span>
            <span className="text-slate-400">{connectedRoadCount}/{maxRoads} {t.roads}</span>
          </div>
        </div>
        
        {/* 업그레이드 버튼 */}
        {!isMaxLevel ? (
          <button 
            onClick={(e) => { 
              e.stopPropagation(); 
              if (canAfford) {
                onUpgrade();
              }
            }}
            disabled={!canAfford}
            className={`w-full px-3 py-2 text-xs font-bold transition-colors flex items-center justify-center gap-1.5 ${
              canAfford 
                ? 'bg-emerald-500 hover:bg-emerald-600 text-white' 
                : 'bg-slate-100 text-slate-400 cursor-not-allowed'
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
            </svg>
            <span>{t.upgrade}</span>
            <span className="text-[10px] opacity-80">${upgradeCost}</span>
          </button>
        ) : (
          <div className="px-3 py-2 text-xs text-center text-amber-600 bg-amber-50 font-medium">
            {t.maxLevel}
          </div>
        )}
      </div>
      <div className="w-2.5 h-2.5 bg-white border-r border-b border-slate-200 transform rotate-45 mx-auto -mt-1.5 shadow-sm"></div>
    </div>
  );
};

export { getUpgradeCost };
