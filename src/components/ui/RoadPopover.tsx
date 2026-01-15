/**
 * RoadPopover Component
 * 도로 선택 시 표시되는 팝오버 (편집/삭제)
 */

import React from 'react';
import type { Road } from '../../types';
import type { Language } from '../../i18n';
import { getTranslations } from '../../i18n';

interface RoadPopoverProps {
  road: Road;
  mapWidth: number;
  mapHeight: number;
  language: Language;
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
}

export const RoadPopover: React.FC<RoadPopoverProps> = ({
  road,
  mapWidth,
  mapHeight,
  language,
  onEdit,
  onDelete,
  onClose,
}) => {
  const t = getTranslations(language);
  
  // 팝오버 위치 계산 (백분율로 변환)
  let cx, cy;
  if (road.controlPoint) {
    const _t = 0.5;
    cx = (1 - _t) * (1 - _t) * road.start.x + 2 * (1 - _t) * _t * road.controlPoint.x + _t * _t * road.end.x;
    cy = (1 - _t) * (1 - _t) * road.start.y + 2 * (1 - _t) * _t * road.controlPoint.y + _t * _t * road.end.y;
  } else {
    cx = (road.start.x + road.end.x) / 2;
    cy = (road.start.y + road.end.y) / 2;
  }
  
  // 백분율로 변환 (캔버스 스케일링에 관계없이 정확한 위치)
  const leftPercent = (cx / mapWidth) * 100;
  const topPercent = (cy / mapHeight) * 100;
  
  return (
    <div 
      className="absolute z-10 p-2 pointer-events-none" 
      style={{ left: `${leftPercent}%`, top: `${topPercent}%`, transform: 'translate(-50%, -100%)' }}
    >
      <div className="flex bg-white rounded-lg shadow-xl border border-slate-200 overflow-hidden divide-x divide-slate-100 pointer-events-auto">
        <button 
          onClick={(e) => { 
            e.stopPropagation(); 
            onEdit();
          }}
          className="px-3 py-2 text-slate-400 hover:bg-slate-50 active:bg-slate-100 transition-colors"
          title={t.featureComingSoon}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        </button>
        <button 
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
            onClose();
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
};
