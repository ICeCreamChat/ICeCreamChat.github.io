import * as THREE from 'three';

// ==========================================
// 1. 配置
// ==========================================
const API_CONFIG = {
    gemini: {
        key: 'AIzaSyBuvdEi1t56ZNET1dsqlvdCilufc_h3WkU', 
        url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent'
    },
    deepseek: {
        key: 'sk-80fd74758c144a61b2dae7a23195614c',
        url: 'https://api.deepseek.com/chat/completions'
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
    initCustomCursor(); // 启动点击爆破逻辑
    
    initMathParticleScene();
    
    if(window.marked) window.marked.setOptions({ breaks: true, gfm: true });
});

// ==========================================
// 3. 点击爆破 (保留功能，去掉自定义光标)
// ==========================================
function initCustomCursor() {
    // 移除了鼠标跟随和自定义光标元素的操作，仅保留点击触发爆破
    document.addEventListener('mousedown', (e) => {
        createExplosion(e.clientX, e.clientY);
    });
}

function createExplosion(x, y) {
    const symbols = ['∑', '∫', 'π', '∞', '√', '≈', '≠', '±', '∂', '∇', 'x', 'y'];
    const particleCount = 12; 

    // 获取当前主题的文字颜色，确保符号颜色一致
    const themeColor = getComputedStyle(document.body).color;

    for (let i = 0; i < particleCount; i++) {
        const el = document.createElement('div');
        el.classList.add('math-particle-dom');
        el.textContent = symbols[Math.floor(Math.random() * symbols.length)];
        el.style.color = themeColor; // 颜色同步
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
// 4. 主题控制 (带锁)
// ==========================================
function checkBeijingTime() {
    if (isManualTheme) return; // 如果手动切换过，不自动变
    const date = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Shanghai"}));
    const hour = date.getHours();
    if (hour >= 6 && hour < 19) document.body.classList.add('light-mode');
    else document.body.classList.remove('light-mode');
}

function toggleTheme() {
    isManualTheme = true; // 锁定
    document.body.classList.toggle('light-mode');
}

// ==========================================
// 5. 数学符号粒子引擎 (Massive & Elegant)
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

    // --- 生成贴图 ---
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

    // --- 创建 3000 个粒子 ---
    particles = new THREE.Group();
    const particleCount = 3000; 

    for (let i = 0; i < particleCount; i++) {
        const mat = materials[Math.floor(Math.random() * materials.length)].clone();
        const sprite = new THREE.Sprite(mat);
        
        // 广域随机分布
        sprite.position.x = (Math.random() - 0.5) * 400;
        sprite.position.y = (Math.random() - 0.5) * 300;
        sprite.position.z = (Math.random() - 0.5) * 200;
        
        // 大小不一
        const scale = 0.5 + Math.random() * 2.0;
        sprite.scale.set(scale, scale, 1);
        
        // 运动参数
        sprite.userData = {
            speed: 0.05 + Math.random() * 0.1, // 慢速
            type: Math.floor(Math.random() * 3), // 0: sin, 1: cos, 2: tan like
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
        
        // Y轴下落
        sprite.position.y -= d.speed;
        
        // X轴多样化轨迹
        if (d.type === 0) { // Sin
            sprite.position.x += Math.sin(time * 0.5 + d.offset) * 0.02 * d.amp;
        } else if (d.type === 1) { // Cos
            sprite.position.x += Math.cos(time * 0.4 + d.offset) * 0.02 * d.amp;
        } else { // 混合
            sprite.position.x += Math.sin(time * 0.3) * 0.01 + Math.cos(time * 0.6) * 0.01;
        }

        // 旋转
        sprite.material.rotation += 0.005;

        // 循环
        if (sprite.position.y < -150) {
            sprite.position.y = 150;
            sprite.position.x = (Math.random() - 0.5) * 400;
        }
        
        // 颜色跟随主题
        const isLight = document.body.classList.contains('light-mode');
        // 白天：深蓝灰；晚上：青白
        const targetColor = isLight ? new THREE.Color(0x64748b) : new THREE.Color(0xccf0ff);
        sprite.material.color.lerp(targetColor, 0.1);
        sprite.material.opacity = isLight ? 0.2 : 0.3; // 淡淡的，不抢眼
    });

    renderer.render(scene, camera);
}

// ==========================================
// 6. 记忆与聊天 (保持逻辑)
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
    
    if (currentModel === 'deepseek') callDeepSeek(message, loading);
    else callGemini(message, loading);
}

function callGemini(text, loadingElement) {
    const url = `${API_CONFIG.gemini.url}?key=${API_CONFIG.gemini.key}`;
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

function callDeepSeek(text, loadingElement) {
    const payload = { model: "deepseek-chat", messages: [{ role: "system", content: SYSTEM_PROMPT }, { role: "user", content: text }], stream: false };
    fetch(API_CONFIG.deepseek.url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${API_CONFIG.deepseek.key}` }, body: JSON.stringify(payload) })
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

// === 语音倒计时发送逻辑 ===
function initVoiceFeature() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { document.getElementById('mic-btn').style.display = 'none'; return; }
    recognition = new SpeechRecognition(); recognition.lang = 'zh-CN'; recognition.continuous = true; recognition.interimResults = true; 
    
    recognition.onresult = (event) => {
        // 清除上一次的倒计时
        if (voiceSendTimer) clearTimeout(voiceSendTimer);

        let finalTranscript = ''; 
        for (let i = event.resultIndex; i < event.results.length; ++i) { 
            if (event.results[i].isFinal) finalTranscript += event.results[i][0].transcript; 
        }
        if (finalTranscript) { 
            const input = document.getElementById('chat-input'); 
            input.value = input.value ? input.value + finalTranscript : finalTranscript;
            
            input.placeholder = "语音识别中... 1.5秒后自动发送";
            
            // 1.5秒无操作自动发送
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
function toggleModel() { currentModel = currentModel === 'gemini' ? 'deepseek' : 'gemini'; localStorage.setItem('chatModel', currentModel); updateModelLabel(); }
function updateModelLabel() { document.getElementById('model-label').textContent = `${currentModel === 'gemini' ? '🤖' : '🐳'} ${currentModel === 'gemini' ? 'Gemini' : 'DeepSeek'}`; }
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