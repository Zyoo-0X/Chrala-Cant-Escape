if (typeof JSZip === 'undefined') {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
    document.head.appendChild(script);
}

window.activeModsList = []; 
window.activeGameImages = [];
window.activeGameAudios = [];

if (typeof config === 'undefined') {
    window.config = {
        extraContentActive: false,
        showModWindow: false,
        showBadAppleWindow: false
    };
}

function cleanFilename(url) {
    if (!url) return '';
    let base = url.split('?')[0];
    return base.split('/').pop();
}

if (typeof window._SF === 'function' && !window._SF.isHooked) {
    const original_SF = window._SF;
    window._SF = function(_W6, _X6) {
        if (window.config && window.config.extraContentActive) {
            return true; 
        }
        return original_SF(_W6, _X6);
    };
    window._SF.isHooked = true;
}

if (typeof window.Image !== 'undefined' && !window.Image.isHooked) {
    const OriginalImage = window.Image;
    window.Image = function() {
        const img = new OriginalImage();
        window.activeGameImages.push(img);
        
        Object.defineProperty(img, 'src', {
            set: function(url) {
                if (url && !url.startsWith('blob:') && !this.hasAttribute('data-original-src')) {
                    this.setAttribute('data-original-src', url.split('?')[0]);
                }
                const originalSrc = this.getAttribute('data-original-src') || url;
                const filename = cleanFilename(originalSrc);
                let modWithAsset = window.activeModsList.find(mod => mod.assets.images[filename]);
                
                if (modWithAsset) {
                    this.setAttribute('src', modWithAsset.assets.images[filename]);
                } else {
                    this.setAttribute('src', url);
                }
            },
            get: function() { return this.getAttribute('src'); }
        });
        return img;
    };
    window.Image.isHooked = true;
}

if (typeof window.Audio !== 'undefined' && !window.Audio.isHooked) {
    const OriginalAudio = window.Audio;
    window.Audio = function(src) {
        const audio = new OriginalAudio();
        if (src && !src.startsWith('blob:')) audio.setAttribute('data-original-src', src.split('?')[0]);
        window.activeGameAudios.push(audio);
        
        Object.defineProperty(audio, 'src', {
            set: function(url) {
                if (url && !url.startsWith('blob:') && !this.hasAttribute('data-original-src')) {
                    this.setAttribute('data-original-src', url.split('?')[0]);
                }
                const originalSrc = this.getAttribute('data-original-src') || url;
                const filename = cleanFilename(originalSrc);
                let modWithAsset = window.activeModsList.find(mod => mod.assets.sounds[filename]);
                
                if (modWithAsset) {
                    this.setAttribute('src', modWithAsset.assets.sounds[filename]);
                } else {
                    this.setAttribute('src', url);
                }
            },
            get: function() { return this.getAttribute('src'); }
        });
        if (src) audio.src = src;
        return audio;
    };
    window.Audio.isHooked = true;
}

function refreshGameAssets() {
    window.activeGameImages = window.activeGameImages.filter(img => document.body.contains(img) || img.parentNode || img.src);
    window.activeGameImages.forEach(function(img) {
        const originalSrc = img.getAttribute('data-original-src');
        if (originalSrc) {
            const filename = cleanFilename(originalSrc);
            let modWithAsset = window.activeModsList.find(mod => mod.assets.images[filename]);
            img.src = modWithAsset ? modWithAsset.assets.images[filename] : originalSrc + "?t=" + Date.now();
        }
    });

    window.activeGameAudios.forEach(function(audio) {
        const originalSrc = audio.getAttribute('data-original-src');
        if (originalSrc) {
            const filename = cleanFilename(originalSrc);
            let modWithAsset = window.activeModsList.find(mod => mod.assets.sounds[filename]);
            const wasPlaying = !audio.paused;
            audio.src = modWithAsset ? modWithAsset.assets.sounds[filename] : originalSrc + "?t=" + Date.now();
            audio.load();
            if (wasPlaying) audio.play().catch(function(e){});
        }
    });
}

function addNewModToList() {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.izy';
    fileInput.onchange = function(event) {
        const file = event.target.files[0];
        if (!file) return;

        let existingIndex = window.activeModsList.findIndex(m => m.name === file.name);
        if (existingIndex !== -1) removeModFromList(window.activeModsList[existingIndex].id);

        const reader = new FileReader();
        reader.onload = function(e) {
            JSZip.loadAsync(e.target.result).then(function(zip) {
                let newMod = { id: Date.now(), name: file.name, assets: { config: {}, images: {}, sounds: {} } };
                let promises = [];

                zip.forEach(function (relativePath, zipEntry) {
                    const filename = zipEntry.name.split('/').pop();
                    if (!filename) return;

                    if (filename.toLowerCase() === "mods.json") {
                        promises.push(zipEntry.async("string").then(function(jsonText) {
                            try {
                                newMod.assets.config = JSON.parse(jsonText);
                                if (newMod.assets.config.settings && newMod.assets.config.settings.unlockExtraContent) config.extraContentActive = true;
                            } catch (err) {}
                        }));
                    }
                    if (/\.(png|jpg|jpeg)$/i.test(filename)) {
                        promises.push(zipEntry.async("blob").then(function (blob) { newMod.assets.images[filename] = URL.createObjectURL(blob); }));
                    }
                    if (/\.(mp3|ogg|wav)$/i.test(filename)) {
                        promises.push(zipEntry.async("blob").then(function (blob) { newMod.assets.sounds[filename] = URL.createObjectURL(blob); }));
                    }
                });

                Promise.all(promises).then(function() {
                    window.activeModsList.unshift(newMod);
                    refreshGameAssets();
                });
            }).catch(function() { alert("Failed to read .izy file!"); });
        };
        reader.readAsArrayBuffer(file);
    };
    fileInput.click();
}

function removeModFromList(modId) {
    let index = window.activeModsList.findIndex(m => m.id === modId);
    if (index !== -1) {
        let mod = window.activeModsList[index];
        for (let key in mod.assets.images) URL.revokeObjectURL(mod.assets.images[key]);
        for (let key in mod.assets.sounds) URL.revokeObjectURL(mod.assets.sounds[key]);
        window.activeModsList.splice(index, 1);
        if (window.activeModsList.length === 0) config.extraContentActive = false;
        refreshGameAssets(); 
    }
}

function renderInterfaceLoop() {
    ImGui.Begin("Cheats Menu - By Zyoo_0X");
    ImGui.Checkbox("Unlock Extra Content", config, "extraContentActive");

    const toggleModLabel = config.showModWindow ? "Mod Manager" : "Mod Manager";
    ImGui.Button(toggleModLabel, function() {
        config.showModWindow = !config.showModWindow; 
        if (!config.showModWindow) ImGui.DestroyWindow("imgui-win-mod-manager");
    });

    const toggleAppleLabel = config.showBadAppleWindow ? "Bad Apple" : "Bad Apple";
    ImGui.Button(toggleAppleLabel, function() {
        config.showBadAppleWindow = !config.showBadAppleWindow;
        if (!config.showBadAppleWindow) ImGui.DestroyWindow("imgui-win-bad-apple-player");
    });
    ImGui.End();

    if (config.showModWindow) {
        ImGui.Begin("Mod Manager");
        ImGui.Text("Active Loaded Mods:");
        if (window.activeModsList.length === 0) {
            ImGui.Text(" (No mods active) ");
        } else {
            window.activeModsList.forEach(function(mod) {
                ImGui.Text("- " + mod.name);
                ImGui.Button("Remove: " + mod.name, function() { removeModFromList(mod.id); });
            });
        }
        ImGui.Button("Add New Mod (.izy)", function() {
            if (typeof JSZip !== 'undefined') addNewModToList();
        });
        ImGui.End();
    }

    if (config.showBadAppleWindow) {
        ImGui.Begin("Bad Apple Player");
        if (ImGui.currentWindow) {
            let containerExist = ImGui.currentWindow.content.querySelector('.bad-apple-container');
            if (!containerExist) {
                const videoContainer = document.createElement("div");
                videoContainer.className = "bad-apple-container"; 
                videoContainer.style.width = "100%";
                videoContainer.style.height = "100%";
                videoContainer.style.backgroundColor = "#000";
                videoContainer.innerHTML = `
                    <iframe class="bad-apple-frame" src="https://badapple.mov/" style="width:100%; height:100%; border:none;" allow="autoplay; fullscreen"></iframe>
                `;
                ImGui.currentWindow.content.appendChild(videoContainer);
            }
        }
        ImGui.End();
    }
}

setInterval(function() {
    if (typeof ImGui !== 'undefined' && ImGui.Begin) {
        renderInterfaceLoop();
    }
}, 200);