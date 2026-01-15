/**
 * HUD Component
 * 도구 선택 바 (도로, 다리, 고속도로, 신호등)
 */

import React from 'react';
import type { Language } from '../../i18n';
import { getTranslations } from '../../i18n';

export type ActiveTool = 'normal' | 'bridge' | 'highway' | 'traffic-light';

interface HUDProps {
  activeTool: ActiveTool;
  bridgeCount: number;
  highwayCount: number;
  trafficLightCount: number;
  language: Language;
  onToolChange: (tool: ActiveTool) => void;
}

export const HUD: React.FC<HUDProps> = ({
  activeTool,
  bridgeCount,
  highwayCount,
  trafficLightCount,
  language,
  onToolChange,
}) => {
  const t = getTranslations(language);
  
  return (
    <div className="mt-4 z-40">
      <div className="flex bg-white/80 backdrop-blur-xl border border-white/50 ring-1 ring-slate-200/50 rounded-3xl shadow-2xl p-2.5 gap-3">
        {/* Normal Tool */}
        <button
          onClick={() => onToolChange('normal')}
          className={`w-16 h-16 rounded-2xl flex flex-col items-center justify-center transition-all duration-300 ${
            activeTool === 'normal' 
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 scale-110' 
              : 'bg-white text-slate-400 hover:bg-slate-50 hover:text-slate-600'
          }`}
        >
          <svg className="w-7 h-7 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
          </svg>
          <span className="text-[10px] font-extrabold tracking-wide uppercase">{t.road}</span>
        </button>

        {/* Bridge Tool */}
        <button
          onClick={() => onToolChange('bridge')}
          className={`w-16 h-16 rounded-2xl flex flex-col items-center justify-center transition-all duration-300 relative ${
            activeTool === 'bridge' 
              ? 'bg-amber-600 text-white shadow-lg shadow-amber-200 scale-110' 
              : 'bg-white text-slate-400 hover:bg-slate-50 hover:text-slate-600'
          }`}
        >
          <svg className="w-7 h-7 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5" />
          </svg>
          <span className="text-[10px] font-extrabold tracking-wide uppercase">{t.bridge}</span>
          {/* Count Badge */}
          <div className={`absolute -top-1.5 -right-1.5 min-w-[22px] h-[22px] px-1.5 rounded-full flex items-center justify-center text-[11px] font-black border-[3px] border-white shadow-sm ${
            bridgeCount > 0 ? 'bg-blue-500 text-white' : 'bg-slate-200 text-slate-400'
          }`}>
            {bridgeCount}
          </div>
        </button>

        {/* Highway Tool */}
        <button
          onClick={() => onToolChange('highway')}
          className={`w-16 h-16 rounded-2xl flex flex-col items-center justify-center transition-all duration-300 relative ${
            activeTool === 'highway' 
              ? 'bg-sky-500 text-white shadow-lg shadow-sky-200 scale-110' 
              : 'bg-white text-slate-400 hover:bg-slate-50 hover:text-slate-600'
          }`}
        >
          <svg className="w-7 h-7 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <span className="text-[10px] font-extrabold tracking-wide uppercase">{t.highway}</span>
          {/* Count Badge */}
          <div className={`absolute -top-1.5 -right-1.5 min-w-[22px] h-[22px] px-1.5 rounded-full flex items-center justify-center text-[11px] font-black border-[3px] border-white shadow-sm ${
            highwayCount > 0 ? 'bg-blue-500 text-white' : 'bg-slate-200 text-slate-400'
          }`}>
            {highwayCount}
          </div>
        </button>

        {/* Traffic Light Tool */}
        <button
          onClick={() => onToolChange('traffic-light')}
          className={`w-16 h-16 rounded-2xl flex flex-col items-center justify-center transition-all duration-300 relative ${
            activeTool === 'traffic-light' 
              ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-200 scale-110' 
              : 'bg-white text-slate-400 hover:bg-slate-50 hover:text-slate-600'
          }`}
        >
          <svg className="w-7 h-7 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          <span className="text-[10px] font-extrabold tracking-wide uppercase">{t.signal}</span>
          {/* Count Badge */}
          <div className={`absolute -top-1.5 -right-1.5 min-w-[22px] h-[22px] px-1.5 rounded-full flex items-center justify-center text-[11px] font-black border-[3px] border-white shadow-sm ${
            trafficLightCount > 0 ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-400'
          }`}>
            {trafficLightCount}
          </div>
        </button>
      </div>
    </div>
  );
};
