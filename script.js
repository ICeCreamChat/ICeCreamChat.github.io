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
    
    // 初始化时检查一次，之后每分钟检查
    checkBeijingTime();
    setInterval(checkBeijingTime, 60000);

    updateModelLabel();
    initVoiceFeature();
    initChatSystem(); 
    
    // 启动数学粒子引擎
    initMathParticleScene();
    
    if(window.marked) window.marked.setOptions({ breaks: true, gfm: true });
});

// ==========================================
// 3. 主题控制 (带手动锁)
// ==========================================
function checkBeijingTime() {
    // 如果用户手动切换过，就不再自动变了
    if (isManualTheme) return;

    const date = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Shanghai"}));
    const hour = date.getHours();
    
    // 6:00 - 19:00 白天
    if (hour >= 6 && hour < 19) {
        document.body.classList.add('light-mode');
    } else {
        document.body.classList.remove('light-mode');
    }
}

function toggleTheme() {
    // 标记为手动模式
    isManualTheme = true;
    
    if (document.body.classList.contains('light-mode')) {
        document.body.classList.remove('light-mode'); // 变黑
    } else {
        document.body.classList.add('light-mode'); // 变亮
    }
}

// ==========================================
// 4. 数学符号粒子引擎 (Massive Math Flow)
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

    // --- 1. 生成数学符号材质 ---
    const symbols = ['∑', '∫', 'π', 'e', '0', '1', 'sin', 'cos', '∞', '√', 'λ', 'θ', 'Ω', 'μ'];
    const materials = [];
    
    symbols.forEach(sym => {
        const canvas = document.createElement('canvas');
        canvas.width = 128; canvas.height = 128; // 提高分辨率
        const ctx = canvas.getContext('2d');
        ctx.font = 'bold 80px "JetBrains Mono", monospace';
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        // 发光效果
        ctx.shadowColor = 'rgba(255, 255, 255, 0.8)';
        ctx.shadowBlur = 10;
        ctx.fillText(sym, 64, 64);
        
        const tex = new THREE.CanvasTexture(canvas);
        materials.push(new THREE.SpriteMaterial({ 
            map: tex, 
            transparent: true, 
            opacity: 0.6,
            color: 0xffffff 
        }));
    });

    // --- 2. 创建大量粒子 ---
    particles = new THREE.Group();
    const particleCount = 2000; // 很多很多！

    for (let i = 0; i < particleCount; i++) {
        const mat = materials[Math.floor(Math.random() * materials.length)].clone(); // 克隆材质以独立控制
        const sprite = new THREE.Sprite(mat);
        
        // 随机分布：宽范围，深景深
        sprite.position.x = (Math.random() - 0.5) * 200;
        sprite.position.y = (Math.random() - 0.5) * 120;
        sprite.position.z = (Math.random() - 0.5) * 100;
        
        // 随机大小 (近大远小)
        const scale = 0.5 + Math.random() * 1.5;
        sprite.scale.set(scale, scale, 1);
        
        // 自定义属性：速度极慢，相位偏移
        sprite.userData = {
            velocity: 0.02 + Math.random() * 0.05, // 极慢下落
            xOffset: Math.random() * 100, // 正弦波相位
            xAmp: 0.5 + Math.random() * 2, // 摆动幅度
            rotSpeed: (Math.random() - 0.5) * 0.02 // 自转
        };
        
        // 随机透明度
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
        const data = sprite.userData;
        
        // 1. Y轴缓慢飘落
        sprite.position.y -= data.velocity;
        
        // 2. X轴正弦波游动 (优雅的波浪)
        sprite.position.x += Math.sin(time * 0.5 + data.xOffset) * 0.01 * data.xAmp;
        
        // 3. Z轴微动 (立体感)
        sprite.position.z += Math.cos(time * 0.3 + data.xOffset) * 0.02;
        
        // 4. 缓慢旋转
        sprite.material.rotation += data.rotSpeed;

        // 5. 循环机制：掉到底部回到顶部
        if (sprite.position.y < -60) {
            sprite.position.y = 60;
            sprite.position.x = (Math.random() - 0.5) * 200;
        }
        
        // 主题颜色适配
        const isLight = document.body.classList.contains('light-mode');
        // 白天：深蓝字；晚上：青白字
        const targetColor = isLight ? new THREE.Color(0x334455) : new THREE.Color(0xccf0ff);
        sprite.material.color.lerp(targetColor, 0.1);
    });

    renderer.render(scene, camera);
}

// ==========================================
// 5. 记忆与聊天
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
        title: "新思维 " + new Date().toLocaleTimeString(),
        messages: [{ role: 'bot', text: "数学之境已开启。我是你的逻辑核心。" }]
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
    if(confirm('删除此记录？')) {
        chatSessions = chatSessions.filter(s => s.id !== id);
        saveData();
        renderHistoryList();
        if (currentSessionId === id) startNewChat();
    }
}
window.deleteSessionProxy = deleteSession;
function updateSidebarActiveState() { document.querySelectorAll('.history-item').forEach(item => item.classList.remove('active')); renderHistoryList(); }
function clearAllHistory() { if(confirm('清空所有？')) { chatSessions = []; startNewChat(); } }

function sendMessage() {
    // 发送时立即取消倒计时
    if (voiceSendTimer) {
        clearTimeout(voiceSendTimer);
        voiceSendTimer = null;
    }
    // 停止录音状态
    if (isRecording) stopVoice();
    
    stopSpeaking(); 
    const input = document.getElementById('chat-input');
    const message = input.value.trim();
    if (!message) return;
    
    displayMessage('user', message, true);
    input.value = '';
    input.placeholder = "输入指令..."; // 恢复提示
    
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
    
    // 布局已经在 CSS 中通过 flex-direction: row-reverse 完美处理了
    // 这里只需要统一添加顺序即可
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

// ==========================================
// 6. 语音自动发送逻辑 (Debounce)
// ==========================================
function initVoiceFeature() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { document.getElementById('mic-btn').style.display = 'none'; return; }
    recognition = new SpeechRecognition(); recognition.lang = 'zh-CN'; recognition.continuous = true; recognition.interimResults = true; 
    
    recognition.onresult = (event) => {
        // 只要还在说话，就清除定时器
        if (voiceSendTimer) clearTimeout(voiceSendTimer);

        let finalTranscript = ''; 
        for (let i = event.resultIndex; i < event.results.length; ++i) { 
            if (event.results[i].isFinal) finalTranscript += event.results[i][0].transcript; 
        }
        if (finalTranscript) { 
            const input = document.getElementById('chat-input'); 
            input.value = input.value ? input.value + finalTranscript : finalTranscript;
            
            // 每次识别到内容，更新UI提示
            input.placeholder = "输入完毕，3秒后发送...";
            
            // 重新开始3秒倒计时
            voiceSendTimer = setTimeout(() => {
                sendMessage(); // 3秒后自动发送
            }, 3000);
        }
    };
    
    // 如果录音意外停止，也尝试重启或发送（可选）
    recognition.onend = () => { 
        if (isRecording) {
            // 如果人为没停，尝试重启录音
            try { recognition.start(); } catch(e){}
        }
    };
}

function toggleVoice() { stopSpeaking(); if (isRecording) stopVoice(); else startVoice(); }

function startVoice() { 
    if (!recognition) return; 
    recognition.start(); 
    isRecording = true; 
    document.getElementById('mic-btn').classList.add('recording'); 
    document.getElementById('chat-input').placeholder = "请说话..."; 
}

function stopVoice() { 
    if (!recognition) return; 
    recognition.stop(); 
    isRecording = false; 
    document.getElementById('mic-btn').classList.remove('recording'); 
    document.getElementById('chat-input').placeholder = "输入指令..."; 
    // 清除定时器
    if (voiceSendTimer) clearTimeout(voiceSendTimer);
}

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