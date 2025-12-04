from bs4 import BeautifulSoup, Comment
import json

def extract_universal_content(html_doc: str) -> str:
    """
    다양한 웹페이지의 구조화된 데이터를 포함하여 콘텐츠를 추출합니다.
    """
    soup = BeautifulSoup(html_doc, 'lxml')
    # 추출한 정보를 저장할 딕셔너리
    page_info = {
        'description': '',
        'keywords': '',
    }

    # 2. <meta name="description"> 정보 추출
    # find()는 해당 태그가 없으면 None을 반환하므로, if문으로 확인하는 것이 안전합니다.
    meta_desc = soup.find('meta', attrs={'name': 'description'})
    if meta_desc:
        page_info['description'] = meta_desc.get('content', ' ')

    # 3. <meta name="keywords"> 정보 추출
    meta_keywords = soup.find('meta', attrs={'name': 'keywords'})
    if meta_keywords:
        page_info['keywords'] = meta_keywords.get('content', ' ')
        

    return page_info

from urllib.parse import urlparse

def is_youtube_url(url):

    # URL 파싱
    parsed_url = urlparse(url)
    
    # 도메인(netloc) 부분 추출 (예: www.youtube.com)
    domain = parsed_url.netloc.lower()
    
    # 'www.', 'm.' 등의 서브도메인 제거 (간단한 처리)
    if domain.startswith("www."):
        domain = domain[4:]
    if domain.startswith("m."):
        domain = domain[2:]
    
    # 유튜브 도메인 리스트 확인
    # youtube.com: 일반적인 PC/모바일 웹
    # youtu.be: 공유용 단축 URL
    valid_domains = ["youtube.com", "youtu.be"]
    if(domain in valid_domains and parsed_url.path in ['/watch', '/shorts']):
        return True
    else:
        return False

import yt_dlp

def get_video_info(url):
    """유튜브 비디오 정보를 텍스트로 추출하는 함수"""
    
    # 1. URL 유효성 검사
    if not is_youtube_url(url):
        return False

    # 2. yt-dlp 설정 (다운로드는 하지 않고 정보만 추출)
    ydl_opts = {
        'quiet': True,           # 불필요한 로그 출력 끄기
        'extract_flat': False,   # 전체 정보 가져오기
        'skip_download': True,   # 영상 다운로드 안 함
        'no_warnings': True,
    }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            # 정보 추출 (download=False 필수)
            info = ydl.extract_info(url, download=False)
            
            # 3. 필요한 정보만 딕셔너리로 정리
            video_data = {
                "title": info.get('title', ' '),
                "tags": info.get('tags', []),
                "description": info.get('description', ' ')[:1000] 
            }
            
            return video_data

    except Exception as e:
        return False



def process_html(response):
    extractedDict = dict()
    extractedDict['url'] = response['url']
    
    vMeta = get_video_info(response['url'])

    if vMeta:
        extractedDict['title'] = vMeta['title']
        extractedDict['meta'] = ','.join(vMeta['tags'])
        extractedDict['body'] = vMeta['description']

    else:
        extractedDict['title'] = response['title']
        extractedDict['body'] = response['text']
        unc = extract_universal_content(response['html'])
        extractedDict['meta'] = unc['description'] + unc['keywords']

    return extractedDict

    print(unc['body_text'])
    extracted = json.dumps(extractedDict, indent=4, ensure_ascii=False)
    with open("out.html", "w") as file:
        file.write(extracted)
    

