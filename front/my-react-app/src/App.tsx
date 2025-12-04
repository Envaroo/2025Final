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
  const [reconnectAttempts, setReconnectAttempts] = useState<number>(0);

  // 기본 이머 시간 불러오기 및 타이머 복원
  useEffect(() => {
    const savedDefaultMinutes = localStorage.getItem('defaultMinutes');
    if (savedDefaultMinutes) {
      const defaultMin = parseInt(savedDefaultMinutes);
      setDefaultMinutes(defaultMin);
      setMinutes(defaultMin);
    }

    // 세션스토리지에서 타이머 세션 복원
    const savedTimer = sessionStorage.getItem('timerSession');
    if (savedTimer) {
      try {
        const timerData = JSON.parse(savedTimer);
        const now = Date.now();
        
        // 타이머가 실행 중이었는지 확인
        if (timerData.isStarted) {
          setIsStarted(true);
          setSavedGoal(timerData.goal);
          setGoal(timerData.goal);
          setMinutes(timerData.minutes);
          setSeconds(timerData.seconds);
          
          if (timerData.isRunning) {
            // 실행 중이었다면 경과 시간 계산
            const elapsed = Math.floor((now - timerData.startTime) / 1000);
            const newTimeLeft = Math.max(0, timerData.totalDuration - elapsed);
            
            if (newTimeLeft > 0) {
              setTimeLeft(newTimeLeft);
              setIsRunning(true);
            } else {
              // 이미 완료됨
              setTimeLeft(0);
              setIsRunning(false);
              sessionStorage.removeItem('timerSession');
            }
          } else {
            // 일시정지 상태였다면
            setTimeLeft(timerData.pausedTimeLeft);
            setIsRunning(false);
          }
        }
      } catch (error) {
        console.error('타이머 복원 오류:', error);
        sessionStorage.removeItem('timerSession');
      }
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
            
            // 세션스토리지 정리
            sessionStorage.removeItem('timerSession');
            
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

  // 타이머 상태를 로컬스토리지에 저장
  useEffect(() => {
    if (isStarted) {
      const totalDuration = minutes * 60 + seconds;
      const timerData = {
        isStarted,
        isRunning,
        goal: savedGoal,
        minutes,
        seconds,
        totalDuration,
        startTime: isRunning ? Date.now() - ((totalDuration - timeLeft) * 1000) : null,
        pausedTimeLeft: !isRunning ? timeLeft : null,
      };
      sessionStorage.setItem('timerSession', JSON.stringify(timerData));
    }
  }, [isStarted, isRunning, savedGoal, minutes, seconds, timeLeft]);

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

  // 웹페이지 분석 데이터 가져오기 (SSE) - 개선된 버전
  useEffect(() => {
    let eventSource: EventSource | null = null;
    let reconnectTimeoutId: NodeJS.Timeout | null = null;
    let connectionTimeoutId: NodeJS.Timeout | null = null;
    let firstMessageTimeoutId: NodeJS.Timeout | null = null;
    let isCleaningUp = false;
    let currentReconnectAttempts = 0;
    let hasReceivedFirstMessage = false;

    const MAX_RECONNECT_ATTEMPTS = 5;
    const INITIAL_RECONNECT_DELAY = 1000; // 1초
    const MAX_RECONNECT_DELAY = 30000; // 30초
    const CONNECTION_TIMEOUT = 10000; // 10초
    const FIRST_MESSAGE_TIMEOUT = 15000; // 15초 - 첫 메시지 대기 시간

    const calculateReconnectDelay = (attempt: number) => {
      // Exponential backoff: 1초, 2초, 4초, 8초, 16초, 최대 30초
      return Math.min(INITIAL_RECONNECT_DELAY * Math.pow(2, attempt), MAX_RECONNECT_DELAY);
    };

    const connectSSE = () => {
      if (isCleaningUp || !isStarted) {
        return;
      }

      const sseEndpoint = localStorage.getItem('sseEndpoint') || '/api/webpage-analysis/stream';
      
      console.log(`SSE 연결 시도 (${currentReconnectAttempts + 1}/${MAX_RECONNECT_ATTEMPTS}): ${sseEndpoint}`);
      setSSEStatus('connecting');
      hasReceivedFirstMessage = false;

      try {
        // 기존 연결이 있다면 정리
        if (eventSource) {
          eventSource.close();
          eventSource = null;
        }

        // 새 EventSource 생성
        eventSource = new EventSource(sseEndpoint);

        // 연결 타임아웃 설정 (HTTP 연결 자체의 타임아웃)
        connectionTimeoutId = setTimeout(() => {
          if (eventSource && eventSource.readyState !== EventSource.OPEN) {
            console.warn('SSE HTTP 연결 타임아웃 (onopen 미발생)');
            if (eventSource) {
              eventSource.close();
            }
            handleReconnect();
          }
        }, CONNECTION_TIMEOUT);

        // 연결 성공 핸들러 (HTTP 연결만 성공)
        eventSource.onopen = () => {
          console.log('SSE HTTP 연결 열림, ReadyState:', eventSource?.readyState);
          
          // 연결 타임아웃 해제
          if (connectionTimeoutId) {
            clearTimeout(connectionTimeoutId);
            connectionTimeoutId = null;
          }

          // 첫 메시지 대기 타임아웃 설정
          // 연결은 됐지만 실제 메시지를 받지 못하는 경우 감지
          firstMessageTimeoutId = setTimeout(() => {
            if (!hasReceivedFirstMessage) {
              console.warn('SSE 첫 메시지 타임아웃 (연결은 됐으나 메시지 미수신)');
              if (eventSource) {
                eventSource.close();
              }
              handleReconnect();
            }
          }, FIRST_MESSAGE_TIMEOUT);
        };

        // 메시지 수신 핸들러 - 실제 연결 성공 판단
        eventSource.onmessage = (event) => {
          try {
            console.log('SSE 메시지 수신:', event.data);
            
            // 첫 메시지를 받았을 때만 connected 상태로 변경
            if (!hasReceivedFirstMessage) {
              hasReceivedFirstMessage = true;
              setSSEStatus('connected');
              currentReconnectAttempts = 0; // 재연결 카운터 리셋
              setReconnectAttempts(0);
              
              // 첫 메시지 타임아웃 해제
              if (firstMessageTimeoutId) {
                clearTimeout(firstMessageTimeoutId);
                firstMessageTimeoutId = null;
              }
              
              console.log('✅ SSE 연결 완전히 성공 (첫 메시지 수신)');
            }

            const data = JSON.parse(event.data);
            
            // 서버에서 { is_focused, score, topic } 형태로 전송
            if (
              data && 
              typeof data.is_focused === 'boolean' && 
              typeof data.score === 'number' && 
              typeof data.topic === 'string'
            ) {
              setAnalysis({
                is_focused: data.is_focused,
                score: data.score,
                topic: data.topic,
              });
            } else {
              console.warn('유효하지 않은 SSE 메시지 형식:', data);
            }
          } catch (error) {
            console.error('SSE 메시지 파싱 오류:', error, 'Raw data:', event.data);
          }
        };

        // 에러 핸들러
        eventSource.onerror = (error) => {
          console.error('SSE 연결 오류, ReadyState:', eventSource?.readyState, error);
          
          // 모든 타임아웃 해제
          if (connectionTimeoutId) {
            clearTimeout(connectionTimeoutId);
            connectionTimeoutId = null;
          }
          
          if (firstMessageTimeoutId) {
            clearTimeout(firstMessageTimeoutId);
            firstMessageTimeoutId = null;
          }

          // EventSource는 자동으로 재연결을 시도하지만, 
          // 실패가 반복되면 수동으로 재연결 로직 실행
          if (eventSource) {
            eventSource.close();
            eventSource = null;
          }

          handleReconnect();
        };

      } catch (error) {
        console.error('EventSource 생성 오류:', error);
        setSSEStatus('failed');
        handleReconnect();
      }
    };

    const handleReconnect = () => {
      if (isCleaningUp || !isStarted) {
        return;
      }

      // 최대 재연결 시도 횟수 확인
      if (currentReconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        console.error('SSE 최대 재연결 시도 횟수 초과');
        setSSEStatus('failed');
        setReconnectAttempts(currentReconnectAttempts);
        setAnalysis(null);
        return;
      }

      const delay = calculateReconnectDelay(currentReconnectAttempts);
      console.log(`${delay}ms 후 SSE 재연결 시도...`);
      setSSEStatus('connecting');

      reconnectTimeoutId = setTimeout(() => {
        currentReconnectAttempts += 1;
        setReconnectAttempts(currentReconnectAttempts);
        connectSSE();
      }, delay);
    };

    // 타이머가 시작되었을 때만 SSE 연결
    if (isStarted) {
      connectSSE();
    } else {
      // 타이머가 종료되면 분석 데이터와 상태 초기화
      setAnalysis(null);
      setSSEStatus('idle');
      setReconnectAttempts(0);
    }

    // 정리 함수
    return () => {
      isCleaningUp = true;
      
      console.log('SSE 연결 정리 시작');
      
      // 타임아웃 정리
      if (reconnectTimeoutId) {
        clearTimeout(reconnectTimeoutId);
        reconnectTimeoutId = null;
      }
      
      if (connectionTimeoutId) {
        clearTimeout(connectionTimeoutId);
        connectionTimeoutId = null;
      }

      if (firstMessageTimeoutId) {
        clearTimeout(firstMessageTimeoutId);
        firstMessageTimeoutId = null;
      }

      // EventSource 정리
      if (eventSource) {
        console.log('SSE 연결 종료, ReadyState:', eventSource.readyState);
        eventSource.close();
        eventSource = null;
      }
    };
  }, [isStarted]); // reconnectAttempts와 sseStatus 제거!

  // 페이지가 닫힐 때 타이머가 작동 중이면 세션 종료
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (isStarted && (isRunning || timeLeft > 0)) {
        const totalTime = minutes * 60 + seconds;
        const elapsedTime = totalTime - timeLeft;
        
        // sendBeacon을 사용하여 페이지가 닫힐 때도 요청이 전송되도록 보장
        const data = JSON.stringify({ duration: elapsedTime });
        const blob = new Blob([data], { type: 'application/json' });
        navigator.sendBeacon('/api/end_session', blob);
        
        console.log('페이지 종료 시 세션 종료 전송:', elapsedTime);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isStarted, isRunning, timeLeft, minutes, seconds]);

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
          duration: duration, // 설정했 전체 시간
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
    
    // 세션스토리지 정리
    sessionStorage.removeItem('timerSession');
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