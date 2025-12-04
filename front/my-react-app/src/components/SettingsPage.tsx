import { Bell, Clock, Palette, Key, Shield, Plus, Trash2, Activity, Save } from 'lucide-react';
import { useState, useEffect } from 'react';

interface SettingsPageProps {
  defaultMinutes: number;
  onDefaultMinutesChange: (minutes: number) => void;
}

interface UrlRule {
  id: string;
  url: string;
  includeSubdomains: boolean;
}

export function SettingsPage({ defaultMinutes, onDefaultMinutesChange }: SettingsPageProps) {
  const presetTimes = [5, 15, 25, 30, 45, 60];
  
  const [googleApiKey, setGoogleApiKey] = useState('');
  const [whitelist, setWhitelist] = useState<UrlRule[]>([]);
  const [blacklist, setBlacklist] = useState<UrlRule[]>([]);
  
  const [newWhitelistUrl, setNewWhitelistUrl] = useState('');
  const [newBlacklistUrl, setNewBlacklistUrl] = useState('');
  
  const [sseEndpoint, setSseEndpoint] = useState(
    localStorage.getItem('sseEndpoint') || '/api/webpage-analysis/stream'
  );

  const [enableTimerNotification, setEnableTimerNotification] = useState(
    localStorage.getItem('enableTimerNotification') !== 'false'
  );
  
  const [enableDistractionNotification, setEnableDistractionNotification] = useState(
    localStorage.getItem('enableDistractionNotification') !== 'false'
  );

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

  // 설정 불러오기
  useEffect(() => {
    const fetchConfig = async () => {
      setIsLoading(true);
      try {
        const response = await fetch('/api/get_config');
        if (!response.ok) {
          throw new Error('설정을 불러올 수 없습니다');
        }
        const data: { 
          APIKEY: string; 
          WHITE: { url: string; collect: boolean }[]; 
          BLACK: { url: string; collect: boolean }[] 
        } = await response.json();
        
        setGoogleApiKey(data.APIKEY || '');
        
        // { url, collect }[] -> UrlRule[] 변환
        const whitelistRules: UrlRule[] = data.WHITE.map((item, index) => ({
          id: `white-${index}-${Date.now()}`,
          url: item.url,
          includeSubdomains: item.collect,
        }));
        setWhitelist(whitelistRules);
        
        const blacklistRules: UrlRule[] = data.BLACK.map((item, index) => ({
          id: `black-${index}-${Date.now()}`,
          url: item.url,
          includeSubdomains: item.collect,
        }));
        setBlacklist(blacklistRules);
      } catch (error) {
        console.error('설정 불러오기 오류:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchConfig();
  }, []);

  // 설정 저장
  const handleSaveConfig = async () => {
    setIsSaving(true);
    setSaveStatus('idle');
    
    try {
      // UrlRule[] -> { url, collect }[] 변환
      const whiteUrls = whitelist.map(rule => ({
        url: rule.url,
        collect: rule.includeSubdomains,
      }));
      const blackUrls = blacklist.map(rule => ({
        url: rule.url,
        collect: rule.includeSubdomains,
      }));
      
      const response = await fetch('/api/set_config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          APIKEY: googleApiKey,
          WHITE: whiteUrls,
          BLACK: blackUrls,
        }),
      });

      if (!response.ok) {
        throw new Error('설정 저장 실패');
      }

      setSaveStatus('success');
      
      // 3초 후 성공 메시지 숨기기
      setTimeout(() => {
        setSaveStatus('idle');
      }, 3000);
    } catch (error) {
      console.error('설정 저장 오류:', error);
      setSaveStatus('error');
    } finally {
      setIsSaving(false);
    }
  };

  const requestNotificationPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        new Notification('알림이 활성화되었습니다', {
          body: '타이머 완료 시 알림을 받 수 있습니다.',
        });
      }
    }
  };

  const handleApiKeyChange = (key: string) => {
    setGoogleApiKey(key);
  };

  const handleSseEndpointChange = (endpoint: string) => {
    setSseEndpoint(endpoint);
    localStorage.setItem('sseEndpoint', endpoint);
  };

  const addToWhitelist = () => {
    if (newWhitelistUrl.trim()) {
      const newRule: UrlRule = {
        id: Date.now().toString(),
        url: newWhitelistUrl.trim(),
        includeSubdomains: false,
      };
      const updated = [...whitelist, newRule];
      setWhitelist(updated);
      setNewWhitelistUrl('');
    }
  };

  const addToBlacklist = () => {
    if (newBlacklistUrl.trim()) {
      const newRule: UrlRule = {
        id: Date.now().toString(),
        url: newBlacklistUrl.trim(),
        includeSubdomains: false,
      };
      const updated = [...blacklist, newRule];
      setBlacklist(updated);
      setNewBlacklistUrl('');
    }
  };

  const removeFromWhitelist = (id: string) => {
    const updated = whitelist.filter((rule) => rule.id !== id);
    setWhitelist(updated);
  };

  const removeFromBlacklist = (id: string) => {
    const updated = blacklist.filter((rule) => rule.id !== id);
    setBlacklist(updated);
  };

  const toggleWhitelistSubdomains = (id: string) => {
    const updated = whitelist.map((rule) =>
      rule.id === id ? { ...rule, includeSubdomains: !rule.includeSubdomains } : rule
    );
    setWhitelist(updated);
  };

  const toggleBlacklistSubdomains = (id: string) => {
    const updated = blacklist.map((rule) =>
      rule.id === id ? { ...rule, includeSubdomains: !rule.includeSubdomains } : rule
    );
    setBlacklist(updated);
  };

  return (
    <div className="flex-1 p-8 overflow-auto bg-gray-50">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-gray-900 mb-2">설정</h1>
          <p className="text-gray-600">집중 타이머 환경을 설정하세요</p>
        </div>

        {isLoading ? (
          <div className="text-center py-24">
            <div className="w-16 h-16 mx-auto mb-4 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-gray-600">설정을 불러오는 중...</p>
          </div>
        ) : (
          <>
            <div className="space-y-6">
              {/* 기본 타이머 설정 */}
              <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-200">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
                    <Clock className="w-6 h-6 text-indigo-600" />
                  </div>
                  <div>
                    <h2 className="text-gray-900">기본 타이머 시간</h2>
                    <p className="text-gray-500">타이머 시작 시 기본으로 설정되는 시간입니다</p>
                  </div>
                </div>

                <div className="grid grid-cols-6 gap-3">
                  {presetTimes.map((time) => (
                    <button
                      key={time}
                      onClick={() => onDefaultMinutesChange(time)}
                      className={`py-3 rounded-xl transition-all ${
                        defaultMinutes === time
                          ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {time}분
                    </button>
                  ))}
                </div>

                <div className="mt-4">
                  <label className="block text-gray-700 mb-2">
                    직접 입력 (분)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="180"
                    value={defaultMinutes}
                    onChange={(e) => onDefaultMinutesChange(Math.max(1, Math.min(180, parseInt(e.target.value) || 1)))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* 구글 API 키 설정 */}
              <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-200">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                    <Key className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h2 className="text-gray-900">구글 API 키</h2>
                    <p className="text-gray-500">구글 서비스 연동을 위한 API 키를 입력하세요</p>
                  </div>
                </div>

                <div>
                  <label className="block text-gray-700 mb-2">
                    API 키
                  </label>
                  <input
                    type="password"
                    value={googleApiKey}
                    onChange={(e) => handleApiKeyChange(e.target.value)}
                    placeholder="Google API Key를 입력하세요"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {googleApiKey && (
                    <p className="text-green-600 mt-2">✓ API 키가 저장되었습니다</p>
                  )}
                </div>
              </div>

              {/* 화이트리스트 URL 목록 */}
              <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-200">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                    <Shield className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <h2 className="text-gray-900">화이트리스트 URL</h2>
                    <p className="text-gray-500">집중 시간 동안 허용할 웹사이트 목록</p>
                  </div>
                </div>

                {/* URL 추가 입력 */}
                <div className="flex gap-3 mb-4">
                  <input
                    type="text"
                    value={newWhitelistUrl}
                    onChange={(e) => setNewWhitelistUrl(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addToWhitelist()}
                    placeholder="예: youtube.com"
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                  <button
                    onClick={addToWhitelist}
                    className="px-6 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-all flex items-center gap-2"
                  >
                    <Plus className="w-5 h-5" />
                    추가
                  </button>
                </div>

                {/* URL 목록 */}
                <div className="space-y-2">
                  {whitelist.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      등록된 URL이 없습니다
                    </div>
                  ) : (
                    whitelist.map((rule) => (
                      <div
                        key={rule.id}
                        className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl"
                      >
                        <div className="flex-1">
                          <p className="text-gray-900">{rule.url}</p>
                        </div>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={rule.includeSubdomains}
                            onChange={() => toggleWhitelistSubdomains(rule.id)}
                            className="w-4 h-4 text-green-600 rounded focus:ring-2 focus:ring-green-500"
                          />
                          <span className="text-gray-700">서브도메인 포함</span>
                        </label>
                        <button
                          onClick={() => removeFromWhitelist(rule.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-all"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* 블랙리스트 URL 목록 */}
              <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-200">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
                    <Shield className="w-6 h-6 text-red-600" />
                  </div>
                  <div>
                    <h2 className="text-gray-900">블랙리스트 URL</h2>
                    <p className="text-gray-500">집중 시간 동안 차단할 웹사이트 목록</p>
                  </div>
                </div>

                {/* URL 추가 입력 */}
                <div className="flex gap-3 mb-4">
                  <input
                    type="text"
                    value={newBlacklistUrl}
                    onChange={(e) => setNewBlacklistUrl(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addToBlacklist()}
                    placeholder="예: facebook.com"
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                  <button
                    onClick={addToBlacklist}
                    className="px-6 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-all flex items-center gap-2"
                  >
                    <Plus className="w-5 h-5" />
                    추가
                  </button>
                </div>

                {/* URL 목록 */}
                <div className="space-y-2">
                  {blacklist.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      등록된 URL이 없습니다
                    </div>
                  ) : (
                    blacklist.map((rule) => (
                      <div
                        key={rule.id}
                        className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl"
                      >
                        <div className="flex-1">
                          <p className="text-gray-900">{rule.url}</p>
                        </div>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={rule.includeSubdomains}
                            onChange={() => toggleBlacklistSubdomains(rule.id)}
                            className="w-4 h-4 text-red-600 rounded focus:ring-2 focus:ring-red-500"
                          />
                          <span className="text-gray-700">서브도메인 포함</span>
                        </label>
                        <button
                          onClick={() => removeFromBlacklist(rule.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-all"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* SSE 엔드포인트 설정 */}
              <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-200">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
                    <Activity className="w-6 h-6 text-orange-600" />
                  </div>
                  <div>
                    <h2 className="text-gray-900">SSE 엔드포인트</h2>
                    <p className="text-gray-500">실시간 웹페이지 분석을 위한 서버 엔드포인트를 설정하세요</p>
                  </div>
                </div>

                <div>
                  <label className="block text-gray-700 mb-2">
                    SSE 스트림 URL
                  </label>
                  <input
                    type="text"
                    value={sseEndpoint}
                    onChange={(e) => handleSseEndpointChange(e.target.value)}
                    placeholder="/api/webpage-analysis/stream"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                  <p className="text-gray-500 mt-2">
                    서버는 <code className="bg-gray-100 px-2 py-1 rounded">{'{ is_focused: boolean, score: number, topic: string }'}</code> 형태의 JSON을 전송해야 합니다
                  </p>
                  {sseEndpoint && (
                    <p className="text-green-600 mt-2">✓ 엔드포인트가 저장되었습니다</p>
                  )}
                </div>
              </div>

              {/* 알림 설정 */}
              <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-200">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
                    <Bell className="w-6 h-6 text-purple-600" />
                  </div>
                  <div>
                    <h2 className="text-gray-900">알림 설정</h2>
                    <p className="text-gray-500">타이머 완료 시 알림을 받으세요</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-900">브라우저 알림 권한</p>
                      <p className="text-gray-500">타이머 완료 시 데스크탑 알림을 표시합니다</p>
                    </div>
                    <button
                      onClick={requestNotificationPermission}
                      className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all"
                    >
                      알림 허용
                    </button>
                  </div>

                  {typeof Notification !== 'undefined' && (
                    <div className="p-4 bg-gray-50 rounded-xl">
                      <p className="text-gray-700">
                        현재 알림 상태:{' '}
                        <span className={`${
                          Notification.permission === 'granted'
                            ? 'text-green-600'
                            : Notification.permission === 'denied'
                            ? 'text-red-600'
                            : 'text-yellow-600'
                        }`}>
                          {Notification.permission === 'granted'
                            ? '허용됨'
                            : Notification.permission === 'denied'
                            ? '차단됨'
                            : '대기 중'}
                        </span>
                      </p>
                    </div>
                  )}

                  <div className="border-t border-gray-200 pt-4 mt-4"></div>

                  {/* 타이머 완료 알림 */}
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                    <div className="flex-1">
                      <p className="text-gray-900">타이머 완료 알림</p>
                      <p className="text-gray-500">타이머가 종료되면 알림을 표시합니다</p>
                      <p className="text-gray-600 mt-2">예시: "영어 공부하기 종료. 25분 0초 동안 수고하셨습니다!"</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={enableTimerNotification}
                        onChange={(e) => {
                          setEnableTimerNotification(e.target.checked);
                          localStorage.setItem('enableTimerNotification', e.target.checked.toString());
                        }}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                  </div>

                  {/* 집중 이탈 알림 */}
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                    <div className="flex-1">
                      <p className="text-gray-900">집중 이탈 알림</p>
                      <p className="text-gray-500">집중하지 않을 때 부드러운 리마인더를 표시합니다</p>
                      <p className="text-gray-600 mt-2">예시: "집중 중인가요?" / "목표에 집중해주세요!"</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={enableDistractionNotification}
                        onChange={(e) => {
                          setEnableDistractionNotification(e.target.checked);
                          localStorage.setItem('enableDistractionNotification', e.target.checked.toString());
                        }}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                  </div>
                </div>
              </div>

              {/* 정보 */}
              <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-200">
                <h2 className="text-gray-900 mb-4">앱 정보</h2>
                <div className="space-y-2 text-gray-600">
                  <p>Figma, Taewon Choi</p>
                  <p>집중 타이머</p>
                </div>
              </div>
            </div>

            {/* 적용 버튼 */}
            <div className="sticky bottom-0 mt-6 -mx-8 px-8 py-6 bg-gray-50">
              <button
                onClick={handleSaveConfig}
                disabled={isSaving}
                className={`w-full py-4 rounded-xl transition-all flex items-center justify-center gap-3 shadow-lg ${
                  isSaving
                    ? 'bg-gray-400 cursor-not-allowed'
                    : saveStatus === 'success'
                    ? 'bg-green-600 hover:bg-green-700'
                    : saveStatus === 'error'
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700'
                } text-white`}
              >
                {isSaving ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>저장 중...</span>
                  </>
                ) : saveStatus === 'success' ? (
                  <>
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>저장 완료!</span>
                  </>
                ) : saveStatus === 'error' ? (
                  <>
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    <span>저장 실패</span>
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5" />
                    <span>설정 적용</span>
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}