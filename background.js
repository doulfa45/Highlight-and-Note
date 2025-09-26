chrome.runtime.onInstalled.addListener(() => {
  console.log("Highlight and Note extension installed.");
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "saveHighlight") {
    chrome.storage.local.get({highlights: []}, (data) => {
      const highlights = data.highlights;
      highlights.push(request.data);
      chrome.storage.local.set({highlights: highlights}, () => {
        sendResponse({status: "success"});
      });
    });
    return true; // Indicates that the response is sent asynchronously
  } else if (request.action === "deleteHighlight") {
    chrome.storage.local.get({highlights: []}, (data) => {
      let highlights = data.highlights;
      highlights = highlights.filter(h => h.timestamp !== request.timestamp);
      chrome.storage.local.set({highlights: highlights}, () => {
        sendResponse({status: "success"});
      });
    });
    return true;
  }
});