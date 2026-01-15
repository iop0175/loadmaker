/**
 * WarningMessage Component
 * 경고 메시지 토스트 표시
 */

import React from 'react';

interface WarningMessageProps {
  message: string;
}

export const WarningMessage: React.FC<WarningMessageProps> = ({ message }) => {
  if (!message) return null;
  
  return (
    <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50 animate-pulse">
      <div className="bg-amber-500 text-white px-6 py-3 rounded-xl shadow-lg font-bold text-sm flex items-center gap-2">
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        {message}
      </div>
    </div>
  );
};
