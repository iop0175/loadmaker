/**
 * HUD Component
 * 도구 선택 바 (도로, 다리, 고속도로, 신호등)
 */

import React from 'react';
import type { Language } from '../../i18n';
import { getTranslations } from '../../i18n';

export type ActiveTool = 'normal' | 'bridge' | 'highway' | 'traffic-light' | 'pan';

interface HUDProps {
  activeTool: ActiveTool;
  bridgeCount: number;
  highwayCount: number;
  trafficLightCount: number;
  language: Language;
  onToolChange: (tool: ActiveTool) => void;
  // 줌 컨트롤
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
}

export const HUD: React.FC<HUDProps> = ({
  activeTool,
  bridgeCount,
  highwayCount,
  trafficLightCount,
  language,
  onToolChange,
  zoom,
  onZoomIn,
  onZoomOut,
}) => {
  const t = getTranslations(language);
  
  return (
    <div className="mt-2 sm:mt-4 z-40 w-full flex justify-center">
      <div className="flex bg-white/90 backdrop-blur-xl border-2 border-slate-200 ring-2 ring-slate-100 rounded-2xl sm:rounded-3xl shadow-2xl p-2 sm:p-3 gap-2 sm:gap-4">
        {/* Pan Tool */}
        <button
          onClick={() => onToolChange('pan')}
          className={`w-14 h-14 sm:w-20 sm:h-20 rounded-xl sm:rounded-2xl flex flex-col items-center justify-center transition-all duration-300 border-2 ${
            activeTool === 'pan' 
              ? 'bg-slate-600 text-white shadow-lg shadow-slate-300 scale-110 border-slate-400' 
              : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50 hover:text-slate-700 hover:border-slate-300'
          }`}
        >
          <svg className="w-6 h-6 sm:w-8 sm:h-8 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11" />
          </svg>
          <span className="text-[9px] sm:text-xs font-extrabold tracking-wide uppercase">{t.pan}</span>
        </button>

        {/* Normal Tool */}
        <button
          onClick={() => onToolChange('normal')}
          className={`w-14 h-14 sm:w-20 sm:h-20 rounded-xl sm:rounded-2xl flex flex-col items-center justify-center transition-all duration-300 border-2 ${
            activeTool === 'normal' 
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-300 scale-110 border-indigo-400' 
              : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50 hover:text-slate-700 hover:border-slate-300'
          }`}
        >
          <svg className="w-6 h-6 sm:w-8 sm:h-8 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
          </svg>
          <span className="text-[9px] sm:text-xs font-extrabold tracking-wide uppercase">{t.road}</span>
        </button>

        {/* Bridge Tool */}
        <button
          onClick={() => onToolChange('bridge')}
          className={`w-14 h-14 sm:w-20 sm:h-20 rounded-xl sm:rounded-2xl flex flex-col items-center justify-center transition-all duration-300 relative border-2 ${
            activeTool === 'bridge' 
              ? 'bg-amber-500 text-white shadow-lg shadow-amber-300 scale-110 border-amber-400' 
              : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50 hover:text-slate-700 hover:border-slate-300'
          }`}
        >
          <svg className="w-6 h-6 sm:w-8 sm:h-8 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5" />
          </svg>
          <span className="text-[9px] sm:text-xs font-extrabold tracking-wide uppercase">{t.bridge}</span>
          {/* Count Badge */}
          <div className={`absolute -top-2 -right-2 min-w-[22px] sm:min-w-[26px] h-[22px] sm:h-[26px] px-1.5 rounded-full flex items-center justify-center text-[10px] sm:text-xs font-black border-[3px] border-white shadow-md ${
            bridgeCount > 0 ? 'bg-blue-500 text-white' : 'bg-slate-300 text-slate-500'
          }`}>
            {bridgeCount}
          </div>
        </button>

        {/* Highway Tool */}
        <button
          onClick={() => onToolChange('highway')}
          className={`w-14 h-14 sm:w-20 sm:h-20 rounded-xl sm:rounded-2xl flex flex-col items-center justify-center transition-all duration-300 relative border-2 ${
            activeTool === 'highway' 
              ? 'bg-sky-500 text-white shadow-lg shadow-sky-300 scale-110 border-sky-400' 
              : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50 hover:text-slate-700 hover:border-slate-300'
          }`}
        >
          <svg className="w-6 h-6 sm:w-8 sm:h-8 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <span className="text-[9px] sm:text-xs font-extrabold tracking-wide uppercase">{t.highway}</span>
          {/* Count Badge */}
          <div className={`absolute -top-2 -right-2 min-w-[22px] sm:min-w-[26px] h-[22px] sm:h-[26px] px-1.5 rounded-full flex items-center justify-center text-[10px] sm:text-xs font-black border-[3px] border-white shadow-md ${
            highwayCount > 0 ? 'bg-blue-500 text-white' : 'bg-slate-300 text-slate-500'
          }`}>
            {highwayCount}
          </div>
        </button>

        {/* Traffic Light Tool */}
        <button
          onClick={() => onToolChange('traffic-light')}
          className={`w-14 h-14 sm:w-20 sm:h-20 rounded-xl sm:rounded-2xl flex flex-col items-center justify-center transition-all duration-300 relative border-2 ${
            activeTool === 'traffic-light' 
              ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-300 scale-110 border-emerald-400' 
              : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50 hover:text-slate-700 hover:border-slate-300'
          }`}
        >
          <svg className="w-6 h-6 sm:w-8 sm:h-8 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          <span className="text-[9px] sm:text-xs font-extrabold tracking-wide uppercase">{t.signal}</span>
          {/* Count Badge */}
          <div className={`absolute -top-2 -right-2 min-w-[22px] sm:min-w-[26px] h-[22px] sm:h-[26px] px-1.5 rounded-full flex items-center justify-center text-[10px] sm:text-xs font-black border-[3px] border-white shadow-md ${
            trafficLightCount > 0 ? 'bg-emerald-500 text-white' : 'bg-slate-300 text-slate-500'
          }`}>
            {trafficLightCount}
          </div>
        </button>

        {/* 구분선 */}
        <div className="w-px h-10 sm:h-14 bg-slate-200 self-center mx-1 sm:mx-2" />

        {/* 줌 컨트롤 */}
        <div className="flex items-center gap-1 sm:gap-2">
          <button
            onClick={onZoomOut}
            disabled={zoom <= 0.3}
            className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center transition-all duration-300 border-2 ${
              zoom <= 0.3
                ? 'bg-slate-100 text-slate-300 border-slate-200 cursor-not-allowed'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-700 hover:border-slate-300 active:bg-slate-100'
            }`}
            title="Zoom Out"
          >
            <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
            </svg>
          </button>
          
          <div className="min-w-[48px] sm:min-w-[56px] h-10 sm:h-12 px-2 rounded-xl bg-slate-100 border-2 border-slate-200 flex items-center justify-center">
            <span className="text-xs sm:text-sm font-bold text-slate-700">{Math.round(zoom * 100)}%</span>
          </div>
          
          <button
            onClick={onZoomIn}
            disabled={zoom >= 1.5}
            className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center transition-all duration-300 border-2 ${
              zoom >= 1.5
                ? 'bg-slate-100 text-slate-300 border-slate-200 cursor-not-allowed'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-700 hover:border-slate-300 active:bg-slate-100'
            }`}
            title="Zoom In"
          >
            <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};
