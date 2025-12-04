import * as THREE from 'three';

// ==========================================
// 1. 配置 (核心修改：统一模型名称配置)
// ==========================================
const API_CONFIG = {
    // 1. Gemini 配置
    gemini: {
        key: 'AIzaSyBuvdEi1t56ZNET1dsqlvdCilufc_h3WkU', 
        url: 'https://generativelanguage.googleapis.com/v1beta/models/', // 基础URL
        modelName: 'gemini-2.0-flash' //在此处修改 Gemini 模型
    },
    // 2. DeepSeek 配置
    deepseek: {
        key: 'sk-80fd74758c144a61b2dae7a23195614c',
        url: 'https://api.deepseek.com/chat/completions',
        modelName: 'deepseek-chat' // 在此处修改 DeepSeek 模型 
    },
    // 3. API520 配置
    api520: {
        key: 'sk-oz6NJs2yhCO61rZXNNBAwA2V9johJLdILa5e3r0xp0nuOOz4',
        url: 'https://api520.pro/v1/chat/completions',
        modelName: '熊猫-A-5-稳灵抗截断-[200k]gemini-2.5-pro' 
    }
};

const SYSTEM_PROMPT = `你是一个绝对理性的数学与逻辑助手。请务必使用 LaTeX 格式输出所有数学公式：独立公式用 $$...$$，行内公式用 $...$。`;

// 状态
let currentModel = localStorage.getItem('chatModel') || 'gemini';
let isTTSEnabled = false; 
let recognition = null; 
let isRecording = false;
let isSpeaking = false; 
let isManualTheme = false; // 手动主题锁

// 语音倒计时
let voiceSendTimer = null;

// 记忆
let chatSessions = JSON.parse(localStorage.getItem('chatSessions')) || [];
let currentSessionId = localStorage.getItem('currentSessionId') || null;

// 3D
let scene, camera, renderer, particles;
let clock = new THREE.Clock();

// ==========================================
// 2. 初始化
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    bindEvents();
    
    checkBeijingTime();
    setInterval(checkBeijingTime, 60000);

    updateModelLabel();
    initVoiceFeature();
    initChatSystem(); 
    initCustomCursor(); 
    
    initMathParticleScene();
    
    if(window.marked) window.marked.setOptions({ breaks: true, gfm: true });
});

// ==========================================
// 3. 点击爆破
// ==========================================
function initCustomCursor() {
    document.addEventListener('mousedown', (e) => {
        createExplosion(e.clientX, e.clientY);
    });
}

function createExplosion(x, y) {
    const symbols = ['∑', '∫', 'π', '∞', '√', '≈', '≠', '±', '∂', '∇', 'x', 'y'];
    const particleCount = 12; 
    const themeColor = getComputedStyle(document.body).color;

    for (let i = 0; i < particleCount; i++) {
        const el = document.createElement('div');
        el.classList.add('math-particle-dom');
        el.textContent = symbols[Math.floor(Math.random() * symbols.length)];
        el.style.color = themeColor;
        document.body.appendChild(el);

        el.style.left = `${x}px`;
        el.style.top = `${y}px`;

        const angle = Math.random() * Math.PI * 2;
        const velocity = 60 + Math.random() * 60;
        const tx = Math.cos(angle) * velocity + 'px';
        const ty = Math.sin(angle) * velocity + 'px';
        const rot = (Math.random() - 0.5) * 360 + 'deg';

        el.style.setProperty('--tx', tx);
        el.style.setProperty('--ty', ty);
        el.style.setProperty('--rot', rot);

        setTimeout(() => el.remove(), 1000);
    }
}

// ==========================================
// 4. 主题控制
// ==========================================
function checkBeijingTime() {
    if (isManualTheme) return;
    const date = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Shanghai"}));
    const hour = date.getHours();
    if (hour >= 6 && hour < 19) document.body.classList.add('light-mode');
    else document.body.classList.remove('light-mode');
}

function toggleTheme() {
    isManualTheme = true;
    document.body.classList.toggle('light-mode');
}

// ==========================================
// 5. 数学符号粒子引擎
// ==========================================
function initMathParticleScene() {
    const container = document.getElementById('math-canvas-container');
    if (!container) return;

    const width = window.innerWidth;
    const height = window.innerHeight;

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    camera.position.z = 50;

    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    const symbols = ['∑', '∫', 'π', 'e', '0', '1', 'sin', 'cos', '∞', '√', 'tan', 'log'];
    const materials = [];
    
    symbols.forEach(sym => {
        const canvas = document.createElement('canvas');
        canvas.width = 128; canvas.height = 128;
        const ctx = canvas.getContext('2d');
        ctx.font = 'bold 60px "JetBrains Mono", monospace';
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(sym, 64, 64);
        const tex = new THREE.CanvasTexture(canvas);
        materials.push(new THREE.SpriteMaterial({ 
            map: tex, transparent: true, opacity: 0.5, color: 0xffffff 
        }));
    });

    particles = new THREE.Group();
    const particleCount = 3000; 

    for (let i = 0; i < particleCount; i++) {
        const mat = materials[Math.floor(Math.random() * materials.length)].clone();
        const sprite = new THREE.Sprite(mat);
        
        sprite.position.x = (Math.random() - 0.5) * 400;
        sprite.position.y = (Math.random() - 0.5) * 300;
        sprite.position.z = (Math.random() - 0.5) * 200;
        
        const scale = 0.5 + Math.random() * 2.0;
        sprite.scale.set(scale, scale, 1);
        
        sprite.userData = {
            speed: 0.05 + Math.random() * 0.1,
            type: Math.floor(Math.random() * 3),
            offset: Math.random() * 100,
            amp: 0.5 + Math.random() * 2
        };
        
        sprite.material.opacity = 0.1 + Math.random() * 0.4;
        particles.add(sprite);
    }
    scene.add(particles);

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    animate();
}

function animate() {
    requestAnimationFrame(animate);
    const time = clock.getElapsedTime();

    particles.children.forEach(sprite => {
        const d = sprite.userData;
        
        sprite.position.y -= d.speed;
        
        if (d.type === 0) {
            sprite.position.x += Math.sin(time * 0.5 + d.offset) * 0.02 * d.amp;
        } else if (d.type === 1) {
            sprite.position.x += Math.cos(time * 0.4 + d.offset) * 0.02 * d.amp;
        } else {
            sprite.position.x += Math.sin(time * 0.3) * 0.01 + Math.cos(time * 0.6) * 0.01;
        }

        sprite.material.rotation += 0.005;

        if (sprite.position.y < -150) {
            sprite.position.y = 150;
            sprite.position.x = (Math.random() - 0.5) * 400;
        }
        
        const isLight = document.body.classList.contains('light-mode');
        const targetColor = isLight ? new THREE.Color(0x64748b) : new THREE.Color(0xccf0ff);
        sprite.material.color.lerp(targetColor, 0.1);
        sprite.material.opacity = isLight ? 0.2 : 0.3;
    });

    renderer.render(scene, camera);
}

// ==========================================
// 6. 记忆与聊天
// ==========================================
function initChatSystem() {
    renderHistoryList();
    if (currentSessionId && chatSessions.find(s => s.id === currentSessionId)) {
        loadSession(currentSessionId);
    } else {
        startNewChat();
    }
}

function startNewChat() {
    if (chatSessions.length > 0) {
        const lastSession = chatSessions[0];
        if (lastSession.messages.length === 1 && lastSession.messages[0].role === 'bot') {
            currentSessionId = lastSession.id;
            localStorage.setItem('currentSessionId', currentSessionId);
            renderHistoryList();
            loadSession(currentSessionId);
            if (window.innerWidth <= 768) {
                document.getElementById('sidebar').classList.remove('open');
                document.getElementById('sidebar-overlay').classList.remove('active');
            }
            return; 
        }
    }

    currentSessionId = Date.now().toString();
    const newSession = {
        id: currentSessionId,
        title: "新突触 " + new Date().toLocaleTimeString(),
        messages: [{ role: 'bot', text: "数学之境已开启，请下达指令。" }]
    };
    chatSessions.unshift(newSession);
    saveData();
    renderHistoryList();
    loadSession(currentSessionId);
}

function loadSession(id) {
    currentSessionId = id;
    localStorage.setItem('currentSessionId', id);
    const session = chatSessions.find(s => s.id === id);
    if (!session) return;

    const container = document.getElementById('messages');
    container.innerHTML = '';
    session.messages.forEach(msg => displayMessage(msg.role, msg.text, false));
    updateSidebarActiveState();
    
    if (window.innerWidth <= 768) {
        document.getElementById('sidebar').classList.remove('open');
        document.getElementById('sidebar-overlay').classList.remove('active');
    }
}

function saveMessageToCurrentSession(role, text) {
    const session = chatSessions.find(s => s.id === currentSessionId);
    if (session) {
        session.messages.push({ role, text });
        if (session.messages.length === 2 && role === 'user') {
            session.title = text.substring(0, 15);
            renderHistoryList();
        }
        saveData();
    }
}

function saveData() { localStorage.setItem('chatSessions', JSON.stringify(chatSessions)); }

function renderHistoryList() {
    const list = document.getElementById('history-list');
    list.innerHTML = '';
    chatSessions.forEach(session => {
        const item = document.createElement('div');
        item.className = `history-item ${session.id === currentSessionId ? 'active' : ''}`;
        item.onclick = () => loadSession(session.id);
        item.innerHTML = `<span>${session.title}</span><span class="delete-chat" onclick="window.deleteSessionProxy(event, '${session.id}')">×</span>`;
        list.appendChild(item);
    });
}

function deleteSession(e, id) {
    e.stopPropagation();
    if(confirm('确认删除此突触？')) {
        chatSessions = chatSessions.filter(s => s.id !== id);
        saveData();
        renderHistoryList();
        if (currentSessionId === id) startNewChat();
    }
}
window.deleteSessionProxy = deleteSession;
function updateSidebarActiveState() { document.querySelectorAll('.history-item').forEach(item => item.classList.remove('active')); renderHistoryList(); }
function clearAllHistory() { if(confirm('确认清空此页内容？')) { chatSessions = []; startNewChat(); } }

function sendMessage() {
    if (voiceSendTimer) { clearTimeout(voiceSendTimer); voiceSendTimer = null; }
    if (isRecording) stopVoice();
    stopSpeaking(); 
    const input = document.getElementById('chat-input');
    const message = input.value.trim();
    if (!message) return;
    
    displayMessage('user', message, true);
    input.value = '';
    input.placeholder = "输入指令...";
    
    const loading = document.getElementById('loading');
    loading.style.display = 'block';
    
    // === 路由选择 ===
    if (currentModel === 'deepseek') {
        callDeepSeek(message, loading);
    } else if (currentModel === 'api520') {
        callAPI520(message, loading);
    } else {
        callGemini(message, loading);
    }
}

// 1. Gemini 调用
function callGemini(text, loadingElement) {
    const config = API_CONFIG.gemini;
    // 动态构建 URL：Base URL + Model Name + Action
    const url = `${config.url}${config.modelName}:generateContent?key=${config.key}`;
    const payload = { system_instruction: { parts: [{ text: SYSTEM_PROMPT }] }, contents: [{ role: "user", parts: [{ text: text }] }] };
    
    fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    .then(res => res.json())
    .then(data => {
        loadingElement.style.display = 'none';
        if (data.candidates && data.candidates[0].content) {
            const reply = data.candidates[0].content.parts[0].text;
            displayMessage('bot', reply, true);
            speakText(reply); 
        } else {
            displayMessage('bot', 'API Error', false);
        }
    })
    .catch(err => handleError(loadingElement, err));
}

// 2. DeepSeek 调用
function callDeepSeek(text, loadingElement) {
    const config = API_CONFIG.deepseek;
    const payload = { 
        model: config.modelName, // 从配置读取
        messages: [{ role: "system", content: SYSTEM_PROMPT }, { role: "user", content: text }], 
        stream: false 
    };
    
    fetch(config.url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.key}` }, body: JSON.stringify(payload) })
    .then(res => res.json())
    .then(data => {
        loadingElement.style.display = 'none';
        if (data.choices && data.choices.length > 0) {
            const reply = data.choices[0].message.content;
            displayMessage('bot', reply, true);
            speakText(reply); 
        } else {
            displayMessage('bot', 'API Error', false);
        }
    })
    .catch(err => handleError(loadingElement, err));
}

// 3. API520 调用
function callAPI520(text, loadingElement) {
    const config = API_CONFIG.api520;
    const payload = { 
        model: config.modelName, // 从配置读取
        messages: [{ role: "system", content: SYSTEM_PROMPT }, { role: "user", content: text }], 
        stream: false 
    };
    
    fetch(config.url, { 
        method: 'POST', 
        headers: { 
            'Content-Type': 'application/json', 
            'Authorization': `Bearer ${config.key}` 
        }, 
        body: JSON.stringify(payload) 
    })
    .then(res => res.json())
    .then(data => {
        loadingElement.style.display = 'none';
        if (data.choices && data.choices.length > 0) {
            const reply = data.choices[0].message.content;
            displayMessage('bot', reply, true);
            speakText(reply); 
        } else {
            displayMessage('bot', 'API Error: ' + (data.error?.message || 'Unknown'), false);
        }
    })
    .catch(err => handleError(loadingElement, err));
}

function handleError(loading, err) { loading.style.display = 'none'; console.error(err); displayMessage('bot', '网络错误'); }

function displayMessage(role, text, shouldSave = false) {
    if (shouldSave) saveMessageToCurrentSession(role, text);

    const container = document.getElementById('messages');
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${role}`;
    
    const avatar = document.createElement('img');
    avatar.src = role === 'user' ? 'user-avatar.jpg' : 'bot-avatar.jpg';
    avatar.onerror = function() { this.src = 'https://via.placeholder.com/40'; };
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    
    msgDiv.appendChild(avatar); 
    msgDiv.appendChild(contentDiv); 

    const mathMap = new Map();
    const generateId = () => "MATHBLOCK" + Math.random().toString(36).substr(2, 9) + "END";
    let protectedText = text
        .replace(/\$\$([\s\S]*?)\$\$/g, (match, code) => { const id = generateId(); mathMap.set(id, `$$${code}$$`); return "\n\n" + id + "\n\n"; })
        .replace(/\\\[([\s\S]*?)\\\]/g, (match, code) => { const id = generateId(); mathMap.set(id, `$$${code}$$`); return "\n\n" + id + "\n\n"; })
        .replace(/([^\\]|^)\$([^\$]*?)\$/g, (match, prefix, code) => { const id = generateId(); mathMap.set(id, `$${code}$`); return prefix + id; })
        .replace(/\\\(([\s\S]*?)\\\)/g, (match, code) => { const id = generateId(); mathMap.set(id, `$${code}$`); return id; });

    if (window.marked) contentDiv.innerHTML = window.marked.parse(protectedText);
    else contentDiv.textContent = text;

    let finalHtml = contentDiv.innerHTML;
    mathMap.forEach((latex, id) => { finalHtml = finalHtml.split(id).join(latex); });
    contentDiv.innerHTML = finalHtml;

    if (window.renderMathInElement) {
        setTimeout(() => {
            try {
                window.renderMathInElement(contentDiv, {
                    delimiters: [{left: '$$', right: '$$', display: true}, {left: '$', right: '$', display: false}],
                    throwOnError: false
                });
            } catch(e) {}
        }, 0);
    }
    
    container.appendChild(msgDiv); 
    requestAnimationFrame(() => { msgDiv.scrollIntoView({ behavior: 'smooth', block: 'end' }); });
}

function toggleTTS() { isTTSEnabled = !isTTSEnabled; document.getElementById('tts-label').textContent = isTTSEnabled ? "🔊 朗读: 开" : "🔇 朗读: 关"; if (!isTTSEnabled) stopSpeaking(); document.getElementById('dropdownMenu').classList.remove('show'); }
function speakText(text) {
    if (!isTTSEnabled || !('speechSynthesis' in window)) return;
    const cleanText = text.replace(/[\$\*\#\`]/g, '').replace(/\[.*?\]/g, '').replace(/\n/g, '，');
    const utterance = new SpeechSynthesisUtterance(cleanText);
    const voices = window.speechSynthesis.getVoices();
    const bestVoice = voices.find(v => v.lang.includes('zh') && (v.name.includes('Microsoft') || v.name.includes('Google'))) || voices.find(v => v.lang.includes('zh'));
    if (bestVoice) { utterance.voice = bestVoice; utterance.rate = 1.1; }
    utterance.onstart = () => { isSpeaking = true; }; utterance.onend = () => { isSpeaking = false; }; utterance.onerror = () => { isSpeaking = false; };
    window.speechSynthesis.speak(utterance);
}
function stopSpeaking() { if ('speechSynthesis' in window) window.speechSynthesis.cancel(); isSpeaking = false; }

function initVoiceFeature() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { document.getElementById('mic-btn').style.display = 'none'; return; }
    recognition = new SpeechRecognition(); recognition.lang = 'zh-CN'; recognition.continuous = true; recognition.interimResults = true; 
    
    recognition.onresult = (event) => {
        if (voiceSendTimer) clearTimeout(voiceSendTimer);
        let finalTranscript = ''; 
        for (let i = event.resultIndex; i < event.results.length; ++i) { 
            if (event.results[i].isFinal) finalTranscript += event.results[i][0].transcript; 
        }
        if (finalTranscript) { 
            const input = document.getElementById('chat-input'); 
            input.value = input.value ? input.value + finalTranscript : finalTranscript;
            input.placeholder = "语音识别中... 1.5秒后自动发送";
            voiceSendTimer = setTimeout(() => {
                sendMessage();
            }, 1500);
        }
    };
    recognition.onend = () => { if (isRecording) try{recognition.start()}catch(e){} };
}

function toggleVoice() { stopSpeaking(); if (isRecording) stopVoice(); else startVoice(); }
function startVoice() { if (!recognition) return; recognition.start(); isRecording = true; document.getElementById('mic-btn').classList.add('recording'); document.getElementById('chat-input').placeholder = "请说话..."; }
function stopVoice() { if (!recognition) return; recognition.stop(); isRecording = false; document.getElementById('mic-btn').classList.remove('recording'); document.getElementById('chat-input').placeholder = "输入指令..."; if (voiceSendTimer) clearTimeout(voiceSendTimer); }
function toggleDropdown(e) { e.stopPropagation(); document.getElementById('dropdownMenu').classList.toggle('show'); }
window.onclick = function(e) { if (!e.target.closest('.dropdown')) document.getElementById('dropdownMenu').classList.remove('show'); }

// === 切换模型 (三选一循环) ===
function toggleModel() {
    if (currentModel === 'gemini') {
        currentModel = 'deepseek';
    } else if (currentModel === 'deepseek') {
        currentModel = 'api520';
    } else {
        currentModel = 'gemini';
    }
    localStorage.setItem('chatModel', currentModel);
    updateModelLabel();
}

function updateModelLabel() {
    let label = '';
    if (currentModel === 'gemini') {
        label = '🤖 Gemini';
    } else if (currentModel === 'deepseek') {
        label = '🐳 DeepSeek';
    } else if (currentModel === 'api520') {
        label = '🚀 Api 520'; // 更新显示标签
    }
    document.getElementById('model-label').textContent = label;
}

function bindEvents() {
    document.getElementById('send-btn').addEventListener('click', sendMessage);
    document.getElementById('mic-btn').addEventListener('click', toggleVoice);
    document.getElementById('more-btn').addEventListener('click', toggleDropdown);
    document.getElementById('btn-tts').addEventListener('click', toggleTTS);
    document.getElementById('btn-theme').addEventListener('click', toggleTheme);
    document.getElementById('btn-model').addEventListener('click', toggleModel);
    document.getElementById('btn-clear').addEventListener('click', clearAllHistory);
    document.getElementById('new-chat-btn').addEventListener('click', startNewChat);
    document.getElementById('mobile-menu-btn').addEventListener('click', () => { document.getElementById('sidebar').classList.add('open'); document.getElementById('sidebar-overlay').classList.add('active'); });
    document.getElementById('sidebar-overlay').addEventListener('click', () => { document.getElementById('sidebar').classList.remove('open'); document.getElementById('sidebar-overlay').classList.remove('active'); });
    document.getElementById('chat-input').addEventListener('keypress', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } });
}