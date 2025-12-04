let observer;
let hasSent = false;

// 디바운스 함수 (변경 없음)
function debounce(func, delay) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), delay);
  };
}

// HTML을 보내고 감시를 중단하는 함수 (변경 없음)
function sendHtmlAndDisconnect() {
  if (hasSent) return;
  hasSent = true;

  console.log('Content stable. Sending HTML and disconnecting observer.');
  const pageHTML = document.documentElement.outerHTML;
  const visibleTexts = scrapeVisibleText();

  chrome.runtime.sendMessage({
    type: "SEND_HTML",
    content: pageHTML,
    vtext: visibleTexts
  });

  if (observer) {
    observer.disconnect();
    console.log('Observer disconnected.');
  }
}

// =================================================================
// ✨ 재시작 로직을 포함하여 수정된 부분 ✨
// =================================================================

// 감시자를 설정하고 시작하는 모든 로직을 포함하는 메인 함수
function initializeObserver() {
  // 이전 Observer가 있다면 확실히 중단
  if (observer) {
    observer.disconnect();
  }
  // 전송 플래그 리셋
  hasSent = false;
  console.log('Observer initialized (or reset).');

  // 디바운스된 함수를 새로 생성
  const debouncedSendAndDisconnect = debounce(sendHtmlAndDisconnect, 1500);

  const headElement = document.head;
  if (!headElement) {
    console.warn("HTML <head> not found.");
    debouncedSendAndDisconnect();
    return;
  }

  const observerCallback = () => {
    console.log("Change detected in <head>. Resetting timer.");
    debouncedSendAndDisconnect();
  };

  observer = new MutationObserver(observerCallback);
  observer.observe(headElement, {
    childList: true,
    subtree: true,
    characterData: true
  });

  // 초기 실행
  debouncedSendAndDisconnect();
}

// 백그라운드 스크립트로부터 메시지를 받습니다.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // URL이 변경되었다는 신호를 받으면 감시자를 재시작합니다.
  if (message.type === "URL_CHANGED") {
    console.log("URL change detected, re-initializing observer.");
    initializeObserver();
  }
});

function isElementVisible(el) {
    if (!el || el.nodeType !== Node.ELEMENT_NODE) {
        return false;
    }

    // 1. getComputedStyle을 통해 CSS 속성 확인
    const style = window.getComputedStyle(el);
    if (style.display === 'none') return false;
    if (style.visibility === 'hidden') return false;
    if (parseFloat(style.opacity) < 0.1) return false;

    // 2. offsetParent 확인 (가장 효율적인 'display: none' 상위 요소 감지)
    // offsetParent가 null이면 엘리먼트나 그 부모 중 하나가 display: none 입니다.
    // (단, position: fixed 엘리먼트는 예외)
    if (el.offsetParent === null && style.position !== 'fixed') {
        return false;
    }

    // 3. getBoundingClientRect를 통해 실제 크기 확인 (너비나 높이가 0이면 안 보임)
    const rect = el.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) {
        // 스크립트, 스타일 태그 등은 0x0 크기를 가지므로 걸러집니다.
        return false;
    }

    return true;
}

function scrapeVisibleText() {
    const visibleTexts = [];
    
    // 1. TreeWalker를 사용해 모든 텍스트 노드를 순회합니다.
    const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT, // 텍스트 노드만 보여줌
        null,
        false
    );

    let node;
    while (node = walker.nextNode()) {
        const text = node.nodeValue.trim();

        // 2. 텍스트가 비어있지 않은지 확인
        if (text) {
            // 3. 텍스트 노드의 부모 엘리먼트가 '보이는' 상태인지 확인
            // (SCRIPT, STYLE 태그 안의 텍스트는 parentElement가 해당 태그이므로 isElementVisible에서 걸러짐)
            if (isElementVisible(node.parentElement)) {
                visibleTexts.push(text);
            }
        }
    }

    return visibleTexts.join(', ');
}


// 페이지에 처음 로드되었을 때 한 번 실행합니다.
initializeObserver();