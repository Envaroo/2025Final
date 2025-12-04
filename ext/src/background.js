
// 현재 활성화된 탭의 상태 코드만 저장하는 단일 변수
let currentActiveStatusCode = null;
let currentActiveTabId = null;

// 1. 현재 어떤 탭이 활성화되어 있는지 추적
chrome.tabs.onActivated.addListener((activeInfo) => {
  currentActiveTabId = activeInfo.tabId;
  currentActiveStatusCode = null; // 탭을 바꾸면 이전 상태 코드는 잊어버림 (초기화)
  console.log(`[Tab Switch] 활성 탭 변경됨: ${currentActiveTabId}`);
});

// 2. 네트워크 요청 감시: "활성 탭"에서 발생한 요청인 경우에만 상태 코드 업데이트
chrome.webRequest.onCompleted.addListener(
  (details) => {
    // 메인 프레임이고, 현재 활성화된 탭의 요청일 때만 저장
    if (details.type === "main_frame" && details.tabId === currentActiveTabId) {
      currentActiveStatusCode = details.statusCode;
      console.log(`[Network] 활성 탭(${details.tabId}) 상태 코드 갱신: ${currentActiveStatusCode}`);
    }
  },
  { urls: ["<all_urls>"] }
);


function getPageHTML() {
  return document.documentElement.outerHTML;
}

function sendDataToServer(htmlContent, vtext, url, title) {
  const serverUrl = 'http://127.0.0.1:5000/save-html';
  
  fetch(serverUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url: url,
      title: title,
      text: vtext,
      html: htmlContent 
    }),
  })
  .then(response => response.json())
  .then(data => {
    console.log('Server response:', data);
  })
  .catch(error => {
    console.error('Error sending data to server:', error);
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // 메시지 타입이 "SEND_HTML"일 경우에만 처리합니다.
  if (message.type === "SEND_HTML" && currentActiveStatusCode && currentActiveStatusCode >= 200 && currentActiveStatusCode < 300) {
    console.log("Received HTML content from content script.");
    console.log(message.vtext)
    sendDataToServer(message.content, message.vtext, sender.tab.url, sender.tab.title);
    return true; // 비동기 응답을 위해 true 반환
  }
});

// 탭이 로드 완료될 때
// 탭 정보가 업데이트될 때마다 이 리스너가 호출됩니다.
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // 탭 로딩이 완료되었고, URL이 http 또는 https로 시작하는지 확인합니다.
  if (changeInfo.status === 'complete' && tab.url && (tab.url.startsWith('http') || tab.url.startsWith('https'))) {
    /*
    chrome.scripting.executeScript({
      target: { tabId: tabId },
      function: getPageHTML
    }, (injectionResults) => {
      if (chrome.runtime.lastError || !injectionResults || !injectionResults[0]) {
        console.error("Script injection failed:", chrome.runtime.lastError);
        return;
      }
      
      const pageHTML = injectionResults[0].result;
      sendDataToServer(pageHTML);
      
    });*/
  
  }
});

/*
탭 전환될 때
chrome.tabs.onActivated.addListener(activeInfo => {
  chrome.tabs.get(activeInfo.tabId, (tab) => {
    sendUrlToFlask(tab.url, tab.title);
  });
});
*/

chrome.webNavigation.onHistoryStateUpdated.addListener((details) => {
  // http, https 프로토콜에서만 작동하도록 필터링
  if (details.frameId === 0 && (details.url.startsWith('http') || details.url.startsWith('https'))) {
    console.log(`History state updated. New URL: ${details.url}`);
    // content script에게 URL이 변경되었음을 알립니다.
    chrome.tabs.sendMessage(details.tabId, { type: "URL_CHANGED" });
  }
});