@echo off
:: 한글 깨짐 방지 (필요 시 주석 해제)
:: chcp 65001

echo ==================================================
echo 가상 환경을 확인하고 필요한 패키지를 설치합니다...
echo ==================================================

:: 1. 현재 배치 파일이 있는 디렉토리로 이동
cd /d "%~dp0"

:: 2. 가상 환경 폴더('venv')가 없으면 생성
if not exist "venv" (
    echo 가상환경 생성...
    python -m venv venv
)

:: 3. 가상 환경 활성화
call venv\Scripts\activate

:: 4. pip 업그레이드 (선택 사항)
python -m pip install --upgrade pip

:: 5. 의존 패키지 설치
if exist "requirements.txt" (
    echo 디펜던시 설치...
    pip install -r requirements.txt
) else (
    echo requirements.txt 없음
)

echo ==================================================
echo Main.py start
echo ==================================================
echo.

:: 6. 파이썬 코드 실행 (메인 파일명이 main.py가 아니면 수정하세요)
python main.py

echo.
echo ==================================================
echo Goodbye
echo ==================================================
if exist "currentSession.json" del /f /q "currentSession.json"
pause