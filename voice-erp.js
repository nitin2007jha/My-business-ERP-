/* ═══════════════════════════════════════════════════════════════════
   My Business ERP — Voice Assistant Module v2.0
   Supports: Hindi + English | ERP Navigation | Data Queries | Actions
   ═══════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  // ── CONFIG ────────────────────────────────────────────────────────
  const VA_CONFIG = {
    lang: 'hi-IN',          // Primary language (Hindi)
    altLang: 'en-IN',       // Fallback language (English India)
    continuous: false,
    interimResults: true,
    maxAlternatives: 3,
    autoCloseMs: 6000,       // Close panel after 6s of silence
    wakeWords: ['erp', 'business', 'हेलो', 'ओके', 'ok erp', 'hey erp'],
  };

  // ── STATE ─────────────────────────────────────────────────────────
  let recognition = null;
  let isListening = false;
  let autoCloseTimer = null;
  let lastTranscript = '';
  let vaPanel = null;
  let micBtn = null;

  // ── NLP COMMAND MAP ───────────────────────────────────────────────
  // Each rule: { patterns: [...], action: fn, response: string | fn }
  const COMMANDS = [

    // ─ Navigation ─
    {
      patterns: ['dashboard', 'home', 'होम', 'डैशबोर्ड', 'dash'],
      action: () => navigate('dashboard'),
      response: 'डैशबोर्ड खोल रहा हूँ।',
    },
    {
      patterns: ['invoice', 'इनवॉइस', 'bill', 'बिल', 'नया बिल', 'new invoice', 'नई इनवॉइस'],
      action: () => navigate('invoice'),
      response: 'नई इनवॉइस खोल रहा हूँ।',
    },
    {
      patterns: ['inventory', 'stock', 'इन्वेंटरी', 'स्टॉक', 'products', 'प्रोडक्ट'],
      action: () => navigate('inventory'),
      response: 'इन्वेंटरी खोल रहा हूँ।',
    },
    {
      patterns: ['clients', 'customers', 'क्लाइंट', 'कस्टमर', 'ग्राहक'],
      action: () => navigate('clients'),
      response: 'क्लाइंट्स लिस्ट खोल रहा हूँ।',
    },
    {
      patterns: ['expenses', 'खर्च', 'expense'],
      action: () => navigate('expenses'),
      response: 'एक्सपेंस टैब खोल रहा हूँ।',
    },
    {
      patterns: ['settings', 'सेटिंग', 'setting'],
      action: () => navigate('settings'),
      response: 'सेटिंग्स खोल रहा हूँ।',
    },
    {
      patterns: ['records', 'रिकॉर्ड', 'history', 'हिस्ट्री'],
      action: () => navigate('records'),
      response: 'रिकॉर्ड खोल रहा हूँ।',
    },
    {
      patterns: ['employees', 'कर्मचारी', 'staff', 'employee'],
      action: () => navigate('employees'),
      response: 'एम्प्लोयी सेक्शन खोल रहा हूँ।',
    },
    {
      patterns: ['services', 'सर्विस', 'service'],
      action: () => navigate('services'),
      response: 'सर्विसेज खोल रहा हूँ।',
    },

    // ─ Data Queries ─
    {
      patterns: ['today sales', 'aaj kitna', 'आज की सेल', 'आज कितना', 'today revenue', 'आज की कमाई', 'today collection', 'आज कलेक्शन'],
      action: () => queryTodaySales(),
      response: null, // dynamic
    },
    {
      patterns: ['gst', 'जीएसटी', 'tax', 'टैक्स', 'gst kitna', 'जीएसटी कितना'],
      action: () => queryGST(),
      response: null,
    },
    {
      patterns: ['low stock', 'कम स्टॉक', 'stock alert', 'कौन से प्रोडक्ट कम', 'reorder', 'रिऑर्डर'],
      action: () => queryLowStock(),
      response: null,
    },
    {
      patterns: ['total sales', 'कुल सेल', 'total revenue', 'कुल कमाई', 'kitna hua', 'कितना हुआ'],
      action: () => queryTotalSales(),
      response: null,
    },
    {
      patterns: ['profit', 'प्रॉफिट', 'net profit', 'net income', 'फायदा'],
      action: () => queryProfit(),
      response: null,
    },
    {
      patterns: ['pending', 'बकाया', 'unpaid', 'outstanding', 'due'],
      action: () => queryPending(),
      response: null,
    },
    {
      patterns: ['kitne clients', 'how many clients', 'total clients', 'कुल ग्राहक'],
      action: () => queryClients(),
      response: null,
    },
    {
      patterns: ['kitne products', 'how many products', 'total products', 'कुल प्रोडक्ट'],
      action: () => queryProducts(),
      response: null,
    },

    // ─ Quick Actions ─
    {
      patterns: ['new product', 'add product', 'नया प्रोडक्ट', 'प्रोडक्ट जोड़ो'],
      action: () => { navigate('inventory'); setTimeout(() => window.openProductDrawer?.(null), 400); },
      response: 'नया प्रोडक्ट फॉर्म खोल रहा हूँ।',
    },
    {
      patterns: ['new client', 'add client', 'नया ग्राहक', 'क्लाइंट जोड़ो'],
      action: () => { navigate('clients'); setTimeout(() => window.openClientDrawer?.(null, true), 400); },
      response: 'नया क्लाइंट फॉर्म खोल रहा हूँ।',
    },
    {
      patterns: ['new expense', 'add expense', 'नया खर्च'],
      action: () => { navigate('expenses'); setTimeout(() => window.toggleExpenseModal?.(true), 400); },
      response: 'नया एक्सपेंस फॉर्म खोल रहा हूँ।',
    },

    // ─ Help ─
    {
      patterns: ['help', 'मदद', 'what can you do', 'क्या कर सकते हो', 'commands', 'कमांड'],
      action: () => showHelp(),
      response: null,
    },
    {
      patterns: ['close', 'बंद करो', 'band karo', 'stop', 'रुको', 'cancel', 'dismiss'],
      action: () => closeVoicePanel(),
      response: 'ठीक है।',
    },
  ];

  // ── INIT ──────────────────────────────────────────────────────────
  function init() {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      console.warn('[VoiceERP] Web Speech API not supported in this browser.');
      return;
    }

    injectStyles();
    createUI();
    bindSWMessages();
    handleURLAction();

    console.log('[VoiceERP] Voice Assistant ready. Say a wake word or tap the mic.');
  }

  // ── STYLES ────────────────────────────────────────────────────────
  function injectStyles() {
    const style = document.createElement('style');
    style.id = 'voice-erp-styles';
    style.textContent = `
      /* ── Floating Mic Button ── */
      #va-mic-btn {
        position: fixed;
        bottom: calc(80px + env(safe-area-inset-bottom, 0px));
        right: 18px;
        width: 54px; height: 54px;
        border-radius: 50%;
        background: linear-gradient(135deg, #714b67 0%, #a855f7 100%);
        border: none; cursor: pointer;
        display: flex; align-items: center; justify-content: center;
        box-shadow: 0 4px 20px rgba(113,75,103,.45);
        z-index: 9998;
        transition: transform .2s, box-shadow .2s;
        -webkit-tap-highlight-color: transparent;
      }
      #va-mic-btn:active { transform: scale(.92); }
      #va-mic-btn.listening {
        background: linear-gradient(135deg, #dc2626 0%, #f97316 100%);
        box-shadow: 0 4px 24px rgba(220,38,38,.55);
        animation: va-pulse 1.4s ease-in-out infinite;
      }
      @keyframes va-pulse {
        0%, 100% { box-shadow: 0 4px 24px rgba(220,38,38,.55); }
        50%       { box-shadow: 0 4px 40px rgba(220,38,38,.85), 0 0 0 12px rgba(220,38,38,.12); }
      }
      #va-mic-btn svg { width: 24px; height: 24px; fill: #fff; }

      /* ── Panel ── */
      #va-panel {
        position: fixed;
        bottom: 0; left: 0; right: 0;
        background: #1a1127;
        border-radius: 24px 24px 0 0;
        padding: 0 0 calc(16px + env(safe-area-inset-bottom, 0px));
        z-index: 9999;
        transform: translateY(100%);
        transition: transform .35s cubic-bezier(.4,0,.2,1);
        box-shadow: 0 -8px 40px rgba(0,0,0,.5);
        max-height: 70vh;
        overflow: hidden;
        display: flex; flex-direction: column;
      }
      #va-panel.open { transform: translateY(0); }

      /* Handle bar */
      #va-handle {
        width: 40px; height: 4px;
        background: rgba(255,255,255,.2);
        border-radius: 2px;
        margin: 12px auto 0;
        flex-shrink: 0;
      }

      /* Status bar */
      #va-status-bar {
        display: flex; align-items: center; gap: 10px;
        padding: 14px 20px 0;
        flex-shrink: 0;
      }
      #va-orb {
        width: 40px; height: 40px; border-radius: 50%;
        background: linear-gradient(135deg, #714b67, #a855f7);
        display: flex; align-items: center; justify-content: center;
        flex-shrink: 0;
        transition: background .3s;
      }
      #va-orb.listening {
        background: linear-gradient(135deg, #dc2626, #f97316);
        animation: va-orb-glow 1.2s ease-in-out infinite;
      }
      #va-orb.thinking {
        background: linear-gradient(135deg, #2563eb, #7c3aed);
        animation: va-orb-spin 1s linear infinite;
      }
      #va-orb.speaking {
        background: linear-gradient(135deg, #059669, #0d9488);
        animation: va-orb-glow 0.8s ease-in-out infinite;
      }
      @keyframes va-orb-glow {
        0%,100% { box-shadow: 0 0 0 0 rgba(220,38,38,.3); }
        50%      { box-shadow: 0 0 0 10px rgba(220,38,38,.0); }
      }
      @keyframes va-orb-spin {
        from { transform: rotate(0deg); } to { transform: rotate(360deg); }
      }
      #va-orb svg { width: 20px; height: 20px; fill: #fff; }
      #va-status-text {
        flex: 1;
        color: rgba(255,255,255,.7);
        font-size: 13px;
        font-family: 'Inter', sans-serif;
      }
      #va-status-text strong {
        display: block;
        color: #fff;
        font-size: 15px;
        font-weight: 600;
        margin-bottom: 1px;
      }
      #va-close-btn {
        width: 28px; height: 28px; border-radius: 50%;
        background: rgba(255,255,255,.1);
        border: none; cursor: pointer;
        color: rgba(255,255,255,.6);
        font-size: 16px;
        display: flex; align-items: center; justify-content: center;
        flex-shrink: 0;
      }

      /* Waveform */
      #va-waveform {
        height: 48px;
        display: flex; align-items: center; justify-content: center;
        gap: 3px; padding: 0 20px;
        flex-shrink: 0;
      }
      .va-bar {
        width: 3px; border-radius: 3px;
        background: rgba(168,85,247,.6);
        height: 4px;
        transition: height .1s ease;
      }
      #va-panel.listening .va-bar {
        animation: va-wave 1.2s ease-in-out infinite;
        background: linear-gradient(180deg, #f97316, #dc2626);
      }
      .va-bar:nth-child(1)  { animation-delay: 0.0s; }
      .va-bar:nth-child(2)  { animation-delay: 0.1s; }
      .va-bar:nth-child(3)  { animation-delay: 0.2s; }
      .va-bar:nth-child(4)  { animation-delay: 0.3s; }
      .va-bar:nth-child(5)  { animation-delay: 0.4s; }
      .va-bar:nth-child(6)  { animation-delay: 0.3s; }
      .va-bar:nth-child(7)  { animation-delay: 0.2s; }
      .va-bar:nth-child(8)  { animation-delay: 0.1s; }
      .va-bar:nth-child(9)  { animation-delay: 0.0s; }
      @keyframes va-wave {
        0%, 100% { height: 4px; }
        50%       { height: 28px; }
      }

      /* Transcript area */
      #va-transcript {
        flex: 1; overflow-y: auto;
        padding: 0 20px 8px;
        min-height: 60px;
      }
      #va-interim {
        color: rgba(255,255,255,.4);
        font-size: 16px;
        font-style: italic;
        font-family: 'Inter', sans-serif;
        text-align: center;
        padding: 4px 0;
        min-height: 28px;
      }
      #va-final {
        color: #fff;
        font-size: 18px;
        font-weight: 600;
        font-family: 'Inter', sans-serif;
        text-align: center;
        padding: 4px 0;
        min-height: 28px;
      }

      /* Response card */
      #va-response {
        margin: 8px 20px 0;
        background: rgba(255,255,255,.06);
        border: 1px solid rgba(255,255,255,.1);
        border-radius: 16px;
        padding: 14px 16px;
        color: #fff;
        font-family: 'Inter', sans-serif;
        font-size: 14px;
        line-height: 1.5;
        display: none;
        flex-shrink: 0;
      }
      #va-response.show { display: block; animation: va-fadein .25s ease; }
      @keyframes va-fadein { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
      #va-response .va-res-title {
        font-size: 11px; font-weight: 700;
        text-transform: uppercase; letter-spacing: .08em;
        color: rgba(255,255,255,.4);
        margin-bottom: 6px;
      }
      #va-response .va-res-value {
        font-size: 22px; font-weight: 800;
        color: #a78bfa;
        margin-bottom: 4px;
      }
      #va-response .va-res-detail {
        font-size: 12px;
        color: rgba(255,255,255,.5);
      }
      #va-response .va-res-list { margin-top: 6px; }
      #va-response .va-res-item {
        display: flex; justify-content: space-between;
        padding: 4px 0;
        border-bottom: 1px solid rgba(255,255,255,.06);
        font-size: 13px;
      }

      /* Quick suggestion chips */
      #va-chips {
        display: flex; gap: 8px;
        overflow-x: auto; padding: 8px 20px 0;
        flex-shrink: 0;
        scrollbar-width: none;
      }
      #va-chips::-webkit-scrollbar { display: none; }
      .va-chip {
        flex-shrink: 0;
        background: rgba(168,85,247,.15);
        border: 1px solid rgba(168,85,247,.3);
        border-radius: 20px;
        padding: 5px 12px;
        font-size: 12px;
        color: #c4b5fd;
        font-family: 'Inter', sans-serif;
        cursor: pointer;
        white-space: nowrap;
        transition: background .15s;
      }
      .va-chip:active { background: rgba(168,85,247,.35); }
    `;
    document.head.appendChild(style);
  }

  // ── BUILD UI ──────────────────────────────────────────────────────
  function createUI() {
    // Floating mic button
    micBtn = document.createElement('button');
    micBtn.id = 'va-mic-btn';
    micBtn.title = 'Voice Assistant';
    micBtn.setAttribute('aria-label', 'Open Voice Assistant');
    micBtn.innerHTML = micSVG();
    micBtn.addEventListener('click', toggleListening);
    document.body.appendChild(micBtn);

    // Panel
    vaPanel = document.createElement('div');
    vaPanel.id = 'va-panel';
    vaPanel.innerHTML = `
      <div id="va-handle"></div>
      <div id="va-status-bar">
        <div id="va-orb">${micSVG()}</div>
        <div id="va-status-text">
          <strong id="va-status-title">Voice Assistant</strong>
          <span id="va-status-sub">Tap mic ya bolo "Hey ERP"</span>
        </div>
        <button id="va-close-btn" aria-label="Close" onclick="window._VA&&window._VA.close()">✕</button>
      </div>
      <div id="va-waveform">
        ${Array.from({length: 9}, () => '<div class="va-bar"></div>').join('')}
      </div>
      <div id="va-transcript">
        <div id="va-interim"></div>
        <div id="va-final"></div>
      </div>
      <div id="va-response"></div>
      <div id="va-chips">
        <div class="va-chip" onclick="window._VA&&window._VA.runText('आज की सेल')">आज की सेल</div>
        <div class="va-chip" onclick="window._VA&&window._VA.runText('GST कितना')">GST कितना</div>
        <div class="va-chip" onclick="window._VA&&window._VA.runText('कम स्टॉक')">कम स्टॉक</div>
        <div class="va-chip" onclick="window._VA&&window._VA.runText('नया इनवॉइस')">नया इनवॉइस</div>
        <div class="va-chip" onclick="window._VA&&window._VA.runText('प्रॉफिट')">प्रॉफिट</div>
        <div class="va-chip" onclick="window._VA&&window._VA.runText('बकाया')">बकाया</div>
        <div class="va-chip" onclick="window._VA&&window._VA.runText('help')">Help</div>
      </div>
    `;
    document.body.appendChild(vaPanel);
  }

  function micSVG() {
    return `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/>
    </svg>`;
  }

  // ── TOGGLE / START / STOP ─────────────────────────────────────────
  function toggleListening() {
    if (isListening) {
      stopListening();
    } else {
      openVoicePanel();
      startListening();
    }
  }

  function openVoicePanel() {
    vaPanel.classList.add('open');
    document.getElementById('va-response').classList.remove('show');
    setStatus('listening', 'सुन रहा हूँ…', 'बोलिए, मैं तैयार हूँ');
  }

  function closeVoicePanel() {
    stopListening();
    vaPanel.classList.remove('open');
    vaPanel.classList.remove('listening');
  }

  function startListening() {
    if (isListening) return;
    clearAutoClose();

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;

    recognition = new SR();
    recognition.lang = VA_CONFIG.lang;
    recognition.continuous = VA_CONFIG.continuous;
    recognition.interimResults = VA_CONFIG.interimResults;
    recognition.maxAlternatives = VA_CONFIG.maxAlternatives;

    recognition.onstart = () => {
      isListening = true;
      micBtn.classList.add('listening');
      vaPanel.classList.add('listening');
      setStatus('listening', 'सुन रहा हूँ…', 'बोलिए…');
      document.getElementById('va-interim').textContent = '';
      document.getElementById('va-final').textContent = '';
    };

    recognition.onresult = (event) => {
      let interim = '';
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          final += event.results[i][0].transcript;
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      document.getElementById('va-interim').textContent = interim;
      if (final) {
        document.getElementById('va-final').textContent = final;
        lastTranscript = final;
        handleCommand(final.trim().toLowerCase());
      }
    };

    recognition.onerror = (event) => {
      console.error('[VoiceERP] Error:', event.error);
      if (event.error === 'no-speech') {
        setStatus('idle', 'आवाज़ नहीं आई', 'दोबारा कोशिश करें');
      } else if (event.error === 'not-allowed') {
        setStatus('idle', 'Microphone Permission', 'Browser settings में mic allow करें');
        showResponse('⚠️ Permission', 'Microphone access denied. Browser settings में जाकर mic permission allow करें।', '');
      }
      isListening = false;
      micBtn.classList.remove('listening');
      vaPanel.classList.remove('listening');
    };

    recognition.onend = () => {
      isListening = false;
      micBtn.classList.remove('listening');
      vaPanel.classList.remove('listening');
      if (!lastTranscript) {
        setStatus('idle', 'तैयार', 'कुछ कहें या chip tap करें');
      }
      scheduleAutoClose();
    };

    recognition.start();
  }

  function stopListening() {
    if (recognition) {
      recognition.stop();
      recognition = null;
    }
    isListening = false;
    micBtn.classList.remove('listening');
    vaPanel.classList.remove('listening');
  }

  // ── COMMAND HANDLER ───────────────────────────────────────────────
  function handleCommand(text) {
    lastTranscript = '';
    setStatus('thinking', 'सोच रहा हूँ…', text);

    // Match against COMMANDS
    for (const cmd of COMMANDS) {
      if (cmd.patterns.some(p => text.includes(p))) {
        const result = cmd.action();
        const responseText = typeof cmd.response === 'function' ? cmd.response() : cmd.response;
        if (responseText) {
          showResponse('', responseText, '');
          speak(responseText);
        }
        // Dynamic responses are handled inside action()
        return;
      }
    }

    // No match
    setStatus('idle', 'समझ नहीं आया', '"help" बोलें commands जानने के लिए');
    showResponse('🤔 Samajh nahi aaya', `"${text}" — yeh command recognize nahi hua.\n\n"help" bolke available commands dekhein.`, '');
    speak('माफ़ करें, मैं समझ नहीं पाया। हेल्प बोलें।');
  }

  // Expose for chip taps
  window._VA = {
    open: () => { openVoicePanel(); startListening(); },
    close: closeVoicePanel,
    runText: (text) => {
      openVoicePanel();
      document.getElementById('va-final').textContent = text;
      handleCommand(text.toLowerCase());
    }
  };

  // ── QUERY FUNCTIONS ───────────────────────────────────────────────
  function queryTodaySales() {
    const { invoices = [], settings = {} } = window.AppState || {};
    const todayStr = new Date().toDateString();
    const todayInvs = invoices.filter(i =>
      i.status === 'final' && new Date(i.date || i.createdAt?.toDate?.() || i.createdAt).toDateString() === todayStr
    );
    const total   = todayInvs.reduce((s, i) => s + (i.total || i.grandTotal || 0), 0);
    const cash    = todayInvs.reduce((s, i) => s + (i.cashPaid || i.splitPayment?.cash || 0), 0);
    const upi     = todayInvs.reduce((s, i) => s + (i.upiPaid  || i.splitPayment?.upi  || 0), 0);
    const count   = todayInvs.length;

    const msg = count === 0
      ? 'आज अभी कोई इनवॉइस नहीं बनी।'
      : `आज की कुल कमाई ${fmt(total)} है। ${count} इनवॉइस — Cash: ${fmt(cash)}, UPI: ${fmt(upi)}.`;

    showResponse('📊 आज की सेल', fmt(total), `${count} इनवॉइस  •  Cash ${fmt(cash)}  •  UPI ${fmt(upi)}`);
    setStatus('speaking', 'आज की सेल', '');
    speak(msg);
  }

  function queryGST() {
    const { invoices = [] } = window.AppState || {};
    const finalInvs = invoices.filter(i => i.status === 'final');
    let cgst = 0, sgst = 0, igst = 0;
    finalInvs.forEach(inv => {
      (inv.items || []).forEach(item => {
        const rate    = item.rate || 0;
        const qty     = item.qty  || 1;
        const taxable = rate * qty;
        const gstPct  = item.gst  || 0;
        if (inv.gstMode === 'inter') {
          igst += taxable * gstPct / 100;
        } else {
          cgst += taxable * (gstPct / 2) / 100;
          sgst += taxable * (gstPct / 2) / 100;
        }
      });
    });
    const total = cgst + sgst + igst;
    const msg = `कुल GST ${fmt(total)} है — CGST ${fmt(cgst)}, SGST ${fmt(sgst)}, IGST ${fmt(igst)}.`;

    showResponse('🧾 GST Tracker', fmt(total), `CGST ${fmt(cgst)}  •  SGST ${fmt(sgst)}  •  IGST ${fmt(igst)}`);
    setStatus('speaking', 'GST Report', '');
    speak(msg);
  }

  function queryLowStock() {
    const { products = [] } = window.AppState || {};
    const low = products.filter(p => p.minStock && (p.stock || 0) <= p.minStock);

    if (low.length === 0) {
      showResponse('✅ Stock Status', 'सब ठीक है!', 'कोई भी प्रोडक्ट low stock में नहीं है।');
      speak('अभी कोई भी प्रोडक्ट कम स्टॉक में नहीं है। सब ठीक है।');
    } else {
      const listHTML = low.slice(0, 5).map(p =>
        `<div class="va-res-item"><span>${p.name}</span><span style="color:#f97316">Stock: ${p.stock}</span></div>`
      ).join('');
      showResponse(
        `⚠️ ${low.length} Low Stock Items`,
        null,
        null,
        `<div class="va-res-list">${listHTML}</div>`
      );
      speak(`${low.length} प्रोडक्ट कम स्टॉक में हैं। जैसे: ${low.slice(0,3).map(p=>p.name).join(', ')}.`);
    }
    setStatus('speaking', 'Stock Alert', '');
  }

  function queryTotalSales() {
    const { invoices = [] } = window.AppState || {};
    const total = invoices.filter(i => i.status === 'final')
      .reduce((s, i) => s + (i.total || i.grandTotal || 0), 0);
    showResponse('💰 Total Revenue', fmt(total), `${invoices.filter(i=>i.status==='final').length} invoices`);
    speak(`कुल रेवेन्यू ${fmt(total)} है।`);
    setStatus('speaking', 'Total Revenue', '');
  }

  function queryProfit() {
    const el = document.getElementById('dash-profit');
    const val = el ? el.textContent : 'N/A';
    showResponse('📈 Net Profit', val, 'Revenue minus Expenses');
    speak(`Net Profit ${val} है।`);
    setStatus('speaking', 'Profit', '');
  }

  function queryPending() {
    const el = document.getElementById('dash-unpaid');
    const val = el ? el.textContent : 'N/A';
    showResponse('⏳ Outstanding', val, 'Unpaid invoices');
    speak(`बकाया राशि ${val} है।`);
    setStatus('speaking', 'Pending', '');
  }

  function queryClients() {
    const { clients = [] } = window.AppState || {};
    showResponse('👥 Total Clients', clients.length, 'registered clients');
    speak(`कुल ${clients.length} क्लाइंट हैं।`);
    setStatus('speaking', 'Clients', '');
  }

  function queryProducts() {
    const { products = [] } = window.AppState || {};
    showResponse('📦 Total Products', products.length, 'in inventory');
    speak(`इन्वेंटरी में कुल ${products.length} प्रोडक्ट हैं।`);
    setStatus('speaking', 'Products', '');
  }

  function showHelp() {
    const helpHTML = `
      <div class="va-res-list">
        ${[
          ['Dashboard / होम',      'डैशबोर्ड खुलेगा'],
          ['New Invoice / नया बिल','Invoice tab'],
          ['आज की सेल',            "Today's collection"],
          ['GST कितना',            'GST breakdown'],
          ['कम स्टॉक',             'Low stock items'],
          ['प्रॉफिट',              'Net profit'],
          ['बकाया',                'Pending amount'],
          ['Inventory / स्टॉक',    'Inventory tab'],
          ['Clients / ग्राहक',     'Clients tab'],
          ['Settings / सेटिंग',    'Settings tab'],
        ].map(([cmd, desc]) =>
          `<div class="va-res-item"><span style="color:#c4b5fd">${cmd}</span><span style="color:rgba(255,255,255,.5)">${desc}</span></div>`
        ).join('')}
      </div>
    `;
    showResponse('💬 Voice Commands', null, null, helpHTML);
    setStatus('speaking', 'Help', '');
    speak('यह हैं उपलब्ध कमांड्स।');
  }

  // ── NAVIGATION ────────────────────────────────────────────────────
  function navigate(tab) {
    window.switchTab?.(tab);
    setTimeout(() => {
      setStatus('idle', 'हो गया!', `${tab} खुल गया`);
    }, 300);
  }

  // ── UI HELPERS ────────────────────────────────────────────────────
  function setStatus(state, title, sub) {
    const orb    = document.getElementById('va-orb');
    const stitle = document.getElementById('va-status-title');
    const ssub   = document.getElementById('va-status-sub');
    if (orb)    { orb.className = ''; orb.classList.add(state); orb.innerHTML = micSVG(); }
    if (stitle) stitle.textContent = title || '';
    if (ssub)   ssub.textContent   = sub   || '';
  }

  function showResponse(title, value, detail, customHTML) {
    const el = document.getElementById('va-response');
    if (!el) return;
    el.innerHTML = `
      ${title ? `<div class="va-res-title">${title}</div>` : ''}
      ${value  ? `<div class="va-res-value">${value}</div>` : ''}
      ${detail ? `<div class="va-res-detail">${detail}</div>` : ''}
      ${customHTML || ''}
    `;
    el.classList.add('show');
  }

  function speak(text) {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'hi-IN';
    utter.rate = 1.0;
    utter.pitch = 1.0;
    utter.onend = () => {
      setStatus('idle', 'तैयार', 'कुछ और पूछें');
      scheduleAutoClose();
    };
    window.speechSynthesis.speak(utter);
  }

  function fmt(n) {
    return '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
  }

  function scheduleAutoClose() {
    clearAutoClose();
    autoCloseTimer = setTimeout(() => {
      if (!isListening) closeVoicePanel();
    }, VA_CONFIG.autoCloseMs);
  }

  function clearAutoClose() {
    if (autoCloseTimer) { clearTimeout(autoCloseTimer); autoCloseTimer = null; }
  }

  // ── URL ACTION HANDLER (from shortcuts / SW navigate) ─────────────
  function handleURLAction() {
    const params = new URLSearchParams(window.location.search);
    const action = params.get('action');
    if (action === 'voice') {
      setTimeout(() => { openVoicePanel(); startListening(); }, 800);
    }
  }

  // ── LISTEN FOR SW MESSAGES ─────────────────────────────────────────
  function bindSWMessages() {
    if (!navigator.serviceWorker) return;
    navigator.serviceWorker.addEventListener('message', event => {
      const { type } = event.data || {};
      if (type === 'SW_NAVIGATE') {
        const url  = new URL(event.data.url, window.location.origin);
        const act  = url.searchParams.get('action');
        if (act) handleURLAction.call(null, act);
      }
    });
  }

  // ── BOOT ──────────────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
