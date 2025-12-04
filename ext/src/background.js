// 1. 네트워크 요청 감시: 요청 완료 시 탭 별 상태 코드 저장
chrome.webRequest.onCompleted.addListener(
  (details) => {
    if (details.type === "main_frame" && details.tabId >= 0) {
      // 탭 ID를 키(key)로 하여 상태 코드 저장 (메모리 스토리지)
      chrome.storage.session.set({ [details.tabId]: details.statusCode });
      console.log(`[Network] Tab ${details.tabId} saved status: ${details.statusCode}`);
    }
  },
  { urls: ["<all_urls>"] }
);

function getPageHTML() {
  return document.documentElement.outerHTML;
}
// 2. 탭이 닫히면 스토리지에서 데이터 정리 (메모리 누수 방지)
chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.storage.session.remove(tabId.toString());
});

function sendDataToServer(htmlContent, vtext, url, title) {
  const serverUrl = 'http://127.0.0.1:5000/save-html';
  fetch(serverUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, title, text: vtext, html: htmlContent }),
  })
  .then(res => res.json())
  .then(data => console.log('Server response:', data))
  .catch(err => console.error('Error sending data:', err));
}

// 3. 메시지 리스너 수정
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "SEND_HTML" && sender.tab) {
    const tabId = sender.tab.id;

    // 스토리지에서 해당 탭의 상태 코드를 가져옴 (비동기)
    chrome.storage.session.get([tabId.toString()], (result) => {
      const statusCode = result[tabId];

      if (statusCode && statusCode >= 200 && statusCode < 300) {
        console.log(`[Process] Valid status (${statusCode}). Sending data...`);
        sendDataToServer(message.content, message.vtext, sender.tab.url, sender.tab.title);
        sendResponse({ status: "success" }); // 응답 보냄
      } else {
        console.log(`[Process] Skipped. Invalid status or null: ${statusCode}`);
        sendResponse({ status: "skipped", code: statusCode });
      }
    });

    return true; // 비동기 작업(storage.get, fetch 등)을 기다린다는 신호
  }
});

chrome.webNavigation.onHistoryStateUpdated.addListener((details) => {
  // http, https 프로토콜에서만 작동하도록 필터링
  if (details.frameId === 0 && (details.url.startsWith('http') || details.url.startsWith('https'))) {
    console.log(`History state updated. New URL: ${details.url}`);
    // content script에게 URL이 변경되었음을 알립니다.
    chrome.tabs.sendMessage(details.tabId, { type: "URL_CHANGED" });
  }
});