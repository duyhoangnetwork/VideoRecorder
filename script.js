// ==================== STATE ====================
const APP_STATE = {
    IDLE: 'IDLE',
    CAMERA_READY: 'CAMERA_READY',
    RECORDING: 'RECORDING',
    PAUSED: 'PAUSED',
    RECORDED: 'RECORDED'
};

let currentState = APP_STATE.IDLE;
let mediaStream = null;
let mediaRecorder = null;
let recordedChunks = [];
let recordedBlob = null;
let recordedUrl = null;
let cameraDevices = [];
let micDevices = [];
let currentAspectRatio = '16:9';
let selectedTextId = null;
let textCounter = 0;
let textLayers = [];
let recordingTimer = null;
let recordingSeconds = 0;
let isDragging = false;
let isResizing = false;
let dragData = null;
let currentTheme = 'dark';
let antiMirrorEnabled = true;
let currentFacingMode = 'unknown';
let outputStream = null;
let canvasAnimationFrame = null;
let canvasOutput = null;
let canvasCtx = null;
let isTextEditingMode = false;
let isEditingText = false;
let editingTextId = null;
let editingTextBackup = '';

// ==================== DOM ====================
const videoPreview = document.getElementById('cameraPreview');
const overlayLayer = document.getElementById('textOverlayLayer');
const cameraStage = document.getElementById('cameraStage');
const cameraWrapper = document.getElementById('cameraWrapper');
const cameraSelect = document.getElementById('cameraSelect');
const micSelect = document.getElementById('micSelect');
const antiMirrorCheckbox = document.getElementById('antiMirrorCheckbox');
const permissionOverlay = document.getElementById('permissionOverlay');
const permissionBtn = document.getElementById('permissionBtn');
const permissionHint = document.getElementById('permissionHint');
const addTextBtn = document.getElementById('addTextBtn');
const textList = document.getElementById('textList');
const videoNameInput = document.getElementById('videoNameInput');
const startRecordBtn = document.getElementById('startRecordBtn');
const pauseRecordBtn = document.getElementById('pauseRecordBtn');
const resumeRecordBtn = document.getElementById('resumeRecordBtn');
const stopRecordBtn = document.getElementById('stopRecordBtn');
const recordStatus = document.getElementById('recordStatus');
const recordingIndicator = document.getElementById('recordingIndicator');
const recordingTime = document.getElementById('recordingTime');
const recordedPanel = document.getElementById('recordedPanel');
const previewBtn = document.getElementById('previewBtn');
const downloadBtn = document.getElementById('downloadBtn');
const resetBtn = document.getElementById('resetBtn');
const recordedVideo = document.getElementById('recordedVideo');
const fullscreenBtn = document.getElementById('fullscreenBtn');
const themeToggleBtn = document.getElementById('themeToggleBtn');
const themeIcon = document.getElementById('themeIcon');
const toast = document.getElementById('toast');
const verticalGuide = document.getElementById('verticalGuide');
const horizontalGuide = document.getElementById('horizontalGuide');

// Text Controls Panel
const textControlsPanel = document.getElementById('textControlsPanel');
const fontSizeSlider = document.getElementById('fontSizeSlider');
const fontSizeValue = document.getElementById('fontSizeValue');
const opacitySlider = document.getElementById('opacitySlider');
const opacityValueDisplay = document.getElementById('opacityValueDisplay');

// Text editing overlay
const textEditOverlay = document.getElementById('textEditOverlay');
const cancelTextEditBtn = document.getElementById('cancelTextEditBtn');
const doneTextEditBtn = document.getElementById('doneTextEditBtn');
const textEditCameraWrapper = document.getElementById('textEditCameraWrapper');
const textEditCameraStage = document.getElementById('textEditCameraStage');
const textEditCameraPreview = document.getElementById('textEditCameraPreview');
const textEditOverlayLayer = document.getElementById('textEditOverlayLayer');
const textEditTitle = document.getElementById('textEditTitle');
const textareaGroup = document.getElementById('textareaGroup');
const editTextarea = document.getElementById('editTextarea');
const pasteTextBtn = document.getElementById('pasteTextBtn');

// ==================== INIT ====================
document.addEventListener('DOMContentLoaded', () => {
    loadSettings();
    setupEventListeners();
    checkCameraPermission();
    updateStageSize();
    window.addEventListener('resize', updateStageSize);
});

function setupEventListeners() {
    permissionBtn.addEventListener('click', requestCameraPermission);
    
    cameraSelect.addEventListener('change', switchCamera);
    micSelect.addEventListener('change', switchMicrophone);
    antiMirrorCheckbox.addEventListener('change', (e) => {
        antiMirrorEnabled = e.target.checked;
        localStorage.setItem('antiMirror', antiMirrorEnabled);
        updatePreviewMirror();
    });
    
    document.querySelectorAll('.ratio-btn').forEach(btn => {
        btn.addEventListener('click', () => setAspectRatio(btn.dataset.ratio));
    });
    
    addTextBtn.addEventListener('click', () => {
        addText('Văn bản mới');
        enterTextEditingMode();
    });
    
    // Slider controls
    fontSizeSlider.addEventListener('input', (e) => {
        if (!selectedTextId) return;
        const data = getTextData(selectedTextId);
        if (data) {
            data.fontSize = parseInt(e.target.value);
            fontSizeValue.textContent = data.fontSize + 'px';
            updateTextElement(data);
            saveTextLayers();
        }
    });
    
    opacitySlider.addEventListener('input', (e) => {
        if (!selectedTextId) return;
        const data = getTextData(selectedTextId);
        if (data) {
            data.opacity = parseInt(e.target.value) / 100;
            opacityValueDisplay.textContent = e.target.value + '%';
            updateTextElement(data);
            saveTextLayers();
        }
    });
    
    // Text editing overlay events
    cancelTextEditBtn.addEventListener('click', () => {
        if (isEditingText) cancelEditText();
        exitTextEditingMode();
    });
    
    doneTextEditBtn.addEventListener('click', () => {
        if (isEditingText) finishEditText();
        exitTextEditingMode();
    });
    
    // Nút Dán
    pasteTextBtn.addEventListener('click', handlePaste);
    
    // Textarea input
    editTextarea.addEventListener('input', handleTextareaInput);
    
    startRecordBtn.addEventListener('click', startRecording);
    pauseRecordBtn.addEventListener('click', pauseRecording);
    resumeRecordBtn.addEventListener('click', resumeRecording);
    stopRecordBtn.addEventListener('click', stopRecording);
    previewBtn.addEventListener('click', showRecordedPreview);
    downloadBtn.addEventListener('click', downloadVideo);
    resetBtn.addEventListener('click', resetRecording);
    
    fullscreenBtn.addEventListener('click', toggleFullscreen);
    themeToggleBtn.addEventListener('click', toggleTheme);
    
    document.addEventListener('click', () => {
        toast.classList.add('hidden');
    });

    // Xử lý chạm ra ngoài để deselect
    document.addEventListener('pointerdown', (e) => {
        if (!e.target.closest('.text-overlay') && !e.target.closest('.text-handle') && !e.target.closest('#textControlsPanel')) {
            deselectText();
        }
    });

    // Xử lý keyboard viewport
    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', handleVisualViewportResize);
    }
}

function handleVisualViewportResize() {
    if (isTextEditingMode) {
        const viewport = window.visualViewport;
        const textEditOverlayEl = document.getElementById('textEditOverlay');
        if (textEditOverlayEl && viewport.height < window.innerHeight) {
            textEditOverlayEl.style.height = viewport.height + 'px';
            textEditOverlayEl.style.position = 'fixed';
            textEditOverlayEl.style.top = '0';
        } else {
            textEditOverlayEl.style.height = '';
        }
    }
}

// ==================== STAGE SIZE ====================
function updateStageSize() {
    const stage = cameraStage;
    if (!stage) return;
    stage.style.aspectRatio = getRatioValue(currentAspectRatio);
}

function getRatioValue(ratio) {
    switch (ratio) {
        case '9:16': return '9/16';
        case '16:9': return '16/9';
        case '1:1': return '1/1';
        case '4:5': return '4/5';
        default: return '16/9';
    }
}

// ==================== PREVIEW MIRROR ====================
function updatePreviewMirror() {
    if (currentFacingMode === 'user') {
        videoPreview.classList.add('mirrored');
        if (textEditCameraPreview) {
            textEditCameraPreview.classList.add('mirrored');
        }
    } else {
        videoPreview.classList.remove('mirrored');
        if (textEditCameraPreview) {
            textEditCameraPreview.classList.remove('mirrored');
        }
    }
}

// ==================== CAMERA & MIC ====================
async function checkCameraPermission() {
    try {
        const result = await navigator.permissions.query({ name: 'camera' });
        if (result.state === 'granted') {
            await initCamera();
        } else if (result.state === 'prompt') {
            showPermissionOverlay(false);
        } else {
            showPermissionOverlay(true);
        }
    } catch (e) {
        showPermissionOverlay(false);
    }
}

function showPermissionOverlay(showHint) {
    permissionOverlay.classList.remove('hidden');
    if (showHint) {
        permissionHint.style.display = 'block';
    } else {
        permissionHint.style.display = 'none';
    }
}

async function requestCameraPermission() {
    try {
        permissionOverlay.classList.add('hidden');
        await initCamera();
    } catch (err) {
        console.error('Camera permission error:', err);
        showToast('Không thể truy cập camera. Hãy kiểm tra quyền camera của trình duyệt.');
        showPermissionOverlay(true);
    }
}

async function initCamera() {
    try {
        await loadDevices();
        
        const savedCameraId = localStorage.getItem('cameraId');
        const savedMicId = localStorage.getItem('microphoneId');
        
        let videoDeviceId = undefined;
        if (savedCameraId && cameraDevices.some(d => d.deviceId === savedCameraId)) {
            videoDeviceId = savedCameraId;
            cameraSelect.value = savedCameraId;
        } else if (cameraDevices.length > 0) {
            videoDeviceId = cameraDevices[0].deviceId;
            cameraSelect.value = videoDeviceId;
        }
        
        let audioDeviceId = undefined;
        if (savedMicId && micDevices.some(d => d.deviceId === savedMicId)) {
            audioDeviceId = savedMicId;
            micSelect.value = savedMicId;
        } else if (micDevices.length > 0) {
            audioDeviceId = micDevices[0].deviceId;
            micSelect.value = audioDeviceId;
        }
        
        const constraints = {
            video: videoDeviceId ? { deviceId: { exact: videoDeviceId }, width: { ideal: 1920 }, height: { ideal: 1080 } } : { width: { ideal: 1920 }, height: { ideal: 1080 } },
            audio: audioDeviceId ? { deviceId: { exact: audioDeviceId }, echoCancellation: true, noiseSuppression: true } : { echoCancellation: true, noiseSuppression: true }
        };
        
        mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
        videoPreview.srcObject = mediaStream;
        
        const videoTrack = mediaStream.getVideoTracks()[0];
        if (videoTrack) {
            const settings = videoTrack.getSettings();
            currentFacingMode = settings.facingMode || 'unknown';
        }
        
        updatePreviewMirror();
        currentState = APP_STATE.CAMERA_READY;
        updateUI();
        showToast('Camera đã sẵn sàng');
    } catch (err) {
        console.error('initCamera error:', err);
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
            showToast('Bạn chưa cấp quyền sử dụng camera.');
            showPermissionOverlay(true);
        } else if (err.name === 'NotFoundError') {
            showToast('Không tìm thấy camera. Vui lòng kiểm tra quyền truy cập camera.');
            showPermissionOverlay(true);
        } else {
            showToast('Không thể truy cập camera.');
        }
        throw err;
    }
}

async function loadDevices() {
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        cameraDevices = devices.filter(d => d.kind === 'videoinput');
        micDevices = devices.filter(d => d.kind === 'audioinput');
        
        cameraSelect.innerHTML = '';
        cameraDevices.forEach((device, index) => {
            const option = document.createElement('option');
            option.value = device.deviceId;
            option.textContent = device.label || `Camera ${index + 1}`;
            cameraSelect.appendChild(option);
        });
        
        micSelect.innerHTML = '';
        micDevices.forEach((device, index) => {
            const option = document.createElement('option');
            option.value = device.deviceId;
            option.textContent = device.label || `Microphone ${index + 1}`;
            micSelect.appendChild(option);
        });
        
        if (micDevices.length === 0) {
            showToast('Không tìm thấy microphone. Bạn vẫn có thể quay video không có âm thanh.');
        }
    } catch (err) {
        console.error('loadDevices error:', err);
    }
}

async function switchCamera() {
    if (currentState === APP_STATE.RECORDING || currentState === APP_STATE.PAUSED) {
        showToast('Không thể đổi camera khi đang quay');
        return;
    }
    try {
        if (mediaStream) {
            mediaStream.getTracks().forEach(track => track.stop());
        }
        const videoId = cameraSelect.value;
        const audioId = micSelect.value;
        localStorage.setItem('cameraId', videoId);
        
        const constraints = {
            video: videoId ? { deviceId: { exact: videoId }, width: { ideal: 1920 }, height: { ideal: 1080 } } : { width: { ideal: 1920 }, height: { ideal: 1080 } },
            audio: audioId ? { deviceId: { exact: audioId }, echoCancellation: true, noiseSuppression: true } : { echoCancellation: true, noiseSuppression: true }
        };
        mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
        videoPreview.srcObject = mediaStream;
        
        const videoTrack = mediaStream.getVideoTracks()[0];
        if (videoTrack) {
            const settings = videoTrack.getSettings();
            currentFacingMode = settings.facingMode || 'unknown';
        }
        
        updatePreviewMirror();
        if (currentState === APP_STATE.RECORDED) {
            currentState = APP_STATE.CAMERA_READY;
            updateUI();
        }
        showToast('Đã chuyển camera');
    } catch (err) {
        console.error('switchCamera error:', err);
        showToast('Không thể chuyển camera');
    }
}

async function switchMicrophone() {
    if (currentState === APP_STATE.RECORDING || currentState === APP_STATE.PAUSED) {
        showToast('Không thể đổi microphone khi đang quay');
        return;
    }
    try {
        if (mediaStream) {
            mediaStream.getAudioTracks().forEach(track => track.stop());
        }
        const videoId = cameraSelect.value;
        const audioId = micSelect.value;
        localStorage.setItem('microphoneId', audioId);
        
        const constraints = {
            video: videoId ? { deviceId: { exact: videoId }, width: { ideal: 1920 }, height: { ideal: 1080 } } : { width: { ideal: 1920 }, height: { ideal: 1080 } },
            audio: audioId ? { deviceId: { exact: audioId }, echoCancellation: true, noiseSuppression: true } : { echoCancellation: true, noiseSuppression: true }
        };
        mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
        videoPreview.srcObject = mediaStream;
        showToast('Đã chuyển microphone');
    } catch (err) {
        console.error('switchMicrophone error:', err);
        showToast('Không thể chuyển microphone');
    }
}

// ==================== ASPECT RATIO ====================
function setAspectRatio(ratio) {
    currentAspectRatio = ratio;
    document.querySelectorAll('.ratio-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.ratio === ratio);
    });
    
    localStorage.setItem('aspectRatio', ratio);
    updateStageSize();
    
    if (textEditCameraStage) {
        textEditCameraStage.style.aspectRatio = getRatioValue(ratio);
    }
    
    updateTextPositionsFromPercent();
}

// ==================== TEXT OVERLAY ====================
function addText(content = 'Văn bản mới') {
    const id = `text-${Date.now()}-${textCounter++}`;
    const textData = {
        id: id,
        content: content,
        xPercent: 50,
        yPercent: 50,
        fontSize: 24,
        opacity: 1,
        width: 200,
        height: 60,
        rotation: 0
    };
    
    textLayers.push(textData);
    createTextElement(textData);
    selectText(id);
    updateTextList();
    saveTextLayers();
    return id;
}

function createTextElement(data) {
    const el = document.createElement('div');
    el.className = 'text-overlay';
    el.id = data.id;
    el.style.position = 'absolute';
    el.style.left = `${data.xPercent}%`;
    el.style.top = `${data.yPercent}%`;
    el.style.transform = `translate(-50%, -50%) rotate(${data.rotation}deg)`;
    el.style.width = `${data.width}px`;
    el.style.height = `${data.height}px`;
    el.style.fontSize = `${data.fontSize}px`;
    el.style.opacity = data.opacity;
    el.style.fontWeight = 'bold';
    el.style.textShadow = '0 0 4px rgba(0,0,0,0.5)';
    el.style.cursor = 'move';
    el.style.userSelect = 'none';
    el.style.zIndex = '20';
    el.style.touchAction = 'none';
    el.dataset.textId = data.id;

    const textContent = document.createElement('div');
    textContent.className = 'text-content';
    textContent.textContent = data.content;
    textContent.style.width = '100%';
    textContent.style.height = '100%';
    textContent.style.display = 'flex';
    textContent.style.alignItems = 'center';
    textContent.style.justifyContent = 'center';
    textContent.style.wordBreak = 'break-word';
    textContent.style.whiteSpace = 'pre-wrap';
    textContent.style.cursor = 'move';
    textContent.style.userSelect = 'none';
    textContent.style.textAlign = 'center';
    textContent.style.outline = 'none';
    textContent.style.background = 'transparent';
    textContent.style.border = 'none';
    textContent.style.color = '#fff';
    textContent.style.font = 'inherit';
    textContent.style.resize = 'none';
    textContent.style.overflow = 'hidden';
    textContent.setAttribute('contenteditable', 'false');
    textContent.dataset.textContentId = data.id;
    el.appendChild(textContent);

    // Tạo 4 handle chính
    createHandle(el, 'edit', 'handle-edit', '✎');
    createHandle(el, 'rotate', 'handle-rotate', '↻');
    createHandle(el, 'resize', 'handle-resize', '↗');
    createHandle(el, 'delete', 'handle-delete', '🗑');

    // Sự kiện cho text content
    textContent.addEventListener('pointerdown', (e) => {
        if (e.target.closest('.text-handle')) return;
        e.preventDefault();
        e.stopPropagation();
        selectText(data.id);
        startDrag(e, data.id);
    });

    textContent.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        selectText(data.id);
        startEditText(data.id);
    });

    // Gán sự kiện cho từng handle
    const handleElements = el.querySelectorAll('.text-handle');
    handleElements.forEach(handle => {
        const handleType = handle.classList[1]?.replace('handle-', '');
        if (handleType === 'edit') {
            handle.addEventListener('pointerdown', (e) => {
                e.stopPropagation();
                selectText(data.id);
                startEditText(data.id);
            });
        } else if (handleType === 'rotate') {
            handle.addEventListener('pointerdown', (e) => startRotate(e, data.id));
        } else if (handleType === 'resize') {
            handle.addEventListener('pointerdown', (e) => startScaleResize(e, data.id));
        } else if (handleType === 'delete') {
            handle.addEventListener('pointerdown', (e) => {
                e.stopPropagation();
                selectText(data.id);
                deleteSelectedText();
            });
        }
    });

    overlayLayer.appendChild(el);
}

function createHandle(parent, type, className, icon) {
    const handle = document.createElement('div');
    handle.className = `text-handle ${className}`;
    handle.innerHTML = icon;
    handle.setAttribute('data-handle-type', type);
    handle.style.pointerEvents = 'auto';
    handle.style.touchAction = 'none';
    handle.setAttribute('aria-label', type);
    parent.appendChild(handle);
}

function updateTextElement(data) {
    const el = document.getElementById(data.id);
    if (el) {
        el.style.left = `${data.xPercent}%`;
        el.style.top = `${data.yPercent}%`;
        el.style.transform = `translate(-50%, -50%) rotate(${data.rotation}deg)`;
        el.style.width = `${data.width}px`;
        el.style.height = `${data.height}px`;
        el.style.fontSize = `${data.fontSize}px`;
        el.style.opacity = data.opacity;
        
        const textContent = el.querySelector('.text-content');
        if (textContent) {
            textContent.textContent = data.content;
        }
    }
    
    if (isTextEditingMode) {
        const editEl = document.getElementById(`edit-${data.id}`);
        if (editEl) {
            editEl.style.left = `${data.xPercent}%`;
            editEl.style.top = `${data.yPercent}%`;
            editEl.style.transform = `translate(-50%, -50%) rotate(${data.rotation}deg)`;
            editEl.style.width = `${data.width}px`;
            editEl.style.height = `${data.height}px`;
            editEl.style.fontSize = `${data.fontSize}px`;
            editEl.style.opacity = data.opacity;
            
            const editTextContent = editEl.querySelector('.text-content');
            if (editTextContent) {
                editTextContent.textContent = data.content;
            }
        }
    }
}

function selectText(id) {
    if (selectedTextId && selectedTextId !== id) {
        const prevEl = document.getElementById(selectedTextId);
        if (prevEl) prevEl.classList.remove('selected');
        if (isTextEditingMode) {
            const prevEditEl = document.getElementById(`edit-${selectedTextId}`);
            if (prevEditEl) prevEditEl.classList.remove('selected');
        }
    }
    selectedTextId = id;
    const el = document.getElementById(id);
    if (el) {
        el.classList.add('selected');
    }
    if (isTextEditingMode) {
        const editEl = document.getElementById(`edit-${id}`);
        if (editEl) editEl.classList.add('selected');
    }
    updateTextControlsPanel();
    updateTextList();
}

function deselectText() {
    if (selectedTextId) {
        const el = document.getElementById(selectedTextId);
        if (el) el.classList.remove('selected');
        if (isTextEditingMode) {
            const editEl = document.getElementById(`edit-${selectedTextId}`);
            if (editEl) editEl.classList.remove('selected');
        }
        selectedTextId = null;
        updateTextControlsPanel();
        updateTextList();
    }
}

function getTextData(id) {
    return textLayers.find(t => t.id === id);
}

function deleteSelectedText() {
    if (!selectedTextId) return;
    const el = document.getElementById(selectedTextId);
    if (el) el.remove();
    if (isTextEditingMode) {
        const editEl = document.getElementById(`edit-${selectedTextId}`);
        if (editEl) editEl.remove();
    }
    textLayers = textLayers.filter(t => t.id !== selectedTextId);
    selectedTextId = null;
    updateTextControlsPanel();
    updateTextList();
    saveTextLayers();
}

function updateTextList() {
    textList.innerHTML = '';
    textLayers.forEach((layer, index) => {
        const item = document.createElement('div');
        item.className = 'text-list-item';
        if (layer.id === selectedTextId) item.classList.add('active');
        item.innerHTML = `<span class="text-preview">${layer.content || 'Văn bản'}</span>`;
        item.addEventListener('click', () => {
            selectText(layer.id);
            enterTextEditingMode();
        });
        
        const visibilitySpan = document.createElement('span');
        visibilitySpan.className = 'text-visibility';
        visibilitySpan.textContent = '👁';
        visibilitySpan.addEventListener('click', (e) => {
            e.stopPropagation();
            const el = document.getElementById(layer.id);
            if (el) {
                el.style.display = el.style.display === 'none' ? 'block' : 'none';
            }
            if (isTextEditingMode) {
                const editEl = document.getElementById(`edit-${layer.id}`);
                if (editEl) {
                    editEl.style.display = editEl.style.display === 'none' ? 'block' : 'none';
                }
            }
        });
        item.appendChild(visibilitySpan);
        
        textList.appendChild(item);
    });
}

function updateTextControlsPanel() {
    if (selectedTextId) {
        textControlsPanel.classList.remove('hidden');
        const data = getTextData(selectedTextId);
        if (data) {
            fontSizeSlider.value = data.fontSize;
            fontSizeValue.textContent = data.fontSize + 'px';
            opacitySlider.value = data.opacity * 100;
            opacityValueDisplay.textContent = Math.round(data.opacity * 100) + '%';
        }
    } else {
        textControlsPanel.classList.add('hidden');
    }
}

// ==================== EDIT TEXT FUNCTIONALITY ====================
function startEditText(id) {
    const data = getTextData(id);
    if (!data) return;
    selectText(id);
    
    editingTextId = id;
    editingTextBackup = data.content;
    isEditingText = true;
    
    data.content = '';
    updateTextElement(data);
    updateTextList();
    saveTextLayers();
    
    textEditTitle.textContent = 'Nhập văn bản';
    textareaGroup.style.display = 'block';
    editTextarea.value = '';
    editTextarea.focus();
    
    const el = document.getElementById(id);
    if (el) el.classList.add('editing');
    if (isTextEditingMode) {
        const editEl = document.getElementById(`edit-${id}`);
        if (editEl) editEl.classList.add('editing');
    }
    // Ẩn panel controls khi đang edit
    textControlsPanel.classList.add('hidden');
}

function handleTextareaInput() {
    const data = getTextData(editingTextId);
    if (data) {
        data.content = editTextarea.value;
        updateTextElement(data);
        updateTextList();
        saveTextLayers();
    }
}

function finishEditText() {
    if (isEditingText) {
        isEditingText = false;
        const data = getTextData(editingTextId);
        if (data) {
            data.content = editTextarea.value;
            updateTextElement(data);
            updateTextList();
            saveTextLayers();
        }
        const el = document.getElementById(editingTextId);
        if (el) el.classList.remove('editing');
        if (isTextEditingMode) {
            const editEl = document.getElementById(`edit-${editingTextId}`);
            if (editEl) editEl.classList.remove('editing');
        }
        textEditTitle.textContent = 'Chỉnh văn bản';
        textareaGroup.style.display = 'none';
        editTextarea.value = '';
        editingTextId = null;
        editingTextBackup = '';
        // Hiện lại panel controls nếu có selected text
        if (selectedTextId) {
            textControlsPanel.classList.remove('hidden');
        }
    }
}

function cancelEditText() {
    if (isEditingText && editingTextId) {
        const data = getTextData(editingTextId);
        if (data) {
            data.content = editingTextBackup;
            updateTextElement(data);
            updateTextList();
            saveTextLayers();
        }
        const el = document.getElementById(editingTextId);
        if (el) el.classList.remove('editing');
        if (isTextEditingMode) {
            const editEl = document.getElementById(`edit-${editingTextId}`);
            if (editEl) editEl.classList.remove('editing');
        }
        textEditTitle.textContent = 'Chỉnh văn bản';
        textareaGroup.style.display = 'none';
        editTextarea.value = '';
        isEditingText = false;
        editingTextId = null;
        editingTextBackup = '';
        if (selectedTextId) {
            textControlsPanel.classList.remove('hidden');
        }
    }
}

async function handlePaste() {
    if (!isEditingText || !editingTextId) return;
    try {
        const text = await navigator.clipboard.readText();
        editTextarea.value += text;
        handleTextareaInput();
        editTextarea.focus();
        editTextarea.setSelectionRange(editTextarea.value.length, editTextarea.value.length);
    } catch (err) {
        showToast('Không thể truy cập nội dung đã copy. Hãy cho phép quyền Clipboard hoặc sử dụng Ctrl + V.');
    }
}

// ==================== TEXT EDITING MODE ====================
function enterTextEditingMode() {
    if (textLayers.length === 0) return;
    isTextEditingMode = true;
    
    textEditOverlayLayer.innerHTML = '';
    
    textLayers.forEach(data => {
        const el = document.createElement('div');
        el.className = 'text-overlay';
        el.id = `edit-${data.id}`;
        el.style.position = 'absolute';
        el.style.left = `${data.xPercent}%`;
        el.style.top = `${data.yPercent}%`;
        el.style.transform = `translate(-50%, -50%) rotate(${data.rotation}deg)`;
        el.style.width = `${data.width}px`;
        el.style.height = `${data.height}px`;
        el.style.fontSize = `${data.fontSize}px`;
        el.style.opacity = data.opacity;
        el.style.fontWeight = 'bold';
        el.style.textShadow = '0 0 4px rgba(0,0,0,0.5)';
        el.style.cursor = 'move';
        el.style.userSelect = 'none';
        el.style.zIndex = '20';
        el.style.touchAction = 'none';
        el.dataset.textId = data.id;
        
        const textContent = document.createElement('div');
        textContent.className = 'text-content';
        textContent.textContent = data.content;
        textContent.style.width = '100%';
        textContent.style.height = '100%';
        textContent.style.display = 'flex';
        textContent.style.alignItems = 'center';
        textContent.style.justifyContent = 'center';
        textContent.style.wordBreak = 'break-word';
        textContent.style.whiteSpace = 'pre-wrap';
        textContent.style.cursor = 'move';
        textContent.style.userSelect = 'none';
        textContent.style.textAlign = 'center';
        textContent.style.outline = 'none';
        textContent.style.background = 'transparent';
        textContent.style.border = 'none';
        textContent.style.color = '#fff';
        textContent.style.font = 'inherit';
        textContent.style.resize = 'none';
        textContent.style.overflow = 'hidden';
        textContent.setAttribute('contenteditable', 'false');
        el.appendChild(textContent);
        
        createHandle(el, 'edit', 'handle-edit', '✎');
        createHandle(el, 'rotate', 'handle-rotate', '↻');
        createHandle(el, 'resize', 'handle-resize', '↗');
        createHandle(el, 'delete', 'handle-delete', '🗑');
        
        textContent.addEventListener('pointerdown', (e) => {
            if (e.target.closest('.text-handle')) return;
            e.preventDefault();
            e.stopPropagation();
            selectText(data.id);
            startDrag(e, data.id);
        });
        
        textContent.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            selectText(data.id);
            startEditText(data.id);
        });
        
        const handleElements = el.querySelectorAll('.text-handle');
        handleElements.forEach(handle => {
            const handleType = handle.classList[1]?.replace('handle-', '');
            if (handleType === 'edit') {
                handle.addEventListener('pointerdown', (e) => {
                    e.stopPropagation();
                    selectText(data.id);
                    startEditText(data.id);
                });
            } else if (handleType === 'rotate') {
                handle.addEventListener('pointerdown', (e) => startRotate(e, data.id));
            } else if (handleType === 'resize') {
                handle.addEventListener('pointerdown', (e) => startScaleResize(e, data.id));
            } else if (handleType === 'delete') {
                handle.addEventListener('pointerdown', (e) => {
                    e.stopPropagation();
                    selectText(data.id);
                    deleteSelectedText();
                });
            }
        });
        
        textEditOverlayLayer.appendChild(el);
    });
    
    textEditCameraPreview.srcObject = videoPreview.srcObject;
    textEditCameraStage.style.aspectRatio = getRatioValue(currentAspectRatio);
    
    if (selectedTextId) {
        selectText(selectedTextId);
    } else if (textLayers.length > 0) {
        selectText(textLayers[0].id);
    }
    
    textEditOverlay.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function exitTextEditingMode() {
    isTextEditingMode = false;
    textEditOverlay.classList.add('hidden');
    document.body.style.overflow = '';
    
    textEditOverlayLayer.innerHTML = '';
    textEditCameraPreview.srcObject = null;
    
    if (isEditingText) {
        cancelEditText();
    }
    updateTextControlsPanel();
}

// ==================== DRAG & HANDLERS ====================
function startDrag(e, id) {
    if (e.target.closest('.text-handle')) return;
    e.preventDefault();
    e.stopPropagation();
    const data = getTextData(id);
    if (!data) return;
    selectText(id);
    
    const overlay = isTextEditingMode ? textEditOverlayLayer : overlayLayer;
    const rect = overlay.getBoundingClientRect();
    dragData = {
        type: 'drag',
        id: id,
        startX: e.clientX,
        startY: e.clientY,
        origXPercent: data.xPercent,
        origYPercent: data.yPercent,
        containerWidth: rect.width,
        containerHeight: rect.height
    };
    isDragging = true;
    
    document.addEventListener('pointermove', onDrag);
    document.addEventListener('pointerup', stopDrag);
    document.addEventListener('pointercancel', stopDrag);
}

function onDrag(e) {
    if (!isDragging || !dragData || dragData.type !== 'drag') return;
    e.preventDefault();
    
    const dx = e.clientX - dragData.startX;
    const dy = e.clientY - dragData.startY;
    
    const newXPercent = dragData.origXPercent + (dx / dragData.containerWidth) * 100;
    const newYPercent = dragData.origYPercent + (dy / dragData.containerHeight) * 100;
    
    const data = getTextData(dragData.id);
    if (data) {
        data.xPercent = Math.max(0, Math.min(100, newXPercent));
        data.yPercent = Math.max(0, Math.min(100, newYPercent));
        updateTextElement(data);
        checkSnap(data);
    }
}

function stopDrag() {
    isDragging = false;
    dragData = null;
    hideGuides();
    document.removeEventListener('pointermove', onDrag);
    document.removeEventListener('pointerup', stopDrag);
    document.removeEventListener('pointercancel', stopDrag);
    saveTextLayers();
}

function startScaleResize(e, id) {
    e.preventDefault();
    e.stopPropagation();
    const data = getTextData(id);
    if (!data) return;
    selectText(id);
    
    const overlay = isTextEditingMode ? textEditOverlayLayer : overlayLayer;
    const rect = overlay.getBoundingClientRect();
    dragData = {
        type: 'scale',
        id: id,
        startX: e.clientX,
        startY: e.clientY,
        origFontSize: data.fontSize,
        containerWidth: rect.width,
        containerHeight: rect.height
    };
    isResizing = true;
    
    document.addEventListener('pointermove', onScaleResize);
    document.addEventListener('pointerup', stopResize);
    document.addEventListener('pointercancel', stopResize);
}

function onScaleResize(e) {
    if (!isResizing || !dragData || dragData.type !== 'scale') return;
    e.preventDefault();
    const dx = e.clientX - dragData.startX;
    const dy = e.clientY - dragData.startY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const scale = distance / 50 + 1;
    const newSize = Math.max(12, Math.min(100, Math.round(dragData.origFontSize * scale)));
    
    const data = getTextData(dragData.id);
    if (data) {
        data.fontSize = newSize;
        updateTextElement(data);
        if (selectedTextId === data.id) {
            fontSizeSlider.value = newSize;
            fontSizeValue.textContent = newSize + 'px';
        }
    }
}

function startRotate(e, id) {
    e.preventDefault();
    e.stopPropagation();
    const data = getTextData(id);
    if (!data) return;
    selectText(id);
    
    const overlay = isTextEditingMode ? textEditOverlayLayer : overlayLayer;
    const rect = overlay.getBoundingClientRect();
    const centerX = rect.left + (data.xPercent / 100) * rect.width;
    const centerY = rect.top + (data.yPercent / 100) * rect.height;
    
    dragData = {
        type: 'rotate',
        id: id,
        startAngle: Math.atan2(e.clientY - centerY, e.clientX - centerX) * 180 / Math.PI,
        origRotation: data.rotation
    };
    isResizing = true;
    
    document.addEventListener('pointermove', onRotate);
    document.addEventListener('pointerup', stopResize);
    document.addEventListener('pointercancel', stopResize);
}

function onRotate(e) {
    if (!isResizing || !dragData || dragData.type !== 'rotate') return;
    e.preventDefault();
    
    const overlay = isTextEditingMode ? textEditOverlayLayer : overlayLayer;
    const rect = overlay.getBoundingClientRect();
    const data = getTextData(dragData.id);
    if (!data) return;
    const centerX = rect.left + (data.xPercent / 100) * rect.width;
    const centerY = rect.top + (data.yPercent / 100) * rect.height;
    const currentAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX) * 180 / Math.PI;
    let deltaAngle = currentAngle - dragData.startAngle;
    let newRotation = dragData.origRotation + deltaAngle;
    while (newRotation > 180) newRotation -= 360;
    while (newRotation < -180) newRotation += 360;
    
    const snapAngles = [0, 45, 90, 135, 180, -45, -90, -135, -180];
    for (const snap of snapAngles) {
        if (Math.abs(newRotation - snap) < 3) {
            newRotation = snap;
            break;
        }
    }
    
    data.rotation = Math.round(newRotation);
    updateTextElement(data);
}

function stopResize() {
    isResizing = false;
    dragData = null;
    document.removeEventListener('pointermove', onScaleResize);
    document.removeEventListener('pointermove', onRotate);
    document.removeEventListener('pointerup', stopResize);
    document.removeEventListener('pointercancel', stopResize);
    saveTextLayers();
}

function checkSnap(data) {
    const threshold = 5;
    let showV = false, showH = false;
    let vPos = 0, hPos = 0;
    
    if (Math.abs(data.xPercent - 50) < threshold) { data.xPercent = 50; showV = true; vPos = 50; }
    if (Math.abs(data.yPercent - 50) < threshold) { data.yPercent = 50; showH = true; hPos = 50; }
    if (Math.abs(data.xPercent - 0) < threshold) { data.xPercent = 0; showV = true; vPos = 0; }
    else if (Math.abs(data.xPercent - 100) < threshold) { data.xPercent = 100; showV = true; vPos = 100; }
    if (Math.abs(data.yPercent - 0) < threshold) { data.yPercent = 0; showH = true; hPos = 0; }
    else if (Math.abs(data.yPercent - 100) < threshold) { data.yPercent = 100; showH = true; hPos = 100; }
    
    if (showV) { verticalGuide.classList.remove('hidden'); verticalGuide.style.left = `${vPos}%`; }
    else verticalGuide.classList.add('hidden');
    
    if (showH) { horizontalGuide.classList.remove('hidden'); horizontalGuide.style.top = `${hPos}%`; }
    else horizontalGuide.classList.add('hidden');
    
    if (showV || showH) updateTextElement(data);
}

function hideGuides() {
    verticalGuide.classList.add('hidden');
    horizontalGuide.classList.add('hidden');
}

function updateTextPositionsFromPercent() {
    textLayers.forEach(data => updateTextElement(data));
}

// ==================== RECORDING ====================
function getSupportedMimeType() {
    const types = [
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm;codecs=vp9',
        'video/webm;codecs=vp8',
        'video/webm',
        'video/mp4'
    ];
    for (const type of types) {
        if (MediaRecorder.isTypeSupported(type)) return type;
    }
    return '';
}

function sanitizeFileName(name) {
    let clean = name.trim();
    clean = clean.replace(/[<>:"/\\|?*\x00-\x1F]/g, '');
    clean = clean.replace(/\s+/g, '-');
    if (!clean) {
        const now = new Date();
        clean = `DuyHoangNetwork-${now.toISOString().slice(0,10)}`;
    }
    return clean;
}

async function startRecording() {
    if (currentState !== APP_STATE.CAMERA_READY) {
        showToast('Camera chưa sẵn sàng');
        return;
    }
    
    if (isTextEditingMode) {
        exitTextEditingMode();
    }
    
    const mimeType = getSupportedMimeType();
    if (!mimeType || !window.MediaRecorder) {
        showToast('Trình duyệt không hỗ trợ quay video. Vui lòng sử dụng Chrome hoặc Edge phiên bản mới.');
        return;
    }
    
    try {
        recordedChunks = [];
        outputStream = await prepareRecordingStream();
        if (!outputStream) {
            outputStream = mediaStream;
        }
        
        mediaRecorder = new MediaRecorder(outputStream, { mimeType: mimeType });
        
        mediaRecorder.ondataavailable = (event) => {
            if (event.data && event.data.size > 0) {
                recordedChunks.push(event.data);
            }
        };
        
        mediaRecorder.onstop = () => {
            recordedBlob = new Blob(recordedChunks, { type: mimeType });
            recordedUrl = URL.createObjectURL(recordedBlob);
            currentState = APP_STATE.RECORDED;
            cleanupRecordingResources();
            updateUI();
            showToast('Video đã quay xong');
        };
        
        mediaRecorder.start(1000);
        currentState = APP_STATE.RECORDING;
        recordingSeconds = 0;
        startTimer();
        updateUI();
    } catch (err) {
        console.error('startRecording error:', err);
        showToast('Không thể bắt đầu quay video');
    }
}

async function prepareRecordingStream() {
    if (antiMirrorEnabled && currentFacingMode === 'user') {
        canvasOutput = document.createElement('canvas');
        canvasCtx = canvasOutput.getContext('2d');
        
        const videoTrack = mediaStream.getVideoTracks()[0];
        const settings = videoTrack.getSettings();
        canvasOutput.width = settings.width || 1280;
        canvasOutput.height = settings.height || 720;
        
        drawMirroredFrame();
        
        const canvasStream = canvasOutput.captureStream(30);
        const canvasVideoTrack = canvasStream.getVideoTracks()[0];
        const audioTracks = mediaStream.getAudioTracks();
        const newStream = new MediaStream([canvasVideoTrack, ...audioTracks]);
        
        const drawLoop = () => {
            if (currentState === APP_STATE.RECORDING || currentState === APP_STATE.PAUSED) {
                drawMirroredFrame();
                canvasAnimationFrame = requestAnimationFrame(drawLoop);
            }
        };
        canvasAnimationFrame = requestAnimationFrame(drawLoop);
        
        return newStream;
    }
    return mediaStream;
}

function drawMirroredFrame() {
    if (!canvasCtx || !canvasOutput || !videoPreview) return;
    canvasCtx.save();
    canvasCtx.translate(canvasOutput.width, 0);
    canvasCtx.scale(-1, 1);
    canvasCtx.drawImage(videoPreview, 0, 0, canvasOutput.width, canvasOutput.height);
    canvasCtx.restore();
}

function cleanupRecordingResources() {
    if (canvasAnimationFrame) {
        cancelAnimationFrame(canvasAnimationFrame);
        canvasAnimationFrame = null;
    }
    if (canvasOutput) {
        const stream = canvasOutput.captureStream();
        stream.getTracks().forEach(track => track.stop());
        canvasOutput = null;
        canvasCtx = null;
    }
    if (outputStream && outputStream !== mediaStream) {
        outputStream.getTracks().forEach(track => track.stop());
    }
    outputStream = null;
}

function pauseRecording() {
    if (currentState !== APP_STATE.RECORDING) return;
    mediaRecorder.pause();
    currentState = APP_STATE.PAUSED;
    stopTimer();
    updateUI();
}

function resumeRecording() {
    if (currentState !== APP_STATE.PAUSED) return;
    mediaRecorder.resume();
    currentState = APP_STATE.RECORDING;
    startTimer();
    updateUI();
}

function stopRecording() {
    if (currentState !== APP_STATE.RECORDING && currentState !== APP_STATE.PAUSED) return;
    mediaRecorder.stop();
    stopTimer();
    mediaStream.getTracks().forEach(track => track.stop());
    mediaStream = null;
    videoPreview.srcObject = null;
    currentState = APP_STATE.RECORDED;
    updateUI();
}

function startTimer() {
    stopTimer();
    recordingTimer = setInterval(() => {
        recordingSeconds++;
        const mins = Math.floor(recordingSeconds / 60);
        const secs = recordingSeconds % 60;
        recordingTime.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }, 1000);
}

function stopTimer() {
    if (recordingTimer) {
        clearInterval(recordingTimer);
        recordingTimer = null;
    }
}

function resetRecording() {
    recordedChunks = [];
    if (recordedBlob) {
        URL.revokeObjectURL(recordedUrl);
        recordedBlob = null;
        recordedUrl = null;
    }
    recordedVideo.src = '';
    recordedVideo.classList.add('hidden');
    currentState = APP_STATE.CAMERA_READY;
    updateUI();
    initCamera().catch(err => console.error(err));
}

function showRecordedPreview() {
    if (currentState !== APP_STATE.RECORDED || !recordedUrl) return;
    recordedVideo.src = recordedUrl;
    recordedVideo.classList.remove('hidden');
    recordedVideo.play();
}

function downloadVideo() {
    if (currentState !== APP_STATE.RECORDED || !recordedUrl) {
        showToast('Chưa có video để tải');
        return;
    }
    const rawName = videoNameInput.value.trim() || 'DuyHoangNetwork';
    const fileName = sanitizeFileName(rawName) + '.webm';
    
    const a = document.createElement('a');
    a.href = recordedUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

// ==================== THEME ====================
function toggleTheme() {
    if (currentTheme === 'dark') {
        setTheme('light');
    } else {
        setTheme('dark');
    }
}

function setTheme(theme) {
    currentTheme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    themeIcon.textContent = theme === 'dark' ? '🌙' : '☀️';
    localStorage.setItem('theme', theme);
}

// ==================== FULLSCREEN ====================
function toggleFullscreen() {
    if (!document.fullscreenElement) {
        if (isTextEditingMode) {
            exitTextEditingMode();
        }
        if (cameraStage.requestFullscreen) {
            cameraStage.requestFullscreen().catch(err => console.error(err));
        }
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        }
    }
}

// ==================== UI UPDATE ====================
function updateUI() {
    switch (currentState) {
        case APP_STATE.IDLE:
            recordStatus.textContent = 'Chưa có camera';
            break;
        case APP_STATE.CAMERA_READY:
            recordStatus.textContent = 'Sẵn sàng';
            break;
        case APP_STATE.RECORDING:
            recordStatus.textContent = 'Đang quay...';
            break;
        case APP_STATE.PAUSED:
            recordStatus.textContent = 'Tạm dừng';
            break;
        case APP_STATE.RECORDED:
            recordStatus.textContent = 'Đã quay xong';
            break;
    }
    
    const isRecording = currentState === APP_STATE.RECORDING;
    const isPaused = currentState === APP_STATE.PAUSED;
    const isRecorded = currentState === APP_STATE.RECORDED;
    const isReady = currentState === APP_STATE.CAMERA_READY;
    
    startRecordBtn.classList.toggle('hidden', !isReady);
    pauseRecordBtn.classList.toggle('hidden', !isRecording);
    resumeRecordBtn.classList.toggle('hidden', !isPaused);
    stopRecordBtn.classList.toggle('hidden', !(isRecording || isPaused));
    
    recordedPanel.classList.toggle('hidden', !isRecorded);
    
    recordingIndicator.classList.toggle('hidden', !(isRecording || isPaused));
    if (isRecording) {
        recordingIndicator.querySelector('.rec-dot').style.animation = 'blink 1s infinite';
    } else if (isPaused) {
        recordingIndicator.querySelector('.rec-dot').style.animation = 'none';
        recordingIndicator.querySelector('.rec-dot').style.opacity = '1';
    }
    
    cameraSelect.disabled = isRecording || isPaused;
    micSelect.disabled = isRecording || isPaused;
    antiMirrorCheckbox.disabled = isRecording || isPaused;
}

// ==================== TOAST ====================
function showToast(message) {
    toast.textContent = message;
    toast.classList.remove('hidden');
    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(() => {
        toast.classList.add('hidden');
    }, 3000);
}

// ==================== LOCAL STORAGE ====================
function saveTextLayers() {
    try {
        localStorage.setItem('textLayers', JSON.stringify(textLayers.map(t => ({...t}))));
    } catch (e) {
        console.warn('Cannot save text layers', e);
    }
}

function loadSettings() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
        setTheme(savedTheme);
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
        setTheme('light');
    } else {
        setTheme('dark');
    }
    
    const savedAntiMirror = localStorage.getItem('antiMirror');
    if (savedAntiMirror !== null) {
        antiMirrorEnabled = savedAntiMirror === 'true';
        antiMirrorCheckbox.checked = antiMirrorEnabled;
    }
    
    const savedAspectRatio = localStorage.getItem('aspectRatio');
    if (savedAspectRatio) {
        setAspectRatio(savedAspectRatio);
    }
    
    const savedTextLayers = localStorage.getItem('textLayers');
    if (savedTextLayers) {
        try {
            const layers = JSON.parse(savedTextLayers);
            layers.forEach(data => {
                textLayers.push(data);
                createTextElement(data);
            });
            updateTextList();
            if (textLayers.length > 0) {
                selectText(textLayers[0].id);
            }
        } catch (e) {
            console.warn('Cannot parse text layers', e);
        }
    }
}

// ==================== GLOBAL EVENTS ====================
document.addEventListener('pointerup', () => {
    if (isDragging) stopDrag();
    if (isResizing) stopResize();
});

document.addEventListener('pointercancel', () => {
    if (isDragging) stopDrag();
    if (isResizing) stopResize();
});

document.addEventListener('contextmenu', (e) => {
    if (e.target.closest('.text-overlay')) {
        e.preventDefault();
    }
});

const resizeObserver = new ResizeObserver(() => {
    updateStageSize();
    updateTextPositionsFromPercent();
});
resizeObserver.observe(cameraWrapper);
resizeObserver.observe(overlayLayer);
resizeObserver.observe(textEditOverlayLayer);

document.addEventListener('fullscreenchange', () => {
    setTimeout(updateStageSize, 100);
});
