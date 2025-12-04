import { Play, Pause, RotateCcw, Target, Activity, TrendingUp, WifiOff, Loader2 } from 'lucide-react';

interface WebpageAnalysis {
  is_focused: boolean;
  score: number;
  topic: string;
}

interface TimerPageProps {
  goal: string;
  setGoal: (goal: string) => void;
  savedGoal: string;
  setSavedGoal: (goal: string) => void;
  minutes: number;
  setMinutes: (minutes: number) => void;
  seconds: number;
  setSeconds: (seconds: number) => void;
  timeLeft: number;
  setTimeLeft: (timeLeft: number) => void;
  isRunning: boolean;
  setIsRunning: (isRunning: boolean) => void;
  isStarted: boolean;
  setIsStarted: (isStarted: boolean) => void;
  analysis: WebpageAnalysis | null;
  isStartingSession: boolean;
  setIsStartingSession: (isStartingSession: boolean) => void;
  sseStatus: 'idle' | 'connecting' | 'connected' | 'failed';
  handleSessionReset: () => void;
}

export function TimerPage({
  goal,
  setGoal,
  savedGoal,
  setSavedGoal,
  minutes,
  setMinutes,
  seconds,
  setSeconds,
  timeLeft,
  setTimeLeft,
  isRunning,
  setIsRunning,
  isStarted,
  setIsStarted,
  analysis,
  isStartingSession,
  setIsStartingSession,
  sseStatus,
  handleSessionReset,
}: TimerPageProps) {
  const totalTime = minutes * 60 + seconds;

  const handleStart = async () => {
    if (!isStarted) {
      if (!goal.trim()) {
        alert('집중 목표를 입력해주세요.');
        return;
      }
      
      // 세션 시작 API 호출
      setIsStartingSession(true);
      
      try {
        const response = await fetch('/api/new_session', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            duration: totalTime,
            goal: goal,
          }),
        });

        if (!response.ok) {
          throw new Error('세션 시작 실패');
        }

        const data = await response.json();
        console.log('세션 시작 응답:', data);

        // 성공 후 타이머 시작
        setTimeLeft(totalTime);
        setIsStarted(true);
        setSavedGoal(goal);
        setIsRunning(true);

        // 알림 권한 요청
        if ('Notification' in window && Notification.permission === 'default') {
          Notification.requestPermission();
        }
      } catch (error) {
        console.error('세션 시작 오류:', error);
        alert('세션을 시작할 수 없습니다. 서버 연결을 확인해주세요.');
      } finally {
        setIsStartingSession(false);
      }
    } else {
      // 이미 시작된 세션을 재개
      setIsRunning(true);

      // 알림 권한 요청
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
      }
    }
  };

  const handlePause = () => {
    setIsRunning(false);
  };

  const handleReset = () => {
    handleSessionReset();
  };

  const progress = isStarted && totalTime > 0 ? ((totalTime - timeLeft) / totalTime) * 100 : 0;
  const displayMinutes = isStarted ? Math.floor(timeLeft / 60) : minutes;
  const displaySeconds = isStarted ? timeLeft % 60 : seconds;

  return (
    <div className="flex-1 p-8 overflow-auto">
      {/* 로딩 스크린 오버레이 */}
      {isStartingSession && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4">
            <div className="text-center">
              {/* 로딩 스피너 */}
              <div className="w-16 h-16 mx-auto mb-6">
                <svg className="animate-spin" viewBox="0 0 50 50">
                  <circle
                    cx="25"
                    cy="25"
                    r="20"
                    fill="none"
                    stroke="url(#spinner-gradient)"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeDasharray="80, 200"
                  />
                  <defs>
                    <linearGradient id="spinner-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#6366f1" />
                      <stop offset="100%" stopColor="#a855f7" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>
              
              {/* 로딩 텍스트 */}
              <h3 className="text-gray-900 mb-2">세션 시작 중</h3>
              <p className="text-gray-600">잠시만 기다려주세요...</p>
              
              {/* 진행 상황 표시 */}
              <div className="mt-6 space-y-2">
                <div className="flex items-center justify-center gap-2 text-gray-700">
                  <div className="w-2 h-2 bg-indigo-600 rounded-full animate-pulse"></div>
                  <span>서버와 연결 중</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-2 gap-8">
          {/* 왼쪽: 목표 및 설정 */}
          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-200">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
                  <Target className="w-6 h-6 text-indigo-600" />
                </div>
                <h2 className="text-gray-900">집중 목표</h2>
              </div>

              {!isStarted ? (
                <div>
                  <label className="block text-gray-700 mb-2">
                    오늘의 목표를 입력하세요 <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={goal}
                    onChange={(e) => setGoal(e.target.value)}
                    placeholder="예: 영어 공부하기"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  {!goal.trim() && (
                    <p className="text-gray-500 mt-2">집중 목표를 입력하면 타이머를 시작할 수 있습니다</p>
                  )}
                </div>
              ) : (
                <div className="p-4 bg-indigo-50 rounded-xl">
                  <p className="text-gray-600">현재 목표</p>
                  <p className="text-indigo-900 mt-1">{savedGoal || '목표 없음'}</p>
                </div>
              )}
            </div>

            {/* 타이머 설정 */}
            {!isStarted && (
              <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-200">
                <h2 className="text-gray-900 mb-4">타이머 설정</h2>
                
                <div className="flex gap-3 items-center justify-center mb-6">
                  <div className="flex-1">
                    <input
                      type="number"
                      min="0"
                      max="180"
                      value={minutes}
                      onChange={(e) => setMinutes(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-center"
                    />
                  </div>
                  <span className="text-gray-400 text-2xl">:</span>
                  <div className="flex-1">
                    <input
                      type="number"
                      min="0"
                      max="59"
                      value={seconds}
                      onChange={(e) => setSeconds(Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-center"
                    />
                  </div>
                </div>

                {/* 빠른 설정 */}
                <div>
                  <p className="text-gray-600 mb-3">빠른 설정</p>
                  <div className="grid grid-cols-4 gap-2">
                    <button
                      onClick={() => { setMinutes(5); setSeconds(0); }}
                      className="py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-all"
                    >
                      5분
                    </button>
                    <button
                      onClick={() => { setMinutes(15); setSeconds(0); }}
                      className="py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-all"
                    >
                      15분
                    </button>
                    <button
                      onClick={() => { setMinutes(25); setSeconds(0); }}
                      className="py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-all"
                    >
                      25분
                    </button>
                    <button
                      onClick={() => { setMinutes(45); setSeconds(0); }}
                      className="py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-all"
                    >
                      45분
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 세션 정보 */}
            {isStarted && (
              <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-200">
                <h3 className="text-gray-900 mb-4">세션 정보</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">전체 시간</span>
                    <span className="text-gray-900">{Math.floor(totalTime / 60)}분 {totalTime % 60}초</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">남은 시간</span>
                    <span className="text-gray-900">{Math.floor(timeLeft / 60)}분 {timeLeft % 60}초</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">진행률</span>
                    <span className="text-indigo-600">{progress.toFixed(0)}%</span>
                  </div>
                </div>
              </div>
            )}

            {/* 웹페이지 분석 */}
            {isStarted && (
              <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-200">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
                    <Activity className="w-6 h-6 text-purple-600" />
                  </div>
                  <h3 className="text-gray-900">웹페이지 분석</h3>
                </div>

                {analysis ? (
                  <div className="space-y-4">
                    {/* 집중 여부 */}
                    <div>
                      <p className="text-gray-600 mb-2">집중 여부</p>
                      <div className={`px-4 py-3 rounded-xl flex items-center gap-2 ${
                        analysis.is_focused
                          ? 'bg-green-50 border border-green-200'
                          : 'bg-red-50 border border-red-200'
                      }`}>
                        <div className={`w-2 h-2 rounded-full ${
                          analysis.is_focused ? 'bg-green-500' : 'bg-red-500'
                        }`}></div>
                        <span className={analysis.is_focused ? 'text-green-700' : 'text-red-700'}>
                          {analysis.is_focused ? 'Focusing' : 'Distracted'}
                        </span>
                      </div>
                    </div>

                    {/* 연관성 */}
                    <div>
                      <p className="text-gray-600 mb-2">연관성</p>
                      <div className="px-6 py-4 bg-gray-50 border border-gray-200 rounded-xl flex items-center justify-center">
                        <span className={`text-5xl font-bold ${
                          analysis.score >= 0.3
                            ? 'text-green-600'
                            : analysis.score >= 0.25
                            ? 'text-yellow-600'
                            : 'text-red-600'
                        }`}>
                          {analysis.score.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    {/* Query */}
                    <div>
                      <p className="text-gray-600 mb-2">Query</p>
                      <div className="px-4 py-3 bg-indigo-50 border border-indigo-200 rounded-xl flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-indigo-600" />
                        <span className="text-indigo-900">{analysis.topic}</span>
                      </div>
                    </div>
                  </div>
                ) : sseStatus === 'failed' ? (
                  <div className="text-center py-8">
                    <div className="w-20 h-20 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
                      <WifiOff className="w-10 h-10 text-red-600" />
                    </div>
                    <h4 className="text-red-900 mb-2">SSE 접속 실패</h4>
                    <p className="text-red-700 mb-4">서버에 연결할 수 없습니다</p>
                    <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-left">
                      <p className="text-red-800 mb-2">가능한 원인:</p>
                      <ul className="text-red-700 space-y-1 ml-4 list-disc">
                        <li>서버가 실행되지 않았습니다</li>
                        <li>SSE 엔드포인트 URL이 잘못되었습니다</li>
                        <li>네트워크 연결에 문제가 있습니다</li>
                      </ul>
                      <p className="text-red-700 mt-3">
                        설정 페이지에서 SSE 엔드포인트를 확인해주세요.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="relative w-16 h-16 mx-auto mb-4">
                      <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full opacity-20 animate-ping"></div>
                      <div className="relative w-16 h-16 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full flex items-center justify-center">
                        <Activity className="w-8 h-8 text-white" />
                      </div>
                    </div>
                    <h4 className="text-indigo-900 mb-1">분석 결과 대기 중</h4>
                    <p className="text-indigo-700 mb-3">웹페이지를 탐색하면 실시간 분석이 시작됩니다</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 오른쪽: 타이머 디스플레이 */}
          <div className="flex items-center justify-center">
            <div className="bg-white rounded-2xl shadow-sm p-8 border border-gray-200 w-full">
              {/* 타이머 디스플레이 */}
              <div className="relative mb-8">
                {/* 원형 프로그레스 */}
                <svg className="w-full h-auto max-w-md mx-auto" viewBox="0 0 200 200">
                  {/* 배경 원 */}
                  <circle
                    cx="100"
                    cy="100"
                    r="80"
                    fill="none"
                    stroke="#e5e7eb"
                    strokeWidth="12"
                  />
                  {/* 프로그레스 원 */}
                  <circle
                    cx="100"
                    cy="100"
                    r="80"
                    fill="none"
                    stroke="url(#gradient)"
                    strokeWidth="12"
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 80}`}
                    strokeDashoffset={`${2 * Math.PI * 80 * (1 - progress / 100)}`}
                    transform="rotate(-90 100 100)"
                    className="transition-all duration-1000"
                  />
                  <defs>
                    <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#6366f1" />
                      <stop offset="100%" stopColor="#a855f7" />
                    </linearGradient>
                  </defs>
                </svg>

                {/* 시간 표시 */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-indigo-900" style={{ fontSize: '4rem', lineHeight: 1 }}>
                      {String(displayMinutes).padStart(2, '0')}:{String(displaySeconds).padStart(2, '0')}
                    </div>
                    <div className="text-gray-500 mt-4">
                      {isRunning ? '집중 중...' : isStarted ? '일시정지됨' : '준비'}
                    </div>
                  </div>
                </div>
              </div>

              {/* 컨트롤 버튼 */}
              <div className="flex gap-3">
                {!isStarted ? (
                  <button
                    onClick={handleStart}
                    disabled={totalTime === 0 || isStartingSession}
                    className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-4 rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <Play className="w-5 h-5" />
                    시작하기
                  </button>
                ) : (
                  <>
                    {!isRunning ? (
                      <button
                        onClick={handleStart}
                        disabled={isStartingSession}
                        className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-4 rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        <Play className="w-5 h-5" />
                        계속하기
                      </button>
                    ) : (
                      <button
                        onClick={handlePause}
                        disabled={isStartingSession}
                        className="flex-1 bg-gray-600 text-white py-4 rounded-xl hover:bg-gray-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        <Pause className="w-5 h-5" />
                        일시정지
                      </button>
                    )}
                    <button
                      onClick={handleReset}
                      disabled={isStartingSession}
                      className="px-6 bg-gray-200 text-gray-700 py-4 rounded-xl hover:bg-gray-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      <RotateCcw className="w-5 h-5" />
                      초기화
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}