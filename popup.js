document.addEventListener('DOMContentLoaded', () => {
    const notesList = document.getElementById('notes-list');
    const exportAllButton = document.getElementById('export-all');

    function renderNotes() {
        chrome.storage.local.get({ highlights: [] }, (data) => {
            const highlights = data.highlights;
            notesList.innerHTML = '';
            if (highlights.length > 0) {
                const groupedByUrl = highlights.reduce((acc, highlight) => {
                    (acc[highlight.url] = acc[highlight.url] || []).push(highlight);
                    return acc;
                }, {});

                for (const url in groupedByUrl) {
                    const urlContainer = document.createElement('div');
                    urlContainer.innerHTML = `<h3>${url} <button class="export-site" data-url="${url}">Export</button></h3>`;
                    notesList.appendChild(urlContainer);

                    const siteNotesList = document.createElement('ul');
                    groupedByUrl[url].forEach((highlight) => {
                        const li = document.createElement('li');
                        li.innerHTML = `
                          <div class="note">
                            <p><strong>${highlight.text || 'Drawing'}</strong></p>
                            <p>${highlight.note}</p>
                          </div>
                          <button class="delete-note" data-timestamp="${highlight.timestamp}">Delete</button>
                        `;
                        siteNotesList.appendChild(li);
                    });
                    notesList.appendChild(siteNotesList);
                }

                document.querySelectorAll('.delete-note').forEach(button => {
                    button.addEventListener('click', (e) => {
                        const timestamp = e.target.dataset.timestamp;
                        chrome.runtime.sendMessage({ action: "deleteHighlight", timestamp: timestamp }, (response) => {
                            if (response.status === "success") {
                                renderNotes();
                            }
                        });
                    });
                });

                document.querySelectorAll('.export-site').forEach(button => {
                    button.addEventListener('click', (e) => {
                        const url = e.target.dataset.url;
                        exportNotes(url);
                    });
                });

            } else {
                notesList.innerHTML = '<li>No notes saved yet.</li>';
            }
        });
    }

    function exportNotes(url = null) {
        chrome.storage.local.get({ highlights: [] }, (data) => {
            let highlightsToExport = data.highlights;
            if (url) {
                highlightsToExport = highlightsToExport.filter(h => h.url === url);
            }
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(highlightsToExport, null, 2));
            const downloadAnchorNode = document.createElement('a');
            downloadAnchorNode.setAttribute("href", dataStr);
            downloadAnchorNode.setAttribute("download", "highlights.json");
            document.body.appendChild(downloadAnchorNode);
            downloadAnchorNode.click();
            downloadAnchorNode.remove();
        });
    }

    exportAllButton.addEventListener('click', () => exportNotes());

    renderNotes();
});