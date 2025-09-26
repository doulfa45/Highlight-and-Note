let miniPopup = null;
let activeTool = null; // 'felt-pen', 'pen', 'text'

function getXPath(element) {
    if (element.id !== '') {
        return 'id("' + element.id + '")';
    }
    if (element === document.body) {
        return element.tagName.toLowerCase();
    }

    let ix = 0;
    const siblings = element.parentNode.childNodes;
    for (let i = 0; i < siblings.length; i++) {
        const sibling = siblings[i];
        if (sibling === element) {
            return getXPath(element.parentNode) + '/' + element.tagName.toLowerCase() + '[' + (ix + 1) + ']';
        }
        if (sibling.nodeType === 1 && sibling.tagName === element.tagName) {
            ix++;
        }
    }
}

function showNotePopup(x, y, selection) {
    const popup = document.createElement('div');
    popup.className = 'note-popup';
    popup.style.left = `${x}px`;
    popup.style.top = `${y}px`;

    const noteInput = document.createElement('textarea');
    noteInput.placeholder = 'Enter your note...';
    popup.appendChild(noteInput);

    const saveButton = document.createElement('button');
    saveButton.textContent = 'Save';
    saveButton.onclick = () => {
        const range = selection.getRangeAt(0);
        const startContainer = range.startContainer;
        const parentElement = startContainer.nodeType === 3 ? startContainer.parentNode : startContainer;
        const xpath = getXPath(parentElement);

        const data = {
            text: selection.toString(),
            note: noteInput.value,
            url: window.location.href,
            xpath: xpath,
            timestamp: new Date().toISOString()
        };

        chrome.runtime.sendMessage({ action: "saveHighlight", data: data }, (response) => {
            if (response.status === "success") {
                highlightSelection(selection, data.note);
                document.body.removeChild(popup);
            }
        });
    };
    popup.appendChild(saveButton);

    document.body.appendChild(popup);
}

function highlightSelection(selection, note) {
    const range = selection.getRangeAt(0);
    const mark = document.createElement('mark');
    mark.className = 'highlight';
    mark.title = note;
    range.surroundContents(mark);
}

function applyHighlights() {
    chrome.storage.local.get({ highlights: [] }, (data) => {
        const highlights = data.highlights.filter(h => h.url === window.location.href);
        highlights.forEach(highlight => {
            try {
                const result = document.evaluate(highlight.xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
                const element = result.singleNodeValue;
                if (element) {
                    const textNodes = [];
                    const treeWalker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null, false);
                    while (treeWalker.nextNode()) {
                        if(treeWalker.currentNode.nodeValue.includes(highlight.text)) {
                            textNodes.push(treeWalker.currentNode);
                        }
                    }

                    textNodes.forEach(textNode => {
                        const text = textNode.nodeValue;
                        const index = text.indexOf(highlight.text);
                        if (index !== -1) {
                            const before = text.substring(0, index);
                            const after = text.substring(index + highlight.text.length);

                            const mark = document.createElement('mark');
                            mark.className = 'highlight';
                            mark.title = highlight.note;
                            mark.textContent = highlight.text;

                            const afterNode = document.createTextNode(after);
                            textNode.nodeValue = before;
                            textNode.parentNode.insertBefore(mark, textNode.nextSibling);
                            textNode.parentNode.insertBefore(afterNode, mark.nextSibling);
                        }
                    });
                }
            } catch (e) {
                console.error("Error applying highlight:", e);
            }
        });
    });
}

function createMiniPopup() {
    miniPopup = document.createElement('div');
    miniPopup.className = 'mini-popup';
    miniPopup.innerHTML = `
        <div class="mini-popup-header">Tools</div>
        <div class="mini-popup-content">
            <img src="${chrome.runtime.getURL('images/felt-pen.png')}" id="felt-pen-tool" title="Felt Pen">
            <img src="${chrome.runtime.getURL('images/pen.png')}" id="pen-tool" title="Pen">
            <img src="${chrome.runtime.getURL('images/text.png')}" id="text-tool" title="Text">
        </div>
    `;
    document.body.appendChild(miniPopup);

    dragElement(miniPopup);

    document.getElementById('felt-pen-tool').addEventListener('click', () => {
        activeTool = 'felt-pen';
        document.body.style.cursor = 'crosshair';
        disableDrawing();
    });
    document.getElementById('pen-tool').addEventListener('click', () => {
        activeTool = 'pen';
        document.body.style.cursor = 'crosshair';
        enableDrawing();
    });
    document.getElementById('text-tool').addEventListener('click', () => {
        activeTool = 'text';
        document.body.style.cursor = 'text';
        disableDrawing();
    });
}

function dragElement(elmnt) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    const header = document.querySelector(`.${elmnt.className} .mini-popup-header`);
    if (header) {
        header.onmousedown = dragMouseDown;
    } else {
        elmnt.onmousedown = dragMouseDown;
    }

    function dragMouseDown(e) {
        e = e || window.event;
        e.preventDefault();
        pos3 = e.clientX;
        pos4 = e.clientY;
        document.onmouseup = closeDragElement;
        document.onmousemove = elementDrag;
    }

    function elementDrag(e) {
        e = e || window.event;
        e.preventDefault();
        pos1 = pos3 - e.clientX;
        pos2 = pos4 - e.clientY;
        pos3 = e.clientX;
        pos4 = e.clientY;
        elmnt.style.top = (elmnt.offsetTop - pos2) + "px";
        elmnt.style.left = (elmnt.offsetLeft - pos1) + "px";
    }

    function closeDragElement() {
        document.onmouseup = null;
        document.onmousemove = null;
    }
}

document.addEventListener('mouseup', (e) => {
    if (e.target.closest('.note-popup') || e.target.closest('.mini-popup')) {
        return;
    }
    const selection = window.getSelection();
    if (activeTool === 'text' && selection.toString().length > 0) {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        showNotePopup(rect.right + window.scrollX + 5, rect.top + window.scrollY, selection);
    } else if (activeTool === 'felt-pen' && selection.toString().length > 0) {
        const range = selection.getRangeAt(0);
        const startContainer = range.startContainer;
        const parentElement = startContainer.nodeType === 3 ? startContainer.parentNode : startContainer;
        const xpath = getXPath(parentElement);
        const data = {
            text: selection.toString(),
            note: '', // empty note for felt-pen
            url: window.location.href,
            xpath: xpath,
            timestamp: new Date().toISOString()
        };
        chrome.runtime.sendMessage({ action: "saveHighlight", data: data }, (response) => {
            if (response.status === "success") {
                highlightSelection(selection, '');
            }
        });
    }
});

let canvas, ctx, isDrawing = false;

function enableDrawing() {
    if (!canvas) {
        canvas = document.createElement('canvas');
        canvas.style.position = 'absolute';
        canvas.style.top = '0';
        canvas.style.left = '0';
        canvas.style.zIndex = '2147483646';
        canvas.style.pointerEvents = 'auto';
        document.body.appendChild(canvas);
        ctx = canvas.getContext('2d');
        window.addEventListener('resize', resizeCanvas);
        canvas.addEventListener('mousedown', startDrawing);
        canvas.addEventListener('mouseup', stopDrawing);
        canvas.addEventListener('mousemove', draw);
    }
    resizeCanvas();
    canvas.style.display = 'block';
}

function disableDrawing() {
    if (canvas) {
        canvas.style.display = 'none';
    }
}

function resizeCanvas() {
    canvas.width = document.body.scrollWidth;
    canvas.height = document.body.scrollHeight;
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
}

function startDrawing(e) {
    if (activeTool !== 'pen' || e.target !== canvas) return;
    isDrawing = true;
    ctx.beginPath();
    ctx.moveTo(e.pageX, e.pageY);
}

function stopDrawing(e) {
    if (activeTool !== 'pen' || !isDrawing) return;
    isDrawing = false;
    ctx.closePath();
}

function draw(e) {
    if (!isDrawing) return;
    ctx.lineTo(e.pageX, e.pageY);
    ctx.stroke();
}

window.addEventListener('load', () => {
    applyHighlights();
    createMiniPopup();
});