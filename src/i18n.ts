/**
 * 다국어 지원 (영어/한국어)
 */

export type Language = 'en' | 'ko';

interface Translations {
  // 헤더
  title: string;
  subtitle: string;
  
  // 스탯
  money: string;
  time: string;
  cars: string;
  destroyed: string;
  
  // 도구
  road: string;
  bridge: string;
  highway: string;
  pan: string;
  straight: string;
  curve: string;
  
  // 버튼
  newGame: string;
  pause: string;
  resume: string;
  speed: string;
  
  // 경고 메시지
  highwayCannotCrossRiver: string;
  noHighwayItems: string;
  noBridgeItems: string;
  needBridgeMode: string;
  notEnoughPoints: string;
  featureComingSoon: string;
  
  // 게임 오버
  gameOver: string;
  finalScore: string;
  survivalTime: string;
  buildingsDestroyed: string;
  playAgain: string;
  
  // 상점
  shop: string;
  buy: string;
  notEnoughMoney: string;
}

const translations: Record<Language, Translations> = {
  en: {
    // 헤더
    title: 'LoadMaker',
    subtitle: 'Survival Strategy Builder',
    
    // 스탯
    money: 'MONEY',
    time: 'TIME',
    cars: 'CARS',
    destroyed: 'DESTROYED',
    
    // 도구
    road: 'Road',
    bridge: 'Bridge',
    highway: 'Highway',
    pan: 'Move',
    straight: 'Straight (F)',
    curve: 'Curve (Shift)',
    
    // 버튼
    newGame: 'NEW GAME',
    pause: 'Pause',
    resume: 'Resume',
    speed: 'Speed',
    
    // 경고 메시지
    highwayCannotCrossRiver: 'Highway cannot cross river.',
    noHighwayItems: 'No highway items!',
    noBridgeItems: 'No bridge items!',
    needBridgeMode: 'Use bridge mode to cross river.',
    notEnoughPoints: 'Not enough points!',
    featureComingSoon: 'Feature coming soon',
    
    // 게임 오버
    gameOver: 'GAME OVER',
    finalScore: 'Final Score',
    survivalTime: 'Survival Time',
    buildingsDestroyed: 'Buildings Destroyed',
    playAgain: 'PLAY AGAIN',
    
    // 상점
    shop: 'Shop',
    buy: 'Buy',
    notEnoughMoney: 'Not enough money!',
  },
  ko: {
    // 헤더
    title: 'LoadMaker',
    subtitle: '도시 도로 생존 전략',
    
    // 스탯
    money: '자금',
    time: '시간',
    cars: '차량',
    destroyed: '파괴',
    
    // 도구
    road: '도로',
    bridge: '다리',
    highway: '고속도로',
    pan: '이동',
    straight: '직선 (F)',
    curve: '곡선 (Shift)',
    
    // 버튼
    newGame: '새 게임',
    pause: '일시정지',
    resume: '재개',
    speed: '속도',
    
    // 경고 메시지
    highwayCannotCrossRiver: '고속도로는 강을 건널 수 없습니다.',
    noHighwayItems: '고속도로 아이템이 부족합니다!',
    noBridgeItems: '다리 건설권이 부족합니다!',
    needBridgeMode: '강을 건너려면 다리 모드를 선택하세요.',
    notEnoughPoints: '포인트가 부족합니다!',
    featureComingSoon: '준비중인 기능입니다',
    
    // 게임 오버
    gameOver: '게임 오버',
    finalScore: '최종 점수',
    survivalTime: '생존 시간',
    buildingsDestroyed: '파괴된 건물',
    playAgain: '다시 하기',
    
    // 상점
    shop: '상점',
    buy: '구매',
    notEnoughMoney: '자금이 부족합니다!',
  }
};

export function getTranslations(lang: Language): Translations {
  return translations[lang];
}

export function detectLanguage(): Language {
  const browserLang = navigator.language.toLowerCase();
  if (browserLang.startsWith('ko')) {
    return 'ko';
  }
  return 'en';
}
