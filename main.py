# 📄 main.py (최신 통합 버전)
import threading
import os
import webbrowser
from backend.flask_server import run_flask_server
from pystray import Icon, Menu, MenuItem
from PIL import Image
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common import window
import atexit
gdriver = []

def openCustomSel():
    base_path = os.path.dirname(os.path.abspath(__file__))
    extension_folder_path = os.path.join(base_path, 'ext', 'src')
    options = Options()
    options.add_experimental_option(
    "prefs",
    {
        "extensions.ui.developer_mode": True,
    },
    )
    options.add_argument("--enable-unsafe-extension-debugging")
    options.add_argument("--remote-debugging-pipe")
    options.enable_webextensions = True
    options.enable_bidi = True
    options.add_argument('--disable-blink-features=AutomationControlled')
    options.add_argument('--no-sandbox') 
    options.add_argument('--disable-dev-shm-usage')
    options.add_argument('--disable-gpu')
    options.add_experimental_option('excludeSwitches', ['enable-automation'])  
    options.add_experimental_option('useAutomationExtension', False)
    options.add_experimental_option("detach", True)
    driver = webdriver.Chrome(options=options)
    driver.webextension.install(extension_folder_path)
    driver.get(os.path.join(base_path, 'index.html'))
    
    global gdriver
    gdriver.append(driver)

def create_image():
    """트레이 아이콘으로 사용할 이미지를 생성합니다 (파란색 네모)"""
    # 실제 아이콘 파일이 있다면 Image.open("icon.png")를 사용하세요.
    image = Image.open('ico.png')
    
    return image

def on_open(icon, item):
    """'열기' 메뉴 클릭 시 브라우저 실행"""
    webbrowser.open("http://localhost:5000")

def on_open2(icon, item):
    openCustomSel()

def on_exit(icon, item):
    """'종료' 메뉴 클릭 시 앱 종료"""
    icon.stop()  # 트레이 아이콘 루프 종료
    # 메인 스레드가 종료되면 데몬 스레드인 Flask도 함께 종료됩니다.
    os._exit(0)  # 프로세스 강제 종료 (Flask 스레드 포함 확실히 끄기 위함)

def setup(icon):
    """아이콘 실행 후 초기 알림 전송"""
    icon.visible = True
    icon.notify("Flask 서버가 백그라운드에서 실행 중입니다.", "서버 시작됨")


if __name__ == "__main__":

    flask_thread = threading.Thread(target=run_flask_server, daemon=True)
    flask_thread.start()
    # 시스템 트레이 아이콘 생성 및 실행
    icon = Icon("FlaskServer", 
                create_image(), 
                "Flask Local Server", 
                menu=Menu(
                    MenuItem('타이머 열기', on_open, default=True),
                    MenuItem('모니터링 브라우저 열기', on_open2),
                    MenuItem('종료', on_exit)
                ))
    webbrowser.open("http://localhost:5000")
    openCustomSel()
    # 트레이 아이콘 실행 (이 함수는 블로킹되므로 마지막에 호출해야 함)
    # setup 콜백을 통해 실행 직후 알림을 보냅니다.
    icon.run(setup)