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

// ==================== DOM ====================
const videoPreview = document.getElementById('cameraPreview');
const overlayLayer = document.getElementById('textOverlayLayer');
const cameraStage = document.getElementById('cameraStage');
const cameraWrapper = document.getElementById('cameraWrapper');
const cameraSelect = document.getElementById('cameraSelect');
const micSelect = document.getElementById('micSelect');
const permissionOverlay = document.getElementById('permissionOverlay');
const permissionBtn = document.getElementById('permissionBtn');
const permissionHint = document.getElementById('permissionHint');
const addTextBtn = document.getElementById('addTextBtn');
const textList = document.getElementById('textList');
const textEditPanel = document.getElementById('textEditPanel');
const textContentInput = document.getElementById('textContentInput');
const fontSizeRange = document.getElementById('fontSizeRange');
const sizeValue = document.getElementById('sizeValue');
const opacityRange = document.getElementById('opacityRange');
const opacityValue = document.getElementById('opacityValue');
const deleteTextBtn = document.getElementById('deleteTextBtn');
const quickTextTools = document.getElementById('quickTextTools');
const quickFontSizeRange = document.getElementById('quickFontSizeRange');
const quickSizeValue = document.getElementById('quickSizeValue');
const quickOpacityRange = document.getElementById('quickOpacityRange');
const quickOpacityValue = document.getElementById('quickOpacityValue');
const quickDeleteTextBtn = document.getElementById('quickDeleteTextBtn');
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
    
    document.querySelectorAll('.ratio-btn').forEach(btn => {
        btn.addEventListener('click', () => setAspectRatio(btn.dataset.ratio));
    });
    
    addTextBtn.addEventListener('click', () => addText('Văn bản mới'));
    textContentInput.addEventListener('input', updateSelectedTextContent);
    fontSizeRange.addEventListener('input', updateSelectedTextStyle);
    opacityRange.addEventListener('input', updateSelectedTextStyle);
    deleteTextBtn.addEventListener('click', deleteSelectedText);
    
    quickFontSizeRange.addEventListener('input', (e) => {
        fontSizeRange.value = e.target.value;
        updateSelectedTextStyle();
    });
    quickOpacityRange.addEventListener('input', (e) => {
        opacityRange.value = e.target.value;
        updateSelectedTextStyle();
    });
    quickDeleteTextBtn.addEventListener('click', deleteSelectedText);
    
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
}

// ==================== STAGE SIZE (MOBILE-FIRST) ====================
function updateStageSize() {
    const container = cameraWrapper;
    const stage = cameraStage;
    if (!container || !stage) return;
    
    const containerRect = container.getBoundingClientRect();
    const availableWidth = containerRect.width;
    const availableHeight = containerRect.height;
    
    if (availableWidth <= 0 || availableHeight <= 0) return;
    
    let ratio;
    switch (currentAspectRatio) {
        case '9:16': ratio = 9/16; break;
        case '16:9': ratio = 16/9; break;
        case '1:1': ratio = 1; break;
        case '4:5': ratio = 4/5; break;
        default: ratio = 16/9;
    }
    
    let stageWidth = availableWidth;
    let stageHeight = stageWidth / ratio;
    
    if (stageHeight > availableHeight) {
        stageHeight = availableHeight;
        stageWidth = stageHeight * ratio;
    }
    
    stage.style.width = Math.floor(stageWidth) + 'px';
    stage.style.height = Math.floor(stageHeight) + 'px';
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
        opacity: 1
    };
    
    textLayers.push(textData);
    createTextElement(textData);
    selectText(id);
    updateTextList();
    saveTextLayers();
}

function createTextElement(data) {
    const el = document.createElement('div');
    el.className = 'text-overlay';
    el.id = data.id;
    el.textContent = data.content;
    el.style.position = 'absolute';
    el.style.left = `${data.xPercent}%`;
    el.style.top = `${data.yPercent}%`;
    el.style.transform = `translate(-50%, -50%)`;
    el.style.fontSize = `${data.fontSize}px`;
    el.style.opacity = data.opacity;
    el.style.fontWeight = 'bold';
    el.style.textShadow = '0 0 4px rgba(0,0,0,0.5)';
    el.style.padding = '4px 8px';
    el.style.cursor = 'move';
    el.style.userSelect = 'none';
    el.style.zIndex = '20';
    el.style.touchAction = 'none';
    el.dataset.textId = data.id;
    
    const resizeHandle = document.createElement('div');
    resizeHandle.className = 'resize-handle';
    el.appendChild(resizeHandle);
    
    el.addEventListener('pointerdown', (e) => startDrag(e, data.id));
    el.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        selectText(data.id);
        textContentInput.focus();
        textContentInput.select();
    });
    
    resizeHandle.addEventListener('pointerdown', (e) => startResize(e, data.id));
    
    overlayLayer.appendChild(el);
}

function updateTextElement(data) {
    const el = document.getElementById(data.id);
    if (!el) return;
    el.textContent = data.content;
    el.style.left = `${data.xPercent}%`;
    el.style.top = `${data.yPercent}%`;
    el.style.fontSize = `${data.fontSize}px`;
    el.style.opacity = data.opacity;
}

function selectText(id) {
    if (selectedTextId) {
        const prevEl = document.getElementById(selectedTextId);
        if (prevEl) prevEl.classList.remove('selected');
    }
    selectedTextId = id;
    const el = document.getElementById(id);
    if (el) {
        el.classList.add('selected');
        const data = getTextData(id);
        if (data) {
            textEditPanel.classList.remove('hidden');
            textContentInput.value = data.content;
            fontSizeRange.value = data.fontSize;
            sizeValue.textContent = data.fontSize;
            opacityRange.value = data.opacity * 100;
            opacityValue.textContent = Math.round(data.opacity * 100);
            
            // Sync quick tools
            quickFontSizeRange.value = data.fontSize;
            quickSizeValue.textContent = data.fontSize;
            quickOpacityRange.value = data.opacity * 100;
            quickOpacityValue.textContent = Math.round(data.opacity * 100);
            quickTextTools.classList.remove('hidden');
        }
    }
    updateTextList();
}

function getTextData(id) {
    return textLayers.find(t => t.id === id);
}

function updateSelectedTextContent() {
    if (!selectedTextId) return;
    const data = getTextData(selectedTextId);
    if (data) {
        data.content = textContentInput.value;
        updateTextElement(data);
        updateTextList();
        saveTextLayers();
    }
}

function updateSelectedTextStyle() {
    if (!selectedTextId) return;
    const data = getTextData(selectedTextId);
    if (!data) return;
    
    data.fontSize = parseInt(fontSizeRange.value);
    sizeValue.textContent = data.fontSize;
    data.opacity = parseInt(opacityRange.value) / 100;
    opacityValue.textContent = parseInt(opacityRange.value);
    
    // Sync quick tools
    quickFontSizeRange.value = data.fontSize;
    quickSizeValue.textContent = data.fontSize;
    quickOpacityRange.value = data.opacity * 100;
    quickOpacityValue.textContent = Math.round(data.opacity * 100);
    
    updateTextElement(data);
    saveTextLayers();
}

function deleteSelectedText() {
    if (!selectedTextId) return;
    const el = document.getElementById(selectedTextId);
    if (el) el.remove();
    textLayers = textLayers.filter(t => t.id !== selectedTextId);
    selectedTextId = null;
    textEditPanel.classList.add('hidden');
    quickTextTools.classList.add('hidden');
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
        item.addEventListener('click', () => selectText(layer.id));
        
        const visibilitySpan = document.createElement('span');
        visibilitySpan.className = 'text-visibility';
        visibilitySpan.textContent = '👁';
        visibilitySpan.addEventListener('click', (e) => {
            e.stopPropagation();
            const el = document.getElementById(layer.id);
            if (el) {
                el.style.display = el.style.display === 'none' ? 'inline-flex' : 'none';
            }
        });
        item.appendChild(visibilitySpan);
        
        textList.appendChild(item);
    });
}

// ==================== DRAG & RESIZE ====================
function startDrag(e, id) {
    if (e.target.classList.contains('resize-handle')) return;
    e.preventDefault();
    const data = getTextData(id);
    if (!data) return;
    selectText(id);
    
    const rect = overlayLayer.getBoundingClientRect();
    dragData = {
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
}

function onDrag(e) {
    if (!isDragging || !dragData) return;
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
    saveTextLayers();
}

function startResize(e, id) {
    e.preventDefault();
    e.stopPropagation();
    selectText(id);
    const data = getTextData(id);
    if (!data) return;
    
    const rect = overlayLayer.getBoundingClientRect();
    dragData = {
        id: id,
        startX: e.clientX,
        startY: e.clientY,
        origFontSize: data.fontSize,
        containerWidth: rect.width,
        containerHeight: rect.height
    };
    isResizing = true;
    
    document.addEventListener('pointermove', onResize);
    document.addEventListener('pointerup', stopResize);
}

function onResize(e) {
    if (!isResizing || !dragData) return;
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
            fontSizeRange.value = newSize;
            sizeValue.textContent = newSize;
            quickFontSizeRange.value = newSize;
            quickSizeValue.textContent = newSize;
        }
    }
}

function stopResize() {
    isResizing = false;
    dragData = null;
    document.removeEventListener('pointermove', onResize);
    document.removeEventListener('pointerup', stopResize);
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
    
    const mimeType = getSupportedMimeType();
    if (!mimeType || !window.MediaRecorder) {
        showToast('Trình duyệt không hỗ trợ quay video. Vui lòng sử dụng Chrome hoặc Edge phiên bản mới.');
        return;
    }
    
    try {
        recordedChunks = [];
        mediaRecorder = new MediaRecorder(mediaStream, { mimeType: mimeType });
        
        mediaRecorder.ondataavailable = (event) => {
            if (event.data && event.data.size > 0) {
                recordedChunks.push(event.data);
            }
        };
        
        mediaRecorder.onstop = () => {
            recordedBlob = new Blob(recordedChunks, { type: mimeType });
            recordedUrl = URL.createObjectURL(recordedBlob);
            currentState = APP_STATE.RECORDED;
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
    // Theme
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
        setTheme(savedTheme);
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
        setTheme('light');
    } else {
        setTheme('dark');
    }
    
    // Aspect ratio
    const savedAspectRatio = localStorage.getItem('aspectRatio');
    if (savedAspectRatio) {
        setAspectRatio(savedAspectRatio);
    }
    
    // Text layers
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

document.addEventListener('contextmenu', (e) => {
    if (e.target.closest('.text-overlay')) {
        e.preventDefault();
    }
});

const resizeObserver = new ResizeObserver(() => {
    updateStageSize();
    updateTextPositionsFromPercent();
});
resizeObserver.observe(overlayLayer);
resizeObserver.observe(cameraWrapper);

// Đảm bảo stage size đúng khi fullscreen thay đổi
document.addEventListener('fullscreenchange', () => {
    setTimeout(updateStageSize, 100);
});
