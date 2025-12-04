# 📄 backend/flask_server.py (Waitress 적용)
from flask import Flask, request, jsonify, abort, Response, render_template, send_from_directory, stream_with_context
from flask_cors import CORS
from waitress import serve  # ✅ 추가
import os
import sys
from ai.proc.scrape import process_html
from ai.proc.manager import focus_manager
import ai.db.init
from ai.db.mani import DBHandle
import atexit
from pathwork import resource_path
from queue import Queue
import json

# Flask 앱 생성
app = Flask(__name__,
            static_folder=resource_path('front/dist/assets'),
            template_folder=resource_path('front/dist'))
CORS(app)


dbh = DBHandle()
CURRENTSESSION = 'currentSession.json'
def exitAction():
    terminate()
    dbh.closeConn()
atexit.register(exitAction)

msg_q = Queue()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/<path:path>')
def catch_all(path):
    # build 폴더 내의 정적 파일 요청인지 확인 (manifest.json, favicon.ico 등)
    file_path = os.path.join(resource_path('front/dist/assets'), path)
    if os.path.exists(file_path):
        return send_from_directory(resource_path('front/dist/assests'), path)
    
    # 그 외의 모든 경로는 index.html로 리다이렉트 (Client Side Routing)
    return render_template('index.html')

def run_flask_server():
    """Waitress 기반 Flask 서버 실행"""
    print("[INFO] Starting Waitress WSGI server on http://127.0.0.1:5000 ...")
    # ✅ Waitress는 기본 8스레드로 멀티요청 처리 가능
    serve(app, host="127.0.0.1", port=5000, threads=8)




@app.route("/api/new_session", methods=["POST"])
def new_session():
    if(os.path.exists(CURRENTSESSION)):
        return jsonify({"status": "failed", "message": "Session ongoing"}), 509
    data=request.get_json()
    goal = data.get('goal')
    if not goal:
        return jsonify({"Error: NO GOAL"}), 400
    
    curId = dbh.insertSessionMeta(data['duration'], data['goal'])
    dbh.getSessionList()
    try:
        with open(CURRENTSESSION, 'w') as f:
            json.dump({'curId' : curId, 'active' : True}, f, ensure_ascii=False, indent=4)
    except Exception as e:
        return jsonify({"error": f"Error: FILE/{e}"}), 500
    
    result = focus_manager.start_monitoring(data['goal'])

    return jsonify({"status": "success", "message": result})


@app.route("/api/end_session", methods=["POST"])
def end_session():
    print('end')
    data = request.get_json()
    duration = data.get('duration')
    try:
        if os.path.exists(CURRENTSESSION):
            os.remove(CURRENTSESSION)
            focus_manager.stop_monitoring()
            dbh.maniSessionMeta(duration)
            return jsonify({"status": "success", "message" : "Session terminated"})
        else:
            return jsonify({"status": "falied", "message" : "No Active Session"}), 400
    except Exception as e:
        return jsonify({"ERROR": f"FILE/ {e}"}), 500

@app.route("/api/terminate", methods=["GET"])
def terminate():
    print('termination')
    try:
        if os.path.exists(CURRENTSESSION):
            os.remove(CURRENTSESSION)
            focus_manager.stop_monitoring()
            return jsonify({"status": "success", "message" : "Session terminated"})
        else:
            return jsonify({"status": "falied", "message" : "No Active Session"}), 400
    except Exception as e:
        return jsonify({"ERROR": f"FILE/ {e}"}), 500

@app.route("/api/pause_session", methods=['GET'])
def pause_session():
    print('pause')
    try:
        with open(CURRENTSESSION, 'r') as f:
            data = json.load(f)
        data['active'] = False
        with open(CURRENTSESSION, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=4, ensure_ascii=False)

        return jsonify({"status": "success", "message" : "Session paused"})
    except Exception as e:
        return jsonify({"status": "failed", "message" : "pause failed"})

@app.route("/api/continue_session", methods=['GET'])
def continue_session():
    print('continue')
    try:
        with open(CURRENTSESSION, 'r') as f:
            data = json.load(f)
        data['active'] = True
        with open(CURRENTSESSION, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=4, ensure_ascii=False)

        return jsonify({"status": "success", "message" : "Session continues"})
    except Exception as e:
        return jsonify({"status": "failed", "message" : "continue failed"})


@app.route('/save-html', methods=['POST'])
def save_html():

    if not os.path.exists(CURRENTSESSION):
        abort(503, description="No active session")
    try:
        with open(CURRENTSESSION, 'r') as f:
            data = json.load(f)
    except Exception as e:
        abort(503, description="CURSES FILE ERROR")
    
    if(data['active'] != True):
        return jsonify({"status": "error", "message": "No Active Session"}), 503

    sid = data['curId']
    data = request.get_json()
    if not data or 'html' not in data:
        return jsonify({"status": "error", "message": "HTML content not found"}), 400

    pdata = process_html(data)

    page_url = pdata.get('url')
    page_title = pdata.get('title')
    page_meta = pdata.get('meta')
    page_body = pdata.get('body')

    page_data = {
        'url' : page_url,
        'title' : page_title,
        'meta' : page_meta,
        'body' : page_body
    }
    result = focus_manager.analyze_page(page_data)
    if(result['status'] == 'success'):
        eventType = False
        if(result['data']['is_focused']):
            eventType = True
        score = result['data']['score']
        topic = result['data']['matched_query']
        elapsed = result['data']['elapsed']
        if(result['data']['matched_query'] == 'Error'): 
            eventType = True

        emoji = "🔴" if score < 0.25 else "🟡" if score < 0.30 else "🟢"
        print(f"{emoji}: \t{score}\t{topic[:20]}\t{elapsed}s")
        sseData = {
            "is_focused": eventType, 
            "score": float(score), 
            "topic": topic
        }
        print('send stream')
        msg_q.put(json.dumps(sseData))
        dbh.insertEvent(sid, eventType, page_url, score, topic)
        dbh.getEventList(sid)
        return jsonify({"status": "success", "message": "HTML received"})
    
    return jsonify({"status": "error", "message": "analysis failed."}), 400

@app.route('/api/webpage-analysis/stream')
def stream():
    print('stream connection')
    def event_stream():
        # [핵심] 무한 루프를 돌면서 큐를 감시합니다.
        data = {
            "is_focused": True,
            "score": 1.0,
            "topic": "Connection Established"
        }
        yield f"data: {json.dumps(data)}\n\n"
        while True:
            # 1. queue.get()은 메시지가 들어올 때까지 여기서 '코드 실행을 멈추고 대기'합니다.
            #    (CPU를 쓰지 않고 효율적으로 기다립니다)
            msg = msg_q.get()
            print('got stream')
            # 2. 메시지가 도착하면 yield로 프론트엔드에 발사!
            yield f"data: {msg}\n\n"
            
    return Response(stream_with_context(event_stream()), mimetype='text/event-stream')



@app.route('/api/get_session_list', methods=['GET'])
def get_session_list():
    try:
        return jsonify(dbh.get_sessions())
    except Exception as e:
        print('bad', e)
        return jsonify({"ERROR": f"GET_SESSION_LIST/ {e}"}), 500
    

@app.route('/api/get_event_list', methods=['POST'])
def get_event_list():
    try:
        data = request.get_json()
        sid = data.get('session_id')
        return(dbh.get_sid_session(sid))
    except Exception as e:
        print('bad', e)
        return jsonify({"ERROR": f"GET_EVENT_LIST/ {e}"}), 500
    
@app.route('/api/get_config', methods=['GET'])
def get_config():
    try:
        with open('settings.json', 'r') as f:
            data = json.load(f)
        return json.dumps(data)
    except Exception as e:
        print('bad', e)
        return jsonify({"ERROR": f"GET_CONFIG/ {e}"}), 500

@app.route('/api/set_config', methods=['POST'])
def set_config():
    try:
        data = request.get_json()
        config = {
            "APIKEY" : data.get("APIKEY"),
            "WHITE" : data.get("WHITE"),
            "BLACK" : data.get("BLACK")
        }
        with open('settings.json', 'w', encoding='utf-8') as f:
            json.dump(config, f, ensure_ascii=False, indent=4)
        return({"status": "success", "message": "Config Saved"})
    except Exception as e:
        print('bad', e)
        return jsonify({"ERROR": f"SET_CONFIG/ {e}"}), 500