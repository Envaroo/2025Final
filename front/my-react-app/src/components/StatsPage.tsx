import { useState, useMemo, useEffect } from 'react';
import { Calendar, Clock, Target, TrendingUp, CheckCircle, XCircle, Loader2, AlertCircle } from 'lucide-react';

interface SessionListItem {
  session_id: number;
  start_time: string;
  goal: string;
  duration: number;
}

interface EventRecord {
  event_time: string;
  type: boolean;
  score: number;
  topic: string;
  url: string;
}

export function StatsPage() {
  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [eventRecords, setEventRecords] = useState<EventRecord[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 세션 목록 불러오기
  useEffect(() => {
    const fetchSessions = async () => {
      setIsLoadingSessions(true);
      setError(null);
      try {
        const response = await fetch('/api/get_session_list');
        if (!response.ok) {
          throw new Error('세션 목록을 불러올 수 없습니다');
        }
        const data: SessionListItem[] = await response.json();
        setSessions(data);
        
        // 가장 최근 세션을 기본 선택
        if (data.length > 0) {
          setSelectedSessionId(data[0].session_id);
        }
      } catch (error) {
        console.error('세션 목록 불러오기 오류:', error);
        setError(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다');
      } finally {
        setIsLoadingSessions(false);
      }
    };

    fetchSessions();
  }, []);

  // 선택된 세션의 이벤트 불러오기
  useEffect(() => {
    if (selectedSessionId === null) {
      setEventRecords([]);
      return;
    }

    const fetchEvents = async () => {
      setIsLoadingEvents(true);
      try {
        const response = await fetch('/api/get_event_list', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            session_id: selectedSessionId,
          }),
        });

        if (!response.ok) {
          throw new Error('이벤트 목록을 불러올 수 없습니다');
        }

        const data: EventRecord[] = await response.json();
        setEventRecords(data);
      } catch (error) {
        console.error('이벤트 목록 불러오기 오류:', error);
        setEventRecords([]);
      } finally {
        setIsLoadingEvents(false);
      }
    };

    fetchEvents();
  }, [selectedSessionId]);

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hour = String(date.getHours()).padStart(2, '0');
    const minute = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hour}:${minute}`;
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('ko-KR', { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    });
  };

  // 선택된 세션 정보
  const selectedSession = useMemo(() => {
    return sessions.find((s) => s.session_id === selectedSessionId) || null;
  }, [sessions, selectedSessionId]);

  // 세션 기간 계산
  const sessionDuration = useMemo(() => {
    if (eventRecords.length === 0) return null;
    const startTime = new Date(eventRecords[0].event_time);
    const endTime = new Date(eventRecords[eventRecords.length - 1].event_time);
    const durationMs = endTime.getTime() - startTime.getTime();
    return Math.floor(durationMs / 1000); // 초 단위
  }, [eventRecords]);

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}시간 ${minutes}분`;
    }
    return `${minutes}분`;
  };

  return (
    <div className="flex flex-1 h-screen overflow-hidden">
      {/* 세션 사이드바 */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-gray-900">세션 목록</h2>
          <p className="text-gray-500 mt-1">총 {sessions.length}개 세션</p>
        </div>

        <div className="flex-1 overflow-auto p-4">
          {isLoadingSessions ? (
            <div className="text-center py-12">
              <Loader2 className="w-12 h-12 text-indigo-600 mx-auto mb-3 animate-spin" />
              <p className="text-gray-600">세션 목록을 불러오는 중...</p>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
              <p className="text-red-700">{error}</p>
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-12">
              <Clock className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600">아직 완료된 세션이 없습니다</p>
            </div>
          ) : (
            <div className="space-y-2">
              {sessions.map((session) => (
                <button
                  key={session.session_id}
                  onClick={() => setSelectedSessionId(session.session_id)}
                  className={`w-full text-left p-4 rounded-xl transition-all ${
                    selectedSessionId === session.session_id
                      ? 'bg-indigo-50 border-2 border-indigo-500'
                      : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
                  }`}
                >
                  <p className={`mb-1 ${
                    selectedSessionId === session.session_id ? 'text-indigo-900' : 'text-gray-900'
                  }`}>
                    {formatDateTime(session.start_time)}
                  </p>
                  <p className="text-gray-600 mb-2 truncate">{session.goal}</p>
                  <p className={`${
                    selectedSessionId === session.session_id ? 'text-indigo-600' : 'text-gray-500'
                  }`}>
                    {formatDuration(session.duration)}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 메인 콘텐츠 */}
      <div className="flex-1 overflow-auto bg-gray-50">
        {selectedSession ? (
          <div className="p-8">
            <div className="max-w-6xl mx-auto">
              {isLoadingEvents ? (
                <div className="text-center py-24">
                  <Loader2 className="w-16 h-16 text-indigo-600 mx-auto mb-4 animate-spin" />
                  <p className="text-gray-600">이벤트를 불러오는 중...</p>
                </div>
              ) : (
                <>
                  {/* 세션 헤더 */}
                  <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-200 mb-6">
                    <div className="grid grid-cols-4 gap-6">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <Calendar className="w-5 h-5 text-gray-500" />
                          <p className="text-gray-600">시작 시간</p>
                        </div>
                        <p className="text-gray-900">{formatDateTime(selectedSession.start_time)}</p>
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <Target className="w-5 h-5 text-gray-500" />
                          <p className="text-gray-600">집중 목표</p>
                        </div>
                        <p className="text-gray-900">{selectedSession.goal}</p>
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <Clock className="w-5 h-5 text-gray-500" />
                          <p className="text-gray-600">세션 기간</p>
                        </div>
                        <p className="text-gray-900">{formatDuration(selectedSession.duration)}</p>
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <TrendingUp className="w-5 h-5 text-gray-500" />
                          <p className="text-gray-600">이벤트 수</p>
                        </div>
                        <p className="text-gray-900">{eventRecords.length}개</p>
                      </div>
                    </div>
                  </div>

                  {/* 타임라인 그래픽 */}
                  {eventRecords.length > 0 && sessionDuration && (
                    <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-200 mb-6">
                      <h3 className="text-gray-900 mb-4">집중도 타임라인</h3>
                      <div className="relative">
                        {/* 수평선 */}
                        <div className="h-2 bg-gray-200 rounded-full relative">
                          {eventRecords.map((record, index) => {
                            const startTime = new Date(eventRecords[0].event_time).getTime();
                            const endTime = new Date(eventRecords[eventRecords.length - 1].event_time).getTime();
                            const recordTime = new Date(record.event_time).getTime();
                            const position = ((recordTime - startTime) / (endTime - startTime)) * 100;

                            return (
                              <div
                                key={index}
                                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 group"
                                style={{ left: `${position}%` }}
                              >
                                <div
                                  className={`w-3 h-3 rounded-full ${
                                    record.type ? 'bg-green-500' : 'bg-red-500'
                                  } cursor-pointer hover:scale-150 transition-transform`}
                                  title={`${formatTime(record.event_time)} - ${record.type ? 'Focusing' : 'Distracted'}`}
                                ></div>
                                {/* 툴팁 */}
                                <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap bg-gray-900 text-white px-3 py-2 rounded-lg text-sm z-10">
                                  <div>{formatTime(record.event_time)}</div>
                                  <div>{record.type ? 'Focusing' : 'Distracted'} ({record.score.toFixed(2)})</div>
                                  <div className="text-gray-300">{record.topic}</div>
                                  <div className="text-gray-400 text-xs mt-1 max-w-xs truncate">{record.url}</div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        
                        {/* 시간 레이블 */}
                        <div className="flex justify-between mt-3 text-gray-500">
                          <span>{formatTime(eventRecords[0].event_time)}</span>
                          <span>{formatTime(eventRecords[eventRecords.length - 1].event_time)}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 레코드 테이블 */}
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="p-6 border-b border-gray-200">
                      <h3 className="text-gray-900">상세 레코드</h3>
                      <p className="text-gray-500 mt-1">총 {eventRecords.length}개 레코드</p>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-200">
                          <tr>
                            <th className="px-6 py-3 text-left text-gray-700">타임스탬프</th>
                            <th className="px-6 py-3 text-left text-gray-700">URL</th>
                            <th className="px-6 py-3 text-left text-gray-700">주제 (Topic)</th>
                            <th className="px-6 py-3 text-center text-gray-700">집중 여부</th>
                            <th className="px-6 py-3 text-center text-gray-700">연관성 점수</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {eventRecords.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                                레코드가 없습니다
                              </td>
                            </tr>
                          ) : (
                            eventRecords.map((record, index) => (
                              <tr key={index} className="hover:bg-gray-50 transition-colors">
                                <td className="px-6 py-4 text-gray-900">
                                  {formatTime(record.event_time)}
                                </td>
                                <td className="px-6 py-4">
                                  <a
                                    href={record.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-indigo-600 hover:underline truncate block max-w-md"
                                    title={record.url}
                                  >
                                    {record.url}
                                  </a>
                                </td>
                                <td className="px-6 py-4">
                                  <span className="text-gray-900">{record.topic}</span>
                                </td>
                                <td className="px-6 py-4">
                                  <div className="flex items-center justify-center gap-2">
                                    {record.type ? (
                                      <>
                                        <CheckCircle className="w-5 h-5 text-green-600" />
                                        <span className="text-green-700">Focusing</span>
                                      </>
                                    ) : (
                                      <>
                                        <XCircle className="w-5 h-5 text-red-600" />
                                        <span className="text-red-700">Distracted</span>
                                      </>
                                    )}
                                  </div>
                                </td>
                                <td className="px-6 py-4">
                                  <div className="flex items-center justify-center">
                                    <span className={`text-2xl font-bold ${
                                      record.score >= 0.3
                                        ? 'text-green-600'
                                        : record.score >= 0.25
                                        ? 'text-yellow-600'
                                        : 'text-red-600'
                                    }`}>
                                      {record.score.toFixed(2)}
                                    </span>
                                  </div>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <TrendingUp className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">세션을 선택하여 상세 정보를 확인하세요</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}