import multiprocessing
import atexit
from ai.proc.analysis import FocusAnalysisProcess 

class FocusManager:
    def __init__(self):
        self.process = None
        self.task_queue = None
        self.result_queue = None
        self.status_event = None
        self.lock = multiprocessing.Lock() # 스레드 안전성을 위한 Lock
        
    def start_monitoring(self, user_goal):
        """모니터링 프로세스 시작 (이미 실행 중이면 무시)"""
        with self.lock:
            if self.process is not None and self.process.is_alive():
                return {"status": "already_running", "message": "이미 분석 중입니다."}

            # 통신 채널 생성
            self.task_queue = multiprocessing.Queue()
            self.result_queue = multiprocessing.Queue()
            self.status_event = multiprocessing.Event()

            # 워커 프로세스 생성 및 시작
            # (이전 답변의 FocusAnalysisProcess 클래스 사용)
            self.process = FocusAnalysisProcess(
                user_goal, self.task_queue, self.result_queue, self.status_event
            )
            self.process.start()

            # 초기화 완료 대기 (블로킹 방지를 위해 타임아웃 설정 권장)
            # 실제로는 비동기로 처리하거나, 짧게 대기
            is_ready = self.status_event.wait(timeout=30) 
            
            if not is_ready:
                self.stop_monitoring()
                return {"status": "error", "message": "초기화 시간 초과"}

            return {"status": "started", "message": "집중 분석이 시작되었습니다."}

    def analyze_page(self, page_data):
        """웹 페이지 데이터 분석 요청"""
        if not self.process or not self.process.is_alive():
            return {"status": "error", "message": "프로세스가 실행 중이 아닙니다."}

        try:
            # 1. 작업 큐에 넣기
            self.task_queue.put(page_data)
            
            # 2. 결과 큐에서 대기 (Timeout 필수: 프로세스가 죽었을 경우 대비)
            result = self.result_queue.get(timeout=5) 
            if(result.get('error')):
                return {"status": "error", "message": result['error']}
            return {"status": "success", "data": result}
            
        except multiprocessing.queues.Empty:
            return {"status": "timeout", "message": "분석 응답 시간이 초과되었습니다."}
        except Exception as e:
            return {"status": "error", "message": str(e)}

    def stop_monitoring(self):
        """모니터링 프로세스 종료"""
        with self.lock:
            if self.process:
                if self.process.is_alive():
                    self.process.terminate()
                    # 종료 신호 전송
                    #self.task_queue.put("STOP")
                    #self.process.join(timeout=3) # 3초 대기
                    
                    # 그래도 안 죽으면 강제 종료
                    if self.process.is_alive():
                        self.process.terminate()
                
                # 리소스 정리
                self.process = None
                self.task_queue = None
                self.result_queue = None
                return {"status": "stopped", "message": "분석이 종료되었습니다."}
            return {"status": "not_running", "message": "실행 중인 프로세스가 없습니다."}

# 전역 매니저 인스턴스 생성
focus_manager = FocusManager()

# 서버가 죽을 때 자식 프로세스도 같이 죽도록 등록
def cleanup():
    focus_manager.stop_monitoring()

atexit.register(cleanup)