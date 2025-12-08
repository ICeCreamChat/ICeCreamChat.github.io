import * as THREE from 'three';

// ==========================================
// 1. 配置 (锁定 DeepSeek) 
// ==========================================
const API_CONFIG = {
    deepseek: {
        key: 'sk-t741Aph1aaXnU9ZUhGV1NjlYbNBGRSuLw23AYgaLGTqmRRz5',
        url: 'https://edge.tb.api.mkeai.com/v1/chat/completions',
        modelName: 'deepseek-chat'
    }
};

const SYSTEM_PROMPT = `你是一个绝对理性的数学与逻辑助手。
请务必使用 LaTeX 格式输出所有数学公式：
1. 独立公式用 $$...$$ 包裹
2. 行内公式用 $...$ 包裹
3. 你的回答应简洁、精准，并具备上下文逻辑性。`;

// 状态
let isTTSEnabled = false; 
let recognition = null; 
let isRecording = false;
let isSpeaking = false; 
let isManualTheme = false; 

// 语音倒计时
let voiceSendTimer = null;

// 记忆系统 (Local Storage)
let chatSessions = JSON.parse(localStorage.getItem('chatSessions')) || [];
let currentSessionId = localStorage.getItem('currentSessionId') || null;

// 3D 场景变量
let scene, camera, renderer, particles;
let clock = new THREE.Clock();

// ==========================================
// 2. 初始化
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    bindEvents();
    
    checkBeijingTime();
    setInterval(checkBeijingTime, 60000);

    // 初始化显示
    updateModelLabel(); // 锁定显示 DeepSeek
    
    initVoiceFeature();
    initChatSystem(); 
    initCustomCursor(); 
    
    initMathParticleScene();
    
    // 🔥 初始化 AI 幽灵补全功能
    initGhostInputFeature();
    
    if(window.marked) window.marked.setOptions({ breaks: true, gfm: true });
});

// ==========================================
// 3. 点击爆破特效
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
// 6. 记忆与聊天 (DeepSeek 核心逻辑)
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
            closeSidebarMobile();
            return; 
        }
    }

    currentSessionId = Date.now().toString();
    const newSession = {
        id: currentSessionId,
        title: "新突触 " + new Date().toLocaleTimeString(),
        messages: [{ role: 'bot', text: "DeepSeek 神经网络已连接，请下达指令。" }]
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
    closeSidebarMobile();
}

function closeSidebarMobile() {
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
    if(confirm('确认切断此突触连接？')) {
        chatSessions = chatSessions.filter(s => s.id !== id);
        saveData();
        renderHistoryList();
        if (chatSessions.length === 0) {
            startNewChat();
        } else if (currentSessionId === id) {
            loadSession(chatSessions[0].id);
        }
    }
}
window.deleteSessionProxy = deleteSession;
function updateSidebarActiveState() { document.querySelectorAll('.history-item').forEach(item => item.classList.remove('active')); renderHistoryList(); }

function clearAllHistory() { 
    if(confirm('【警告】此操作将执行深度格式化：\n\n1. 清除所有历史对话记忆\n2. 重置所有本地状态\n3. 刷新神经网络连接\n\n确认执行？')) { 
        localStorage.removeItem('chatSessions');
        localStorage.removeItem('currentSessionId');
        chatSessions = [];
        startNewChat();
        alert('系统记忆已重置。');
    } 
}

function sendMessage() {
    if (voiceSendTimer) { clearTimeout(voiceSendTimer); voiceSendTimer = null; }
    if (isRecording) stopVoice();
    stopSpeaking(); 
    
    const input = document.getElementById('chat-input');
    const message = input.value.trim();
    if (!message) return;
    
    // 发送后清空输入框并重置幽灵建议
    displayMessage('user', message, true);
    input.value = '';
    input.placeholder = "输入指令...";
    
    // 手动触发一次建议更新（清空幽灵文字）
    if(window.updateGhostSuggestion) window.updateGhostSuggestion("");
    
    const loading = document.getElementById('loading');
    loading.style.display = 'block';
    
    callDeepSeek(loading);
}

function callDeepSeek(loadingElement) {
    const config = API_CONFIG.deepseek;
    const currentSession = chatSessions.find(s => s.id === currentSessionId);
    const historyMessages = currentSession ? currentSession.messages : [];
    
    const apiMessages = [
        { role: "system", content: SYSTEM_PROMPT }
    ];

    historyMessages.forEach(msg => {
        apiMessages.push({
            role: msg.role === 'bot' ? 'assistant' : 'user',
            content: msg.text
        });
    });

    const payload = { 
        model: config.modelName, 
        messages: apiMessages, 
        stream: false,
        temperature: 0.7
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
            console.error(data);
            displayMessage('bot', 'API Error: 连接深空失败', false);
        }
    })
    .catch(err => handleError(loadingElement, err));
}

function handleError(loading, err) { 
    loading.style.display = 'none'; 
    console.error(err); 
    displayMessage('bot', '网络链路中断，请检查信号。'); 
}

function displayMessage(role, text, shouldSave = false) {
    if (shouldSave) saveMessageToCurrentSession(role, text);

    const container = document.getElementById('messages');
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${role}`;
    
    const avatar = document.createElement('img');
    avatar.src = role === 'user' ? 'user-avatar.jpg' : 'bot-avatar.jpg';
    avatar.onerror = function() { this.style.display = 'none'; };
    
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

// ==========================================
// 7. TTS 与 语音识别
// ==========================================
function toggleTTS() { 
    isTTSEnabled = !isTTSEnabled; 
    document.getElementById('tts-label').textContent = isTTSEnabled ? "🔊 朗读: 开" : "🔇 朗读: 关"; 
    if (!isTTSEnabled) stopSpeaking(); 
    document.getElementById('dropdownMenu').classList.remove('show'); 
}

function speakText(text) {
    if (!isTTSEnabled || !('speechSynthesis' in window)) return;
    const cleanText = text.replace(/[\$\*\#\`]/g, '').replace(/\[.*?\]/g, '').replace(/\n/g, '，');
    const utterance = new SpeechSynthesisUtterance(cleanText);
    const voices = window.speechSynthesis.getVoices();
    const bestVoice = voices.find(v => v.lang.includes('zh') && (v.name.includes('Microsoft') || v.name.includes('Google'))) || voices.find(v => v.lang.includes('zh'));
    if (bestVoice) { utterance.voice = bestVoice; utterance.rate = 1.1; }
    utterance.onstart = () => { isSpeaking = true; }; 
    utterance.onend = () => { isSpeaking = false; }; 
    utterance.onerror = () => { isSpeaking = false; };
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
            
            // 触发一次幽灵建议更新
            updateGhostSuggestion(input.value);
            
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

// ==========================================
// 8. 界面事件绑定
// ==========================================
function toggleDropdown(e) { e.stopPropagation(); document.getElementById('dropdownMenu').classList.toggle('show'); }
window.onclick = function(e) { if (!e.target.closest('.dropdown')) document.getElementById('dropdownMenu').classList.remove('show'); }

function updateModelLabel() {
    const label = document.getElementById('model-label');
    if (label) {
        label.textContent = '🐳 DeepSeek Only';
        label.style.opacity = '0.7'; 
    }
}

function bindEvents() {
    document.getElementById('send-btn').addEventListener('click', sendMessage);
    document.getElementById('mic-btn').addEventListener('click', toggleVoice);
    document.getElementById('more-btn').addEventListener('click', toggleDropdown);
    document.getElementById('btn-tts').addEventListener('click', toggleTTS);
    document.getElementById('btn-theme').addEventListener('click', toggleTheme);
    document.getElementById('btn-clear').addEventListener('click', clearAllHistory);
    document.getElementById('new-chat-btn').addEventListener('click', startNewChat);
    document.getElementById('mobile-menu-btn').addEventListener('click', () => { document.getElementById('sidebar').classList.add('open'); document.getElementById('sidebar-overlay').classList.add('active'); });
    document.getElementById('sidebar-overlay').addEventListener('click', () => { document.getElementById('sidebar').classList.remove('open'); document.getElementById('sidebar-overlay').classList.remove('active'); });
    document.getElementById('chat-input').addEventListener('keypress', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } });
}

// ==========================================
// 9. AI 智能联想补全系统 (Ghost Autocomplete)
// ==========================================
// 核心修复：位置精准定位 + AI 驱动 + 速度优化

let ghostInterval = null;     // 轮播定时器
let ghostDebounceTimer = null; // API 请求防抖定时器
let currentSuggestions = [];   // 当前建议列表
let suggestionIndex = 0;       // 当前显示的索引
let currentGhostSuffix = "";   // 当前显示的后缀

function initGhostInputFeature() {
    const input = document.getElementById('chat-input');
    const ghost = document.getElementById('ghost-input');
    
    if (!input || !ghost) return;

    // 监听输入
    input.addEventListener('input', (e) => {
        const val = e.target.value;
        updateGhostSuggestion(val);
    });

    // 监听按键
    input.addEventListener('keydown', (e) => {
        if ((e.key === 'Tab' || e.key === 'ArrowRight') && currentGhostSuffix) {
            e.preventDefault(); 
            applySuggestion();
        }
    });
    
    // 失去焦点时停止轮播
    input.addEventListener('blur', () => {
        clearInterval(ghostInterval);
    });
    
    // 获得焦点时恢复
    input.addEventListener('focus', () => {
        updateGhostSuggestion(input.value);
    });
}

// 全局暴露
window.updateGhostSuggestion = updateGhostSuggestion;

function updateGhostSuggestion(inputValue) {
    const ghost = document.getElementById('ghost-input');
    if(!ghost) return;

    // 清理状态
    clearInterval(ghostInterval);
    clearTimeout(ghostDebounceTimer);
    
    currentGhostSuffix = "";
    ghost.textContent = "";
    ghost.style.opacity = '0';
    
    if (!inputValue || inputValue.trim() === "") return;

    // 防抖 0.6s
    ghostDebounceTimer = setTimeout(() => {
        fetchAISuggestions(inputValue);
    }, 600);
}

// AI 获取联想
async function fetchAISuggestions(inputValue) {
    const config = API_CONFIG.deepseek;
    
    try {
        const response = await fetch(config.url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.key}`
            },
            body: JSON.stringify({
                model: config.modelName,
                messages: [
                    {
                        role: "system", 
                        content: `你是一个数学与逻辑自动补全引擎。请根据用户输入的【前缀】，联想并返回 3-5 个用户可能想要输入的完整数学/物理/逻辑术语或短语。
要求：
1. 返回格式必须是纯 JSON 字符串数组 (e.g. ["等差数列", "等差中项"])。
2. 所有建议必须严格以用户输入的【前缀】开头。
3. 不要包含任何 Markdown 标记或解释文字。`
                    },
                    { role: "user", content: inputValue }
                ],
                stream: false,
                max_tokens: 50,
                temperature: 0.3
            })
        });

        const data = await response.json();
        if (data.choices && data.choices.length > 0) {
            let content = data.choices[0].message.content.trim();
            content = content.replace(/```json/g, '').replace(/```/g, '').trim();
            
            let suggestions = [];
            try {
                suggestions = JSON.parse(content);
            } catch (e) { return; }

            currentSuggestions = suggestions.filter(s => 
                typeof s === 'string' && 
                s.toLowerCase().startsWith(inputValue.toLowerCase()) && 
                s.length > inputValue.length
            );

            if (currentSuggestions.length > 0) {
                suggestionIndex = 0;
                showGhost(inputValue);
                
                if (currentSuggestions.length > 1) {
                    // 修改：轮播间隔改为 2000ms
                    ghostInterval = setInterval(() => {
                        cycleNextSuggestion(inputValue);
                    }, 2000); 
                }
            }
        }
    } catch (error) {
        console.error("Ghost API error:", error);
    }
}

// 核心修复：精准定位
function showGhost(inputValue) {
    const ghost = document.getElementById('ghost-input');
    const input = document.getElementById('chat-input');
    
    const fullSuggestion = currentSuggestions[suggestionIndex];
    const suffix = fullSuggestion.substring(inputValue.length);
    currentGhostSuffix = suffix;
    
    // 1. 获取输入框的计算样式
    const style = window.getComputedStyle(input);
    // 2. 构建准确的 font 字符串
    const font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    // 3. 计算文字像素宽度
    const textWidth = getTextWidth(inputValue, font);
    // 4. 获取左内边距
    const paddingLeft = parseFloat(style.paddingLeft) || 10;
    
    // 设置内容
    ghost.textContent = suffix;
    // 5. 绝对定位：paddingLeft + 文字宽度
    ghost.style.left = (paddingLeft + textWidth) + 'px'; 
    
    ghost.classList.remove('ghost-cycle-anim');
    ghost.style.opacity = '0.5';
}

function cycleNextSuggestion(inputValue) {
    const ghost = document.getElementById('ghost-input');
    ghost.classList.add('ghost-cycle-anim');
    
    setTimeout(() => {
        suggestionIndex = (suggestionIndex + 1) % currentSuggestions.length;
        showGhost(inputValue);
    }, 300); 
}

function applySuggestion() {
    const input = document.getElementById('chat-input');
    const fullText = input.value + currentGhostSuffix;
    
    input.value = fullText;
    updateGhostSuggestion(fullText);
    
    if (typeof createExplosion === 'function') {
        const rect = input.getBoundingClientRect();
        createExplosion(rect.right - 50, rect.top + rect.height / 2);
    }
}

// 辅助工具：Canvas 测量文字宽度
function getTextWidth(text, font) {
    const canvas = getTextWidth.canvas || (getTextWidth.canvas = document.createElement("canvas"));
    const context = canvas.getContext("2d");
    context.font = font;
    return context.measureText(text).width;
}