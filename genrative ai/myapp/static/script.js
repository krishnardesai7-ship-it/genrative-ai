const MODELS = {
  gemini: [
    { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (Fast Text, Vision & Video Script)' },
    { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro (High Quality, Vision & Video Script)' },
    { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash (Fast Text, Vision & Video Script)' },
    { id: 'gemini-2.0-flash-lite', label: 'Gemini 2.0 Flash Lite (Lightweight Text & Video Script)' },
  ],
  mistral: [
    { id: 'pixtral-12b-2409', label: 'Pixtral 12B (Fast Vision & Image Chat)' },
    { id: 'pixtral-large-latest', label: 'Pixtral Large (Advanced Vision & High Quality)' },
    { id: 'mistral-large-latest', label: 'Mistral Large (High Quality Text & Reasoning)' },
    { id: 'mistral-medium-latest', label: 'Mistral Medium (Standard Chat)' },
    { id: 'mistral-small-latest', label: 'Mistral Small (Fast Text Chat)' },
    { id: 'open-mixtral-8x7b', label: 'Mixtral 8x7B (Balanced Open Source Model)' },
    { id: 'open-mistral-7b', label: 'Mistral 7B (Lightweight Chat)' },
  ],
  groq: [
    { id: 'llama-3.2-11b-vision-preview', label: 'LLaMA 3.2 11B Vision (Fast Vision & Image Chat)' },
    { id: 'llama-3.2-90b-vision-preview', label: 'LLaMA 3.2 90B Vision (Advanced Vision & Image Chat)' },
    { id: 'llama-3.3-70b-versatile', label: 'LLaMA 3.3 70B (High Quality Text & Coding)' },
    { id: 'llama-3.1-8b-instant', label: 'LLaMA 3.1 8B Instant (Ultra-fast Text Chat)' },
    { id: 'mixtral-8x7b-32768', label: 'Mixtral 8x7B (Standard Text Chat)' },
    { id: 'gemma2-9b-it', label: 'Gemma 2 9B (Google Lightweight Chat)' },
    { id: 'deepseek-r1-distill-llama-70b', label: 'DeepSeek R1 70B (Deep Reasoning, Math & Coding)' },
  ],
};

const FREE_MESSAGE_LIMIT = 5;

let state = {
  provider: localStorage.getItem('nx_provider') || 'gemini',
  model: localStorage.getItem('nx_model') || MODELS.gemini[0].id,
  conversations: JSON.parse(localStorage.getItem('nx_convs') || '[]'),
  activeConvId: null,
  messages: [],
  isStreaming: false,
  pendingImages: [],
  theme: localStorage.getItem('nx_theme') || 'dark',
  freeMessagesSent: parseInt(localStorage.getItem('nx_free_messages_sent') || '0', 10) || 0,
};

const $ = id => document.getElementById(id);
const themeToggle = $('themeToggle');
const themeIcon = $('themeIcon');
const settingsOverlay = $('settingsOverlay');
const providerSelect = $('providerSelect');
const modelSelect = $('modelSelect');
const modelPicker = $('modelPicker');
const messagesContainer = $('messagesContainer');
const welcomeScreen = $('welcomeScreen');
const userInput = $('userInput');
const imageInput = $('imageInput');
const videoInput = $('videoInput');
const plusBtn = $('plusBtn');
const plusDropdownMenu = $('plusDropdownMenu');
const menuUploadImage = $('menuUploadImage');
const menuUploadVideo = $('menuUploadVideo');
const menuClearChat = $('menuClearChat');
const menuExportChat = $('menuExportChat');
const imagePreview = $('imagePreview');
const imagePreviewThumb = $('imagePreviewThumb');
const imagePreviewName = $('imagePreviewName');
const removeImageBtn = $('removeImageBtn');
const sendBtn = $('sendBtn');
const charCount = $('charCount');
const modelPill = $('modelPill');
const chatTitle = $('chatTitle');
const badgeText = $('badgeText');
const badgeDot = document.querySelector('.badge-dot');
const conversationList = $('conversationList');
const sidebar = $('sidebar');
const toast = $('toast');
const loginOverlay = $('loginOverlay');
const closeLogin = $('closeLogin');
const loginForm = $('loginForm');
const googleLoginBtn = $('googleLoginBtn');
const googleAccountOverlay = $('googleAccountOverlay');

function applyTheme(theme) {
  state.theme = theme;
  localStorage.setItem('nx_theme', theme);
  document.body.setAttribute('data-theme', theme);
  
  if (!themeIcon) return;
  if (theme === 'light') {
    // Moon icon to switch to dark
    themeIcon.innerHTML = `<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>`;
    themeToggle.title = 'Switch to Dark Mode';
  } else {
    // Sun icon to switch to light
    themeIcon.innerHTML = `
      <circle cx="12" cy="12" r="5"></circle>
      <line x1="12" y1="1" x2="12" y2="3"></line>
      <line x1="12" y1="21" x2="12" y2="23"></line>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
      <line x1="1" y1="12" x2="3" y2="12"></line>
      <line x1="21" y1="12" x2="23" y2="12"></line>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
    `;
    themeToggle.title = 'Switch to Light Mode';
  }
}

function showToast(msg, type = '') {
  toast.textContent = msg;
  toast.className = `toast show ${type}`;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { toast.className = 'toast'; }, 3000);
}

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function escapeHtml(t) {
  return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function markdownToHtml(text) {
  const escaped = escapeHtml(text);
  return escaped
    .replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) =>
      `<pre><code class="lang-${lang}">${code.trim()}</code></pre>`)
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" class="message-image" style="max-width:100%; border-radius:12px; margin:8px 0;">')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" style="color:var(--primary);text-decoration:underline;">$1</a>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>[\s\S]*?<\/li>)/g, '<ul>$1</ul>')
    .replace(/\n\n+/g, '</p><p>')
    .replace(/\n/g, '<br>');
}

// Alias so both AI and error replies get markdown rendering
const renderMarkdown = markdownToHtml;

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
  return '';
}

function getProviderLabel(provider) {
  return { gemini: 'Gemini', mistral: 'Mistral', groq: 'Groq' }[provider] || 'AI';
}

function normalizeSelection(provider, model) {
  const safeProvider = MODELS[provider] ? provider : 'gemini';
  const providerModels = MODELS[safeProvider];
  const safeModel = providerModels.some(item => item.id === model)
    ? model
    : providerModels[0].id;
  return { provider: safeProvider, model: safeModel };
}

function isUserLoggedIn() {
  return Boolean(localStorage.getItem('nx_user_email'));
}

function openLoginOverlay() {
  if (loginOverlay) loginOverlay.classList.add('active');
}

function calculateFreeMessagesFromStorage() {
  let count = 0;
  state.conversations.forEach(conv => {
    if (!conv.messages) return;
    count += conv.messages.filter(m => m.role === 'user').length;
  });
  return count;
}

function saveFreeMessageCount() {
  localStorage.setItem('nx_free_messages_sent', String(state.freeMessagesSent));
}

function incrementFreeMessageCount() {
  state.freeMessagesSent += 1;
  saveFreeMessageCount();
}

function resetFreeMessageCount() {
  state.freeMessagesSent = 0;
  saveFreeMessageCount();
}

function canSendFreeMessage() {
  return isUserLoggedIn() || state.freeMessagesSent < FREE_MESSAGE_LIMIT;
}

function applyModelSelection(provider, model) {
  const selection = normalizeSelection(provider, model);
  state.provider = selection.provider;
  state.model = selection.model;
  localStorage.setItem('nx_provider', state.provider);
  localStorage.setItem('nx_model', state.model);
  providerSelect.value = state.provider;
  populateModels(state.provider);
  modelSelect.value = state.model;
  modelPicker.value = `${state.provider}:${state.model}`;
  updateBadge();
}

function openSettings() {
  providerSelect.value = state.provider;
  populateModels(state.provider);
  modelSelect.value = state.model;
  settingsOverlay.classList.add('active');
}

function closeSettings() {
  settingsOverlay.classList.remove('active');
}

function populateModels(provider) {
  modelSelect.innerHTML = '';
  MODELS[provider].forEach(model => {
    const opt = document.createElement('option');
    opt.value = model.id;
    opt.textContent = model.label;
    modelSelect.appendChild(opt);
  });
  modelSelect.value = MODELS[provider].some(model => model.id === state.model)
    ? state.model
    : MODELS[provider][0].id;
}

function populateModelPicker() {
  if (!modelPicker) return;
  modelPicker.innerHTML = '';
  Object.entries(MODELS).forEach(([provider, models]) => {
    models.forEach(model => {
      const opt = document.createElement('option');
      opt.value = `${provider}:${model.id}`;
      opt.textContent = `${getProviderLabel(provider)} • ${model.label}`;
      modelPicker.appendChild(opt);
    });
  });
  modelPicker.value = `${state.provider}:${state.model}`;
}

providerSelect.addEventListener('change', () => {
  populateModels(providerSelect.value);
});

modelPicker.addEventListener('change', () => {
  const [provider, model] = modelPicker.value.split(':');
  applyModelSelection(provider, model);
  showToast('Model updated', 'success');
});

$('saveSettings').addEventListener('click', () => {
  applyModelSelection(providerSelect.value, modelSelect.value);
  closeSettings();
  showToast('Model saved', 'success');
});

$('closeSettings').addEventListener('click', closeSettings);
settingsOverlay.addEventListener('click', e => {
  if (e.target === settingsOverlay) closeSettings();
});
$('openSettings').addEventListener('click', openSettings);
$('welcomeSetupBtn').addEventListener('click', openSettings);

function updateBadge() {
  const providerName = { gemini: 'Gemini', mistral: 'Mistral', groq: 'Groq' }[state.provider];
  const modelLabel = MODELS[state.provider].find(model => model.id === state.model)?.label || state.model;
  badgeText.textContent = `${providerName} Ready`;
  badgeDot.classList.add('connected');
  modelPill.textContent = `${providerName} - ${modelLabel}`;
  modelPill.classList.add('active');
  document.body.setAttribute('data-provider', state.provider);
}

$('sidebarOpen').addEventListener('click', () => sidebar.classList.add('open'));
$('sidebarClose').addEventListener('click', () => sidebar.classList.remove('open'));

function updateUserProfile(email, name, picture) {
  const userProfileIcon = $('userProfileIcon');
  const fullUserEmail = $('fullUserEmail');

  if (userProfileIcon && email) {
    userProfileIcon.style.display = 'flex';
    if (picture) {
      userProfileIcon.style.backgroundImage = `url('${picture}')`;
      userProfileIcon.style.backgroundSize = 'cover';
      userProfileIcon.style.backgroundPosition = 'center';
      userProfileIcon.textContent = '';
    } else {
      userProfileIcon.style.backgroundImage = '';
      const displayName = name || email;
      userProfileIcon.textContent = displayName.charAt(0).toUpperCase();
    }
    userProfileIcon.title = `Signed in as ${name || email}`;
  } else if (userProfileIcon) {
    userProfileIcon.style.display = 'none';
    userProfileIcon.style.backgroundImage = '';
  }

  if (fullUserEmail && email) {
    fullUserEmail.textContent = name ? `${name} (${email})` : email;
  }
}

// On load, check if logged in
const savedUserEmail = localStorage.getItem('nx_user_email');
const savedUserName = localStorage.getItem('nx_user_name');
const savedUserPicture = localStorage.getItem('nx_user_picture');
if (savedUserEmail) {
  updateUserProfile(savedUserEmail, savedUserName, savedUserPicture);
}

// User Profile Dropdown
const userProfileIcon = $('userProfileIcon');
const userDropdownMenu = $('userDropdownMenu');
if (userProfileIcon && userDropdownMenu) {
  userProfileIcon.addEventListener('click', (e) => {
    e.stopPropagation();
    userDropdownMenu.classList.toggle('active');
  });
  
  document.addEventListener('click', (e) => {
    if (!userDropdownMenu.contains(e.target) && e.target !== userProfileIcon) {
      userDropdownMenu.classList.remove('active');
    }
  });
}

const switchAccountBtn = $('switchAccountBtn');
if (switchAccountBtn) {
  switchAccountBtn.addEventListener('click', () => {
    if (userDropdownMenu) userDropdownMenu.classList.remove('active');
    if (loginOverlay) loginOverlay.classList.add('active');
    
    // Clear user data on switch
    localStorage.removeItem('nx_user_email');
    updateUserProfile(null);
  });
}

if (closeLogin) {
  closeLogin.addEventListener('click', () => loginOverlay.classList.remove('active'));
}
if (loginForm) {
  loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const emailInput = $('loginEmail');
    const email = emailInput ? emailInput.value : 'user@example.com';
    const name = email.split('@')[0];
    
    showToast('Login successful! Welcome back.', 'success');
    loginOverlay.classList.remove('active');
    localStorage.setItem('nx_user_email', email);
    updateUserProfile(email);
    resetFreeMessageCount();
    updateSendState();
    
    // Sync user with backend database
    syncUserWithBackend(email, name);
  });
}
// ── Google Account Chooser (Shows ONLY saved email) ────────────────

const googleAccountBody = $('googleAccountBody');

/** Build and show the Google-style account chooser dialog */
function openGoogleAccountChooser() {
  if (!googleAccountBody) return;
  googleAccountBody.innerHTML = ''; // clear previous

  const savedEmail = localStorage.getItem('nx_user_email') || '';
  const savedName  = localStorage.getItem('nx_user_name')  || '';
  const savedPic   = localStorage.getItem('nx_user_picture') || '';

  if (savedEmail) {
    // ── Show the saved account row ──────────────────────────────────
    const initial = (savedName || savedEmail).charAt(0).toUpperCase();
    const avatarStyle = savedPic
      ? `background-image:url('${savedPic}');background-size:cover;background-position:center;color:transparent;`
      : 'background:#4285F4;color:#fff;';

    const row = document.createElement('div');
    row.className = 'google-account-item';
    row.style.cssText = 'padding:12px 24px;cursor:pointer;';
    row.innerHTML = `
      <div class="google-avatar" style="${avatarStyle}font-family:'Inter',sans-serif;font-size:16px;font-weight:600;width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-right:16px;">
        ${savedPic ? '' : initial}
      </div>
      <div class="google-account-info" style="text-align:left;">
        <div class="google-name" style="font-family:'Inter',sans-serif;font-size:14px;font-weight:500;color:#202124;">
          ${savedName || savedEmail.split('@')[0]}
        </div>
        <div class="google-email" style="font-family:'Inter',sans-serif;font-size:13px;color:#5f6368;">
          ${savedEmail}
        </div>
      </div>`;

    row.addEventListener('click', () => {
      _applyGoogleUser(savedEmail, savedName, savedPic);
    });

    googleAccountBody.appendChild(row);

    // "Use another account" option
    const useAnother = document.createElement('div');
    useAnother.className = 'google-account-item';
    useAnother.style.cssText = 'padding:12px 24px;cursor:pointer;border-top:1px solid #f1f3f4;';
    useAnother.innerHTML = `
      <div style="width:40px;height:40px;border-radius:50%;background:#f1f3f4;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-right:16px;">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="#5f6368"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11h-4v4h-2v-4H7v-2h4V7h2v4h4v2z"/></svg>
      </div>
      <div class="google-account-info">
        <div class="google-name" style="font-family:'Inter',sans-serif;font-size:14px;font-weight:500;color:#3c4043;">Use another account</div>
      </div>`;
    useAnother.addEventListener('click', () => _showGoogleEmailInput());
    googleAccountBody.appendChild(useAnother);

  } else {
    // No saved account — show input to add Gmail
    _showGoogleEmailInput();
  }

  if (googleAccountOverlay) googleAccountOverlay.classList.add('active');
}

/** Show an email input field inside the chooser */
function _showGoogleEmailInput() {
  if (!googleAccountBody) return;
  googleAccountBody.innerHTML = `
    <div style="padding:8px 24px 16px;">
      <p style="font-family:'Inter',sans-serif;font-size:13px;color:#5f6368;margin:0 0 12px;">Enter your Google email address:</p>
      <input id="googleEmailInput" type="email" placeholder="yourname@gmail.com"
        style="width:100%;box-sizing:border-box;border:1px solid #dadce0;border-radius:4px;padding:10px 14px;font-family:'Inter',sans-serif;font-size:14px;color:#202124;outline:none;transition:border 0.2s;"
        onfocus="this.style.borderColor='#1a73e8'" onblur="this.style.borderColor='#dadce0'"/>
      <button id="googleEmailSubmit"
        style="margin-top:12px;width:100%;background:#1a73e8;color:#fff;border:none;border-radius:4px;padding:10px;font-family:'Inter',sans-serif;font-size:14px;font-weight:500;cursor:pointer;transition:background 0.2s;"
        onmouseover="this.style.background='#1557b0'" onmouseout="this.style.background='#1a73e8'">
        Continue
      </button>
    </div>`;

  const input  = $('googleEmailInput');
  const submit = $('googleEmailSubmit');

  const doSubmit = () => {
    const email = input ? input.value.trim() : '';
    if (!email || !email.includes('@')) {
      if (input) { input.style.borderColor = '#d93025'; input.focus(); }
      return;
    }
    const name = email.split('@')[0];
    _applyGoogleUser(email, name, '');
  };

  if (submit) submit.addEventListener('click', doSubmit);
  if (input)  input.addEventListener('keydown', e => { if (e.key === 'Enter') doSubmit(); });
  if (input)  setTimeout(() => input.focus(), 100);
}

async function syncUserWithBackend(email, name) {
  try {
    const res = await fetch('/login/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': getCookie('csrftoken'),
      },
      body: JSON.stringify({ email, name }),
    });
    const data = await res.json();
    if (data.status === 'success') {
      console.log('User synced with database:', data.user);
    } else {
      console.error('Backend sync failed:', data.message);
    }
  } catch (err) {
    console.error('Error syncing user with database:', err);
  }
}

function _applyGoogleUser(email, name, picture) {
  if (!email) return;
  if (googleAccountOverlay) googleAccountOverlay.classList.remove('active');
  if (loginOverlay) loginOverlay.classList.remove('active');
  localStorage.setItem('nx_user_email', email);
  if (name)    localStorage.setItem('nx_user_name', name);
  if (picture) localStorage.setItem('nx_user_picture', picture);
  updateUserProfile(email, name, picture);
  showToast(`✅ Signed in as ${name || email}`, 'success');
  
  // Sync user with backend database
  syncUserWithBackend(email, name);
}

if (googleLoginBtn) {
  googleLoginBtn.addEventListener('click', openGoogleAccountChooser);
}

if ($('googleCloseBtn')) {
  $('googleCloseBtn').addEventListener('click', () => {
    if (googleAccountOverlay) googleAccountOverlay.classList.remove('active');
  });
}


function getStorageSafeConversations() {
  return state.conversations.map(conv => {
    return {
      ...conv,
      messages: conv.messages.map(msg => {
        if (!msg.images && !msg.image) return msg;
        const newMsg = { ...msg };
        if (newMsg.images) {
          newMsg.images = newMsg.images.map(img => {
            const isVideo = img.mimeType && img.mimeType.startsWith('video/');
            const isTooLarge = img.dataUrl && img.dataUrl.length > 500000;
            return {
              name: img.name,
              mimeType: img.mimeType,
              dataUrl: (isVideo || isTooLarge) ? null : img.dataUrl,
              data: (isVideo || isTooLarge) ? null : img.data
            };
          });
        }
        if (newMsg.image) {
          const isTooLarge = newMsg.image.dataUrl && newMsg.image.dataUrl.length > 500000;
          newMsg.image = {
            name: newMsg.image.name,
            mimeType: newMsg.image.mimeType,
            dataUrl: isTooLarge ? null : newMsg.image.dataUrl,
            data: isTooLarge ? null : newMsg.image.data
          };
        }
        return newMsg;
      })
    };
  });
}

function saveConversations() {
  try {
    localStorage.setItem('nx_convs', JSON.stringify(getStorageSafeConversations()));
  } catch (e) {
    console.error("Storage error:", e);
    if (state.conversations.length > 1) {
      state.conversations.shift();
      saveConversations();
    } else {
      showToast("Could not save chat history (storage full).", "error");
    }
  }
}

function renderConversationList() {
  conversationList.innerHTML = '';
  const label = document.createElement('p');
  label.className = 'list-label';
  label.textContent = state.conversations.length ? 'History' : 'No history yet';
  conversationList.appendChild(label);

  [...state.conversations].reverse().forEach(conv => {
    const div = document.createElement('div');
    div.className = 'conv-item' + (conv.id === state.activeConvId ? ' active' : '');
    div.dataset.id = conv.id;
    div.innerHTML = `<span>${escapeHtml(conv.title)}</span><button class="conv-del" data-id="${conv.id}" title="Delete">x</button>`;
    div.addEventListener('click', e => {
      if (e.target.classList.contains('conv-del')) return;
      loadConversation(conv.id);
    });
    div.querySelector('.conv-del').addEventListener('click', e => {
      e.stopPropagation();
      deleteConversation(conv.id);
    });
    conversationList.appendChild(div);
  });
}

function loadConversation(id) {
  const conv = state.conversations.find(c => c.id === id);
  if (!conv) return;
  state.activeConvId = id;
  state.messages = [...conv.messages];
  chatTitle.textContent = conv.title;
  renderMessages();
  renderConversationList();
  sidebar.classList.remove('open');
}

function deleteConversation(id) {
  state.conversations = state.conversations.filter(c => c.id !== id);
  if (state.activeConvId === id) startNewChat();
  saveConversations();
  renderConversationList();
  showToast('Conversation deleted');
}

function startNewChat() {
  state.activeConvId = null;
  state.messages = [];
  chatTitle.textContent = 'New Conversation';
  messagesContainer.innerHTML = '';
  messagesContainer.appendChild(welcomeScreen);
  welcomeScreen.style.display = 'flex';
  renderConversationList();
}

$('newChatBtn').addEventListener('click', startNewChat);

function saveCurrentConversation() {
  if (!state.messages.length) return;
  const firstUserMsg = state.messages.find(m => m.role === 'user');
  const title = firstUserMsg
    ? firstUserMsg.content.slice(0, 40) + (firstUserMsg.content.length > 40 ? '...' : '')
    : 'Conversation';

  if (state.activeConvId) {
    const idx = state.conversations.findIndex(c => c.id === state.activeConvId);
    if (idx >= 0) {
      state.conversations[idx].messages = [...state.messages];
      state.conversations[idx].title = title;
    }
  } else {
    state.activeConvId = generateId();
    state.conversations.push({ id: state.activeConvId, title, messages: [...state.messages] });
  }
  chatTitle.textContent = title;
  saveConversations();
  renderConversationList();
}

function renderMessages() {
  messagesContainer.innerHTML = '';
  if (!state.messages.length) {
    messagesContainer.appendChild(welcomeScreen);
    welcomeScreen.style.display = 'flex';
    return;
  }
  welcomeScreen.style.display = 'none';
  state.messages.forEach(msg => appendMessage(msg, false));
  scrollBottom();
}

function appendMessage(msg, animate = true) {
  if (welcomeScreen.parentNode === messagesContainer) {
    welcomeScreen.style.display = 'none';
  }

  const isUser = msg.role === 'user';
  const div = document.createElement('div');
  div.className = `message ${isUser ? 'user' : 'ai'}`;
  if (!animate) div.style.animation = 'none';

  let imagesHtml = '';
  if (msg.images && msg.images.length) {
    imagesHtml = `<div class="message-images-grid">` + 
      msg.images.map(img => {
        if (img.mimeType && img.mimeType.startsWith('video/')) {
          return img.dataUrl 
            ? `<video class="message-image" src="${img.dataUrl}" controls style="max-width:100%; border-radius:12px; margin:8px 0;"></video>`
            : `<div class="message-image file-placeholder" style="padding:15px; background:rgba(255,255,255,0.05); border-radius:12px; margin:8px 0; border: 1px dashed var(--border); display:flex; align-items:center; gap:8px;">🎥 <span style="font-size:0.85em; opacity:0.8;">${escapeHtml(img.name || 'Video')} (Storage Optimized)</span></div>`;
        } else {
          return img.dataUrl 
            ? `<img class="message-image" src="${img.dataUrl}" alt="${escapeHtml(img.name || 'Uploaded image')}">`
            : `<div class="message-image file-placeholder" style="padding:15px; background:rgba(255,255,255,0.05); border-radius:12px; margin:8px 0; border: 1px dashed var(--border); display:flex; align-items:center; gap:8px;">🖼️ <span style="font-size:0.85em; opacity:0.8;">${escapeHtml(img.name || 'Image')} (Storage Optimized)</span></div>`;
        }
      }).join('') +
      `</div>`;
  } else if (msg.image) {
    imagesHtml = `<div class="message-images-grid">` + 
      (msg.image.dataUrl 
        ? `<img class="message-image" src="${msg.image.dataUrl}" alt="${escapeHtml(msg.image.name || 'Uploaded image')}">`
        : `<div class="message-image file-placeholder" style="padding:15px; background:rgba(255,255,255,0.05); border-radius:12px; margin:8px 0; border: 1px dashed var(--border); display:flex; align-items:center; gap:8px;">🖼️ <span style="font-size:0.85em; opacity:0.8;">${escapeHtml(msg.image.name || 'Image')} (Storage Optimized)</span></div>`) +
      `</div>`;
  }

  // For user messages: show plain text. For AI: render markdown.
  let textHtml = '';
  if (msg.content) {
    textHtml = isUser ? escapeHtml(msg.content) : renderMarkdown(msg.content);
  }

  // If user sent only images with no text, show a subtle label
  const hasImages = (msg.images && msg.images.length > 0) || msg.image?.dataUrl;
  const showImageLabel = isUser && hasImages && !msg.content;
  const contentHtml = [
    imagesHtml,
    showImageLabel ? `<em class="img-only-label">📎 Media sent</em>` : '',
    textHtml ? `<p>${textHtml}</p>` : '',
  ].join('');

  div.innerHTML = `
    <div class="avatar ${isUser ? 'user' : 'ai'}">${isUser ? 'U' : 'AI'}</div>
    <div class="bubble-wrap">
      <div class="bubble ${isUser ? 'user' : 'ai'}">${contentHtml}</div>
      <div class="msg-meta">
        <span>${formatTime(msg.ts || Date.now())}</span>
        ${!isUser ? '<button class="copy-btn" onclick="copyMsg(this)">Copy</button>' : ''}
      </div>
    </div>`;
  messagesContainer.appendChild(div);
  if (animate) scrollBottom();
}

function copyMsg(btn) {
  const text = btn.closest('.bubble-wrap').querySelector('.bubble').innerText;
  navigator.clipboard.writeText(text).then(() => {
    btn.textContent = 'Copied';
    setTimeout(() => { btn.textContent = 'Copy'; }, 1500);
  });
}
window.copyMsg = copyMsg;

function showTyping() {
  const div = document.createElement('div');
  div.className = 'message ai';
  div.id = 'typingMsg';
  div.innerHTML = `
    <div class="avatar ai">AI</div>
    <div class="bubble-wrap">
      <div class="bubble ai">
        <div class="typing-indicator">
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
        </div>
      </div>
    </div>`;
  messagesContainer.appendChild(div);
  scrollBottom();
}

function removeTyping() {
  $('typingMsg')?.remove();
}

function scrollBottom() {
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

async function callAPI(messages) {
  const res = await fetch('/chat/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRFToken': getCookie('csrftoken'),
    },
    body: JSON.stringify({
      provider: state.provider,
      model: state.model,
      messages,
    }),
  });
  const data = await res.json();
  return data.reply || 'No response generated.';
}

function updateSendState() {
  sendBtn.disabled = (!userInput.value.trim() && state.pendingImages.length === 0) || state.isStreaming;
}

function renderPendingImages() {
  if (state.pendingImages.length === 0) {
    imagePreview.hidden = true;
    imagePreview.innerHTML = '';
    imageInput.value = '';
    if (videoInput) videoInput.value = '';
    updateSendState();
    return;
  }
  
  imagePreview.innerHTML = '';
  state.pendingImages.forEach((img, idx) => {
    const item = document.createElement('div');
    item.className = 'image-preview-item';
    item.dataset.index = idx;
    
    let mediaEl;
    if (img.mimeType && img.mimeType.startsWith('video/')) {
      mediaEl = document.createElement('video');
      mediaEl.src = img.dataUrl;
      mediaEl.style.maxWidth = '60px';
      mediaEl.style.maxHeight = '60px';
      mediaEl.style.borderRadius = '4px';
    } else {
      mediaEl = document.createElement('img');
      mediaEl.src = img.dataUrl;
    }
    mediaEl.alt = img.name;
    
    const spanEl = document.createElement('span');
    spanEl.className = 'preview-name';
    spanEl.textContent = img.name;
    
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'remove-preview-btn';
    removeBtn.textContent = 'x';
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      removePendingImage(idx);
    });
    
    item.appendChild(mediaEl);
    item.appendChild(spanEl);
    item.appendChild(removeBtn);
    imagePreview.appendChild(item);
  });
  
  imagePreview.hidden = false;
  updateSendState();
}

function removePendingImage(idx) {
  state.pendingImages.splice(idx, 1);
  renderPendingImages();
}

function clearPendingImages() {
  state.pendingImages = [];
  renderPendingImages();
}

function addPendingFiles(files) {
  if (!files || files.length === 0) return;

  Array.from(files).forEach(file => {
    const isVideo = file.type.startsWith('video/');
    const isImage = file.type.startsWith('image/');

    if (!isImage && !isVideo) {
      showToast(`File "${file.name}" is not supported`, 'error');
      return;
    }

    if (isVideo && file.size > 60 * 1024 * 1024) {
      showToast(`Video "${file.name}" is too large. Max size 60 MB`, 'error');
      return;
    }
    
    if (isImage && file.size > 20 * 1024 * 1024) {
      showToast(`Image "${file.name}" is too large. Max size 20 MB`, 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      state.pendingImages.push({
        name: file.name,
        mimeType: file.type,
        dataUrl,
        data: dataUrl.split(',')[1],
      });
      renderPendingImages();
    };
    reader.readAsDataURL(file);
  });
}

async function extractFramesFromVideo(videoDataUrl, name, maxFrames = 3) {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.src = videoDataUrl;
    video.muted = true;
    video.playsInline = true;
    video.crossOrigin = 'anonymous';
    
    const frames = [];
    let frameIndex = 0;
    let duration = 0;
    
    video.onloadedmetadata = () => {
      duration = video.duration;
      if (duration < 1) maxFrames = 1;
      video.currentTime = duration * 0.2; // First frame at 20%
    };
    
    video.onseeked = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Scale down if it's massive to save bandwidth
        if (canvas.width > 1280) {
            const scale = 1280 / canvas.width;
            canvas.width = 1280;
            canvas.height = video.videoHeight * scale;
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        }

        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        frames.push({
          name: `${name} (Frame ${frameIndex + 1})`,
          mimeType: 'image/jpeg',
          dataUrl: dataUrl,
          data: dataUrl.split(',')[1]
        });
      } catch (e) {
        console.error("Frame extraction error", e);
      }
      
      frameIndex++;
      if (frameIndex === 1 && maxFrames >= 2) {
        video.currentTime = duration * 0.5; // Middle
      } else if (frameIndex === 2 && maxFrames >= 3) {
        video.currentTime = duration * 0.8; // End
      } else {
        resolve(frames);
      }
    };
    
    video.onerror = () => resolve(frames);
  });
}

async function sendMessage(text) {
  if ((!text && state.pendingImages.length === 0) || state.isStreaming) return;
  if (!canSendFreeMessage()) {
    showToast('Youve reached the 5-message free limit. Please sign in to continue.', 'error');
    openLoginOverlay();
    return;
  }

  state.isStreaming = true;
  sendBtn.disabled = true;
  userInput.value = '';
  userInput.style.height = 'auto';
  charCount.textContent = '0';

  // If images/videos attached but no text, use a descriptive prompt
  const hasVideo = state.pendingImages.some(img => img.mimeType && img.mimeType.startsWith('video/'));
  const hasMedia = state.pendingImages.length > 0;
  
  let defaultPrompt = 'Please analyze and describe the attached media in detail.';
  if (hasVideo) {
    defaultPrompt = 'Please analyze and describe the attached video in detail. Also, transcribe all spoken words and audio content into a text transcript (audio script) and display it clearly.';
  }
  const messageText = text || (hasMedia ? defaultPrompt : '');

  const userMsg = {
    role: 'user',
    content: messageText,
    images: [...state.pendingImages],
    apiImages: null,
    ts: Date.now(),
  };
  
  clearPendingImages();
  state.messages.push(userMsg);
  if (!isUserLoggedIn()) {
    incrementFreeMessageCount();
  }
  appendMessage(userMsg);
  showTyping();
  
  let finalMedia = [];
  let needsExtraction = false;
  const isGemini = state.provider === 'gemini';
  for (const f of userMsg.images) {
    if (f.mimeType && f.mimeType.startsWith('video/') && !isGemini) {
        needsExtraction = true;
    }
  }

  if (needsExtraction) {
     showToast('Processing video frames for analysis...', 'info');
     for (const f of userMsg.images) {
        if (f.mimeType && f.mimeType.startsWith('video/')) {
           const frames = await extractFramesFromVideo(f.dataUrl, f.name, 3);
           if (frames && frames.length > 0) {
              finalMedia.push(...frames);
           } else {
              finalMedia.push(f);
           }
        } else {
           finalMedia.push(f);
        }
     }
  } else {
     finalMedia = [...userMsg.images];
  }
  userMsg.apiImages = finalMedia;

  const apiMessages = state.messages.map(m => ({
     role: m.role,
     content: m.content,
     images: m.apiImages || m.images
  }));

  try {
    const reply = await callAPI(apiMessages);
    removeTyping();
    const aiMsg = { role: 'assistant', content: reply, ts: Date.now() };
    state.messages.push(aiMsg);
    appendMessage(aiMsg);
    saveCurrentConversation();
  } catch (err) {
    removeTyping();
    const errMsg = { role: 'assistant', content: `❌ Network error: ${err.message}. Please check your connection and try again.`, ts: Date.now() };
    state.messages.push(errMsg);
    appendMessage(errMsg);
  } finally {
    removeTyping();
    state.isStreaming = false;
    updateSendState();
  }
}

userInput.addEventListener('input', () => {
  charCount.textContent = userInput.value.length;
  updateSendState();
  userInput.style.height = 'auto';
  userInput.style.height = Math.min(userInput.scrollHeight, 180) + 'px';
});

userInput.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    if (!sendBtn.disabled) sendMessage(userInput.value.trim());
  }
});

sendBtn.addEventListener('click', () => {
  if (!sendBtn.disabled) sendMessage(userInput.value.trim());
});

if (plusBtn) {
  plusBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    plusDropdownMenu?.classList.toggle('active');
  });
}

document.addEventListener('click', () => {
  plusDropdownMenu?.classList.remove('active');
});

if (menuUploadImage) {
  menuUploadImage.addEventListener('click', () => {
    plusDropdownMenu?.classList.remove('active');
    imageInput.click();
  });
}

if (menuUploadVideo) {
  menuUploadVideo.addEventListener('click', () => {
    plusDropdownMenu?.classList.remove('active');
    videoInput?.click();
  });
}

imageInput.addEventListener('change', () => addPendingFiles(imageInput.files));
videoInput?.addEventListener('change', () => addPendingFiles(videoInput.files));
removeImageBtn.addEventListener('click', clearPendingImages);

document.querySelectorAll('.quick-btn').forEach(btn => {
  btn.addEventListener('click', () => sendMessage(btn.dataset.prompt));
});

if (menuClearChat) {
  menuClearChat.addEventListener('click', () => {
    plusDropdownMenu?.classList.remove('active');
    if (!state.messages.length) {
      showToast('No messages to clear', 'error');
      return;
    }
    if (confirm('Clear this conversation?')) startNewChat();
  });
}

if (menuExportChat) {
  menuExportChat.addEventListener('click', () => {
    plusDropdownMenu?.classList.remove('active');
    if (!state.messages.length) {
      showToast('No messages to export', 'error');
      return;
    }
    const text = state.messages.map(m =>
      `[${m.role.toUpperCase()}] ${new Date(m.ts).toLocaleString()}\n${m.content}\n`
    ).join('\n---\n\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `nexusai-chat-${Date.now()}.txt`;
    a.click();
    showToast('Chat exported', 'success');
  });
}

if (themeToggle) {
  themeToggle.addEventListener('click', () => {
    const newTheme = state.theme === 'light' ? 'dark' : 'light';
    applyTheme(newTheme);
    showToast(`${newTheme.charAt(0).toUpperCase() + newTheme.slice(1)} mode enabled`, 'success');
  });
}

function init() {
  applyTheme(state.theme);
  const selection = normalizeSelection(state.provider, state.model);
  state.provider = selection.provider;
  state.model = selection.model;
  populateModels(state.provider);
  populateModelPicker();
  updateBadge();
  renderConversationList();

  state.freeMessagesSent = parseInt(localStorage.getItem('nx_free_messages_sent') || '0', 10) || 0;

  if (state.conversations.length) {
    const last = state.conversations[state.conversations.length - 1];
    loadConversation(last.id);
  }

  setupVoiceInput();
}

// ── Voice Input (Speech to Text) ──────────────────────────────────
function setupVoiceInput() {
  const micBtn = $('micBtn');
  if (!micBtn) return;

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  
  if (!SpeechRecognition) {
    // Keep it visible but show toast helper on click
    micBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      showToast('Voice input is not supported in this browser. Please use Google Chrome or Microsoft Edge.', 'error');
    });
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = true;
  
  // Set language to multilingual support (prefer user local language, fallback to english)
  recognition.lang = navigator.language || 'en-US'; 

  let isListening = false;

  micBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (isListening) {
      recognition.stop();
    } else {
      try {
        recognition.start();
      } catch (err) {
        console.error('Speech recognition start error:', err);
      }
    }
  });

  recognition.onstart = () => {
    isListening = true;
    micBtn.classList.add('listening');
    micBtn.title = 'Listening... Click to stop';
    userInput.placeholder = 'Listening... Speak now...';
    showToast('Listening... Speak into your microphone.', 'info');
  };

  recognition.onresult = (event) => {
    let finalTranscript = '';
    let interimTranscript = '';

    for (let i = event.resultIndex; i < event.results.length; ++i) {
      if (event.results[i].isFinal) {
        finalTranscript += event.results[i][0].transcript;
      } else {
        interimTranscript += event.results[i][0].transcript;
      }
    }

    const transcript = finalTranscript || interimTranscript;
    if (transcript) {
      userInput.value = transcript;
      charCount.textContent = userInput.value.length;
      updateSendState();
      userInput.style.height = 'auto';
      userInput.style.height = Math.min(userInput.scrollHeight, 180) + 'px';
    }
  };

  recognition.onerror = (event) => {
    console.error('Speech recognition error:', event.error);
    if (event.error === 'not-allowed') {
      showToast('Microphone access denied. Please enable microphone permissions in your browser.', 'error');
    } else if (event.error === 'no-speech') {
      showToast('No speech was detected. Please try again.', 'error');
    } else {
      showToast(`Speech recognition error: ${event.error}`, 'error');
    }
    resetMicUI();
  };

  recognition.onend = () => {
    resetMicUI();
  };

  function resetMicUI() {
    isListening = false;
    micBtn.classList.remove('listening');
    micBtn.title = 'Voice Input';
    userInput.placeholder = 'Ask NexusAI...';
    updateSendState();
  }
}

init();

