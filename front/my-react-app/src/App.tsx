import { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { TimerPage } from './components/TimerPage';
import { StatsPage } from './components/StatsPage';
import { SettingsPage } from './components/SettingsPage';

interface WebpageAnalysis {
  is_focused: boolean;
  score: number;
  topic: string;
}

type SSEConnectionStatus = 'idle' | 'connecting' | 'connected' | 'failed';

export default function App() {
  const [currentPage, setCurrentPage] = useState('timer');
  const [defaultMinutes, setDefaultMinutes] = useState(25);
  
  // 타이머 상태들을 App 레벨로 이동
  const [goal, setGoal] = useState('');
  const [savedGoal, setSavedGoal] = useState('');
  const [minutes, setMinutes] = useState(25);
  const [seconds, setSeconds] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [isStarted, setIsStarted] = useState(false);
  const [analysis, setAnalysis] = useState<WebpageAnalysis | null>(null);
  const [isStartingSession, setIsStartingSession] = useState(false);
  const [sseStatus, setSSEStatus] = useState<SSEConnectionStatus>('idle');
  const [lastDistractionNotification, setLastDistractionNotification] = useState<number>(0);

  // 기본 타이머 시간 불러오기
  useEffect(() => {
    const savedDefaultMinutes = localStorage.getItem('defaultMinutes');
    if (savedDefaultMinutes) {
      const defaultMin = parseInt(savedDefaultMinutes);
      setDefaultMinutes(defaultMin);
      setMinutes(defaultMin);
    }
  }, []);

  // 타이머 로직
  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;

    if (isRunning && timeLeft > 0) {
      intervalId = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            setIsRunning(false);
            const duration = minutes * 60 + seconds;
            handleSessionComplete(savedGoal, duration);
            
            // 타이머 완료 알림
            if ('Notification' in window && Notification.permission === 'granted') {
              const enableTimerNotification = localStorage.getItem('enableTimerNotification') !== 'false';
              if (enableTimerNotification) {
                const totalMinutes = Math.floor(duration / 60);
                const totalSeconds = duration % 60;
                const timeText = totalMinutes > 0 
                  ? `${totalMinutes}분 ${totalSeconds}초` 
                  : `${totalSeconds}초`;
                
                new Notification('집중 타이머 완료!', {
                  body: `${savedGoal} 종료. ${timeText} 동안 수고하셨습니다!`,
                  icon: '/timer-complete.png',
                });
              }
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [isRunning, timeLeft, savedGoal, minutes, seconds]);

  // 집중 상태 모니터링 및 알림
  useEffect(() => {
    if (analysis && isRunning) {
      const enableDistractionNotification = localStorage.getItem('enableDistractionNotification') !== 'false';
      
      if (!analysis.is_focused && enableDistractionNotification) {
        const now = Date.now();
        const notificationInterval = 15000; // 15초에 한 번만 알림
        
        if (now - lastDistractionNotification > notificationInterval) {
          if ('Notification' in window && Notification.permission === 'granted') {
            const messages = [
              '집중 중인가요?',
              '잠깐, 목표를 다시 확인해보세요!',
              '지금 하는 일이 목표와 관련이 있나요?',
              '집중력을 되찾아보세요!',
              '목표에 집중해주세요!',
            ];
            const randomMessage = messages[Math.floor(Math.random() * messages.length)];
            
            new Notification(randomMessage, {
              body: `현재 활동이 "${savedGoal}" 목표와 관련이 없는 것 같아요.`,
              icon: '/focus-reminder.png',
            });
            
            setLastDistractionNotification(now);
          }
        }
      }
    }
  }, [analysis, isRunning, lastDistractionNotification, savedGoal]);

  // 웹페이지 분석 데이터 가져오기 (SSE)
  useEffect(() => {
    let eventSource: EventSource | null = null;

    if (isRunning) {
      // SSE 엔드포인트 URL (설정에서 가져오거나 기본값 사용)
      const sseEndpoint = localStorage.getItem('sseEndpoint') || '/api/webpage-analysis/stream';
      
      setSSEStatus('connecting');
      
      try {
        // EventSource를 사용한 SSE 연결
        eventSource = new EventSource(sseEndpoint);

        // 메시지 수신 이벤트
        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            // 서버에서 { is_focused, score, topic } 형태로 전송
            if (data && typeof data.is_focused === 'boolean' && typeof data.score === 'number' && typeof data.topic === 'string') {
              setAnalysis({
                is_focused: data.is_focused,
                score: data.score,
                topic: data.topic,
              });
            }
          } catch (error) {
            console.error('SSE 메시지 파싱 오류:', error);
          }
        };

        // 연결 성공
        eventSource.onopen = () => {
          console.log('SSE 연결 성공');
          setSSEStatus('connected');
        };

        // 에러 처리
        eventSource.onerror = (error) => {
          console.error('SSE 연결 오류:', error);
          setSSEStatus('failed');
          
          // SSE 연결 실패
          if (eventSource) {
            eventSource.close();
            eventSource = null;
          }
        };

      } catch (error) {
        console.error('EventSource 생성 오류:', error);
        setSSEStatus('failed');
      }
    } else {
      if (!isStarted) {
        setAnalysis(null);
        setSSEStatus('idle');
      }
    }

    return () => {
      // 정리: SSE 연결 종료
      if (eventSource) {
        console.log('SSE 연결 종료');
        eventSource.close();
      }
    };
  }, [isRunning, isStarted]);

  // 세션 저장
  const handleSessionComplete = async (goal: string, duration: number) => {
    // 세션 종료 API 호출 (타이머 완료)
    try {
      await fetch('/api/end_session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          duration: duration, // 설정했던 전체 시간
        }),
      });
      console.log('세션 종료 전송 완료:', duration);
    } catch (error) {
      console.error('세션 종료 전송 오류:', error);
    }
  };

  // 세션 초기화 (중도 종료)
  const handleSessionReset = async () => {
    if (isStarted) {
      const totalTime = minutes * 60 + seconds;
      const elapsedTime = totalTime - timeLeft; // 실제 경과된 시간
      
      // 세션 종료 API 호출 (중도 종료)
      try {
        await fetch('/api/end_session', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            duration: elapsedTime, // 실제 경과된 시간
          }),
        });
        console.log('세션 중도 종료 전송 완료:', elapsedTime);
      } catch (error) {
        console.error('세션 종료 전송 오류:', error);
      }
    }

    // 타이머 초기화
    setIsRunning(false);
    setIsStarted(false);
    setTimeLeft(0);
    setSavedGoal('');
  };

  // 기본 시간 변경
  const handleDefaultMinutesChange = (newMinutes: number) => {
    setDefaultMinutes(newMinutes);
    localStorage.setItem('defaultMinutes', newMinutes.toString());
    if (!isStarted) {
      setMinutes(newMinutes);
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar currentPage={currentPage} onPageChange={setCurrentPage} />
      
      {currentPage === 'timer' && (
        <TimerPage
          goal={goal}
          setGoal={setGoal}
          savedGoal={savedGoal}
          setSavedGoal={setSavedGoal}
          minutes={minutes}
          setMinutes={setMinutes}
          seconds={seconds}
          setSeconds={setSeconds}
          timeLeft={timeLeft}
          setTimeLeft={setTimeLeft}
          isRunning={isRunning}
          setIsRunning={setIsRunning}
          isStarted={isStarted}
          setIsStarted={setIsStarted}
          analysis={analysis}
          isStartingSession={isStartingSession}
          setIsStartingSession={setIsStartingSession}
          sseStatus={sseStatus}
          handleSessionReset={handleSessionReset}
        />
      )}
      
      {currentPage === 'stats' && (
        <StatsPage />
      )}
      
      {currentPage === 'settings' && (
        <SettingsPage
          defaultMinutes={defaultMinutes}
          onDefaultMinutesChange={handleDefaultMinutesChange}
        />
      )}
    </div>
  );
}