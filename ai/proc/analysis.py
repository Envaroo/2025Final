import multiprocessing
import time
import torch
import numpy as np
import google.generativeai as genai
import json
from sentence_transformers import SentenceTransformer, util
from urllib.parse import urlparse
from pathwork import resource_path

# ==============================================================================
# 1. 설정 및 Mock 데이터 (API 키 없이 실행 가능하도록 설정)
# ==============================================================================
USE_REAL_API = True  # True일 경우 실제 Gemini/Embedding 모델 사용
with open('settings.json', 'r') as f:
    data = json.load(f)
GOOGLE_API_KEY = data['APIKEY']

if USE_REAL_API:
    genai.configure(api_key=GOOGLE_API_KEY)

WHITELIST = data['WHITE']
BLACKLIST = data['BLACK']

# ==============================================================================
# 2. Worker Process Class (별도 프로세스에서 실행됨)
# ==============================================================================

class FocusAnalysisProcess(multiprocessing.Process):
    def __init__(self, user_goal, task_queue, result_queue, status_event):
        """
        user_goal: 사용자가 입력한 초기 목표
        task_queue: 메인 프로세스에서 웹페이지 정보를 보내는 통로
        result_queue: 분석 결과를 메인 프로세스로 보내는 통로
        status_event: 초기화(모델 로드/쿼리 확장) 완료 신호
        """
        super().__init__()
        self.user_goal = user_goal
        self.task_queue = task_queue
        self.result_queue = result_queue
        self.status_event = status_event
        self.device = 'cuda' if torch.cuda.is_available() else 'cpu'
        if torch.backends.mps.is_available(): self.device = 'mps'

    def run(self):
        """프로세스 시작 진입점"""
        print(f"[Worker] 🚀 프로세스 시작 (PID: {self.pid})")
        
        # ---------------------------------------------------------
        # Step A. 모델 로드 및 초기화 (Heavy Task - 1회만 수행)
        # ---------------------------------------------------------
        print("[Worker] 1. 모델 로딩 중...")
        # 실제 환경에서는 모델 로드
        if USE_REAL_API:
            self.embed_model = SentenceTransformer(resource_path('./ai/emb'), device=self.device)
            self.genai_model = genai.GenerativeModel('gemini-2.5-flash')
        else:
            print("[Worker] (Mock 모드) 모델 로드 시뮬레이션")
            time.sleep(1) # 로딩 시간 흉내

        # ---------------------------------------------------------
        # Step B. 쿼리 확장 및 사전 임베딩 (Pre-computation - 1회만 수행)
        # ---------------------------------------------------------
        print(f"[Worker] 2. 목표 확장 수행: '{self.user_goal}'")
        expanded_queries = self._expand_goal(self.user_goal)
        print(f"[Worker]    -> 확장된 쿼리 목록: {expanded_queries}")

        print("[Worker] 3. 쿼리 벡터 사전 계산 (Pre-encoding)...")
        # 쿼리 벡터를 미리 계산해서 메모리에 상주시킴 (속도 핵심)
        self.cached_query_embeddings = self._pre_encode_queries(expanded_queries)
        
        # 메인 프로세스에게 "준비 완료" 신호 보냄
        print("[Worker] ✅ 준비 완료! 대기 중...")
        self.status_event.set()

        # ---------------------------------------------------------
        # Step C. 분석 루프 (반복 수행)
        # ---------------------------------------------------------
        while True:
            try:
                # 큐에서 작업 가져오기 (메인 프로세스가 줄 때까지 대기)
                task = self.task_queue.get()
                
                # 종료 신호 확인
                if task == "STOP":
                    print("[Worker] 종료 신호 수신. 프로세스를 종료합니다.")
                    break

            except Exception as e:
                print(f"[Worker] 에러 발생1: {e}")
                self.result_queue.put({"error": str(e)})   

            try:
                # 웹 페이지 분석 수행
                page_data = task
                start_t = time.time()
            except Exception as e:
                print(f"[Worker] 에러 발생2-1: {e}")
                self.result_queue.put({"error": str(e)})  

            if(self._is_white(page_data['url'])):
                result = {
                    "is_focused": True,
                    "score": 1,
                    "matched_query": "WHITELIST",
                    "elapsed": 0
                }
                self.result_queue.put(result)
                continue
            if(self._is_black(page_data['url'])):
                result = {
                    "is_focused": False,
                    "score": 0,
                    "matched_query": "BLACKLIST",
                    "elapsed": 0
                }
                self.result_queue.put(result)
                continue

            try:
                score, maxidx = self._calculate_similarity(page_data)
                elapsed = time.time() - start_t

            except Exception as e:
                print(f"[Worker] 에러 발생2-2: {e}")
                self.result_queue.put({"error": str(e)})      
            
            try:              
                # 결과 전송
                result = {
                    "is_focused": score >= 0.2394,
                    "score": score,
                    "matched_query": expanded_queries[maxidx] if score >= 0.2394 else "Distractive content",
                    "elapsed": elapsed
                }
                self.result_queue.put(result)
            except Exception as e:
                print(f"[Worker] 에러 발생3: {e}")
                self.result_queue.put({"error": str(e)})

    # --- 내부 헬퍼 메서드 ---

    def _expand_goal(self, goal):
        """
        사용자 목표를 받아 3~4개의 구체적인 하위 쿼리 리스트로 반환
        항상 [원본 쿼리]를 0번 인덱스에 포함시킴 (Anchor Query)
        """

        prompt = f"""
        Role: You are an expert in 'Semantic Network Analysis' and 'Knowledge Graph Construction'.

        Task: Deconstruct the User's Goal into 24 distinct "Semantic Anchors" to capture a wide range of relevant web content.
        An "Anchor" is a short, declarative statement (3-5 seconds reading time) representing content likely to be found on relevant web pages.

        User Goal: "{goal}"

        ***CRITICAL INSTRUCTION: LEXICAL DIVERSITY***
        Do NOT rely solely on the words present in the "User Goal". You must expand the vocabulary to include:
        1.  **Hierarchical Terms:** If the goal is "AI", you must include anchors about "Machine Learning", "Neural Networks", "Deep Learning", etc.
        2.  **Related Entities:** Specific libraries, tools, or famous authors related to the topic (e.g., "TensorFlow", "PyTorch", "Andrew Ng").
        3.  **Contextual Synonyms:** Words that naturally co-occur in the domain (e.g., for "Stock Analysis", use "Moving Average", "Candlestick Chart", "Volatility").

        Guidelines:
        1.  **Format:** Declarative, Factual, Descriptive phrases. (No Questions).
        2.  **Coverage:**
            - 8 Anchors: Broad/Conceptual definitions (High-level concepts).
            - 8 Anchors: Specific/Technical details (Sub-concepts, formulas, specific algorithms).
            - 8 Anchors: Practical/Tool-oriented context (Software, errors, implementation).
        3.  **Constraint:** Avoid repeating the exact main keywords of the User Goal in every anchor. Use pronouns or implied context to increase vector diversity.

        Output Format: JSON Array of strings ONLY. In english.
        """
        
        
        
        
        """
        
        Role: You are an expert in Web Content Classification.

        Task: Break down the User's Goal into 30 distinct "Semantic Anchors".
        An "Anchor" is NOT a search query (question). It is a short, declarative phrase or sentence that typically appears inside the target web pages.

        User Goal: "{goal}"

        Guidelines:
        1.  **Style:** Declarative, Factual, Descriptive. (Like a textbook heading or a Wikipedia summary sentence).
        2.  **Avoid:** Do not use question marks, "How to", "Help", or imperative verbs.
        3.  **Diversity:** Cover theoretical definitions, technical terminology, and practical application contexts.

        Example Idea (Goal: "Learn Python"):
        - Bad (Query): "How to install Python?"
        - Good (Anchor): "Step-by-step guide for installing Python environment on Windows and macOS."
        - Bad (Query): "Python list vs tuple"
        - Good (Anchor): "Differences between mutable Lists and immutable Tuples in Python data structures."

        Output Format: JSON Array of strings ONLY. In english.
           
        """
        
        
        
        """
        Role: You are an expert in 'Semantic Knowledge Representation' and Information Retrieval.

        Task: Deconstruct the User's Goal into 15 distinct semantic representations optimized for Vector Embedding Retrieval (RAG). 
        Instead of generating "search queries" (questions), generate "content descriptors" (phrases likely to appear in target documents).

        User Goal: "{goal}"

        Guidelines:
        1.  **Avoid Functional Noise:** Do not use words like "help", "assignment", "homework", "essay", or "solution" unless the goal is explicitly about finding a tutor. Focus on the *subject matter*.
        2.  **Diversity:** Generate phrases across three categories (5 queries each):
            * [Core Concepts]: Definitional and theoretical terminology (e.g., "Utility maximization logic").
            * [Contextual/Broad]: Related academic fields or real-world scenarios (e.g., "Market failure in public goods").
            * [Specific/Technical]: Deep technical terms, specific entities, or methodologies (e.g., "Lagrange multiplier method in economics").
        3.  **Format:** Generate a single JSON Array of strings containing all 15 phrases.

        Output Format: JSON Array of strings ONLY. No markdown. In english.
        """
        try:
            response = self.genai_model.generate_content(prompt)
            clean_text = response.text.replace("```json", "").replace("```", "").strip()
            expanded_list = json.loads(clean_text)
            
            # 원본 쿼리가 없으면 맨 앞에 추가 (Baseline 보장)
            if goal not in expanded_list:
                expanded_list.insert(0, goal)
            return expanded_list
            
        except Exception as e:
            return [goal]

    def _preprocess(self, text):
        return " ".join(text.split())[:1000] if text else ""
    
    def _pre_encode_queries(self, queries):
        """쿼리 리스트를 벡터로 변환 (1회 수행)"""
        # Prefix 추가
        formatted_queries = [f"{self._preprocess(q)}" for q in queries]
        return self.embed_model.encode(formatted_queries, prompt_name='Retrieval-query')


    def _calculate_similarity(self, page_data):
        """웹페이지 벡터화 및 미리 계산된 쿼리 벡터와 비교"""
        title = self._preprocess(page_data.get('title', ''))
        meta = self._preprocess(page_data.get('meta', ''))
        body = self._preprocess(page_data.get('body', ''))
        
        doc_text = f"{meta}{body}"
        print("[EMBED]")
        print(f"TITLE:\t{title}\nMETA:\t{meta}\nBODY:\t{body[:300]}")
        # 1. 문서만 인코딩 (쿼리는 이미 self.cached_query_embeddings에 있음)
        doc_emb = self.embed_model.encode(doc_text, prompt=f"title: {title} | text: ")
        
        # 2. 행렬 곱 (Query Batch x Document)
        # doc_emb가 (768,) 이면 (1, 768)로 변경 필요할 수 있음
        scores = self.embed_model.similarity(self.cached_query_embeddings, doc_emb).numpy().flatten()
        
        # 3. Max Pooling
        max_idx = np.argmax(scores)
        best_score = float(scores[max_idx])
        return best_score, max_idx
    
    from urllib.parse import urlparse

    def _is_white(self, url):
        return check_list(url, WHITELIST)


    def _is_black(self, url):
        return check_list(url, BLACKLIST)

def normalize_url(url):
    if not url.startswith(('http://', 'https://')):
        url = 'http://' + url  # 파싱을 위해 임시 스키마 추가
    
    parsed = urlparse(url)
    # netloc(도메인) + path(경로)를 합치고, 끝의 '/'는 제거하여 표준화
    clean_url = (parsed.netloc + parsed.path).rstrip('/')
    return parsed.netloc, clean_url

def check_list(input_url, list_data):

    input_domain, input_full_clean = normalize_url(input_url)

    for item in list_data:
        target_url = item['url']
        collective= item['collect']
        
        target_domain, target_full_clean = normalize_url(target_url)

        if collective:
            if input_domain == target_domain:
                return True
        else:
            if input_full_clean == target_full_clean:
                return True
                
    return False
