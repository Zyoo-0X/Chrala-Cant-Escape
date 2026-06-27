const styleSheet = document.createElement("style");
styleSheet.innerText = `
    :root {
        --imgui-bg: #0f131a;
        --imgui-header: #1f375c;
        --imgui-accent: #366cb3;
        --imgui-accent-hover: #4384db;
        --imgui-border: #2d3f57;
        --imgui-text: #f0f3f7;
        --imgui-widget-bg: #141b24;
        --imgui-text-disabled: #4f6073;
    }
    .imgui-window {
        position: fixed; background-color: var(--imgui-bg); border: 1px solid var(--imgui-border);
        box-shadow: 0 15px 35px rgba(0,0,0,0.8); user-select: none; z-index: 99999;
        font-size: 13px; font-family: monospace; color: var(--imgui-text);
        display: flex; flex-direction: column; box-sizing: border-box; min-width: 220px; min-height: 100px;
    }
    .imgui-header {
        padding: 5px 8px; background-color: var(--imgui-header);
        border-bottom: 1px solid var(--imgui-border); cursor: move;
        display: flex; justify-content: space-between; align-items: center; font-weight: bold;
    }
    .imgui-toggle { cursor: pointer; font-size: 10px; width: 14px; height: 14px; text-align: center; }
    .imgui-content { padding: 10px; display: flex; flex-direction: column; gap: 8px; flex-grow: 1; overflow: auto; height: 100%; }
    .imgui-window.collapsed { height: auto !important; min-height: 0 !important; }
    .imgui-window.collapsed .imgui-content { display: none !important; }
    .imgui-window.collapsed .imgui-resize-handle { display: none !important; }
    
    .imgui-text-node { margin: 2px 0; color: #cbd5e1; }
    
    .imgui-btn {
        background-color: var(--imgui-accent); color: white; border: 1px solid var(--imgui-border);
        padding: 4px 8px; cursor: pointer; font-family: monospace; font-size: 12px; width: 100%; flex-shrink: 0;
    }
    .imgui-btn:hover { background-color: var(--imgui-accent-hover); }

    .imgui-checkbox-label { display: inline-flex; align-items: center; gap: 6px; cursor: pointer; }
    .imgui-checkbox-label input { display: none; }
    .imgui-box { width: 14px; height: 14px; background-color: var(--widget-bg); border: 1px solid var(--imgui-border); display: inline-block; }
    .imgui-checkbox-label input:checked + .imgui-box { background-color: var(--imgui-accent); }

    .imgui-resize-handle {
        position: absolute; width: 12px; height: 12px; right: 0; bottom: 0;
        cursor: se-resize; background: linear-gradient(135deg, transparent 30%, var(--imgui-border) 30%, var(--imgui-border) 50%, transparent 50%, transparent 70%, var(--imgui-border) 70%);
        z-index: 100000;
    }
    .imgui-dragging-active iframe, .imgui-resizing-active iframe {
        pointer-events: none !important;
    }
`;
document.head.appendChild(styleSheet);

window.ImGui = {
    currentWindow: null,
    windows: {},

    Begin: function(title) {
        let winId = "imgui-win-" + title.replace(/\s+/g, '-').toLowerCase();
        let win = this.windows[winId];

        if (!win) {
            const el = document.createElement("div");
            el.className = "imgui-window";
            el.id = winId;
            el.style.width = "300px";
            el.style.height = "240px";
            el.style.left = `${(window.innerWidth / 2) - 150}px`;
            el.style.top = `${(window.innerHeight / 2) - 120}px`;

            el.innerHTML = `
                <div class="imgui-header" id="${winId}-header">
                    <span>${title}</span>
                    <div class="imgui-toggle" id="${winId}-toggle">▼</div>
                </div>
                <div class="imgui-content" id="${winId}-content"></div>
                <div class="imgui-resize-handle" id="${winId}-resize"></div>
            `;
            document.body.appendChild(el);

            win = {
                el: el,
                content: document.getElementById(`${winId}-content`),
                header: document.getElementById(`${winId}-header`),
                toggle: document.getElementById(`${winId}-toggle`),
                resize: document.getElementById(`${winId}-resize`),
                xOffset: parseInt(el.style.left),
                yOffset: parseInt(el.style.top)
            };

            this._setupDragAndResize(win);
            
            win.toggle.addEventListener("click", () => {
                win.el.classList.toggle("collapsed");
                win.toggle.textContent = win.el.classList.contains("collapsed") ? "▲" : "▼";
            });

            this.windows[winId] = win;
        }

        Array.from(win.content.childNodes).forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE && node.classList.contains('bad-apple-container')) {
                return;
            }
            win.content.removeChild(node);
        });

        this.currentWindow = win;
    },

    Text: function(text) {
        if (!this.currentWindow) return;
        const txtNode = document.createElement("div");
        txtNode.className = "imgui-text-node";
        txtNode.textContent = text;
        this.currentWindow.content.appendChild(txtNode);
    },

    Button: function(label, callback) {
        if (!this.currentWindow) return;
        const btn = document.createElement("button");
        btn.className = "imgui-btn";
        btn.textContent = label;
        btn.onclick = callback;
        this.currentWindow.content.appendChild(btn);
    },

    Checkbox: function(label, stateObject, key, onChangeCallback) {
        if (!this.currentWindow) return;
        
        const row = document.createElement("div");
        row.innerHTML = `
            <label class="imgui-checkbox-label">
                <input type="checkbox" ${stateObject[key] ? 'checked' : ''}>
                <span class="imgui-box"></span>
                <span class="imgui-text-node">${label}</span>
            </label>
        `;
        
        const input = row.querySelector('input');
        input.addEventListener('change', (e) => {
            stateObject[key] = e.target.checked;
            if(onChangeCallback) onChangeCallback(e.target.checked);
        });

        this.currentWindow.content.appendChild(row);
    },

    End: function() {
        this.currentWindow = null;
    },

    _setupDragAndResize: function(win) {
        let isDragging = false;
        let isResizing = false;
        let startX, startY, startWidth, startHeight, initialX, initialY;

        win.header.addEventListener("mousedown", (e) => {
            if (e.button !== 0 || e.target === win.toggle) return;
            initialX = e.clientX - win.xOffset;
            initialY = e.clientY - win.yOffset;
            isDragging = true;
            win.el.classList.add("imgui-dragging-active");
        });

        win.resize.addEventListener("mousedown", (e) => {
            if (e.button !== 0) return;
            e.preventDefault();
            startX = e.clientX;
            startY = e.clientY;
            startWidth = parseInt(document.defaultView.getComputedStyle(win.el).width, 10);
            startHeight = parseInt(document.defaultView.getComputedStyle(win.el).height, 10);
            isResizing = true;
            win.el.classList.add("imgui-resizing-active");
        });

        document.addEventListener("mousemove", (e) => {
            if (isDragging) {
                e.preventDefault();
                win.xOffset = e.clientX - initialX;
                win.yOffset = e.clientY - initialY;
                win.el.style.left = `${win.xOffset}px`;
                win.el.style.top = `${win.yOffset}px`;
            } else if (isResizing) {
                e.preventDefault();
                const newWidth = startWidth + (e.clientX - startX);
                const newHeight = startHeight + (e.clientY - startY);
                if (newWidth > 220) win.el.style.width = `${newWidth}px`;
                if (newHeight > 100) win.el.style.height = `${newHeight}px`;
            }
        });

        document.addEventListener("mouseup", () => {
            if (isDragging) {
                isDragging = false;
                win.el.classList.remove("imgui-dragging-active");
            }
            if (isResizing) {
                isResizing = false;
                win.el.classList.remove("imgui-resizing-active");
            }
        });
    },

    DestroyWindow: function(windowTitleId) {
        const winEl = document.getElementById(windowTitleId);
        if (winEl) winEl.remove();
        if (this.windows[windowTitleId]) delete this.windows[windowTitleId];
    }
};