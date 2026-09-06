/* ==========================================================================
   PlainSlate AI Chat Widget
   Drop this on any page with:  <script src="chat-widget.js"></script>
   It talks to your own backend at /api/chat (see api/chat.js) —
   never put an API key directly in this file.
   ========================================================================== */

(function(){

  const STYLE = `
    #ct-chat-bubble{
      position:fixed; bottom:22px; right:22px; z-index:9999;
      width:58px; height:58px; border-radius:50%;
      background:#B23A2F; border:2px solid #1D3557; cursor:pointer;
      display:flex; align-items:center; justify-content:center;
      box-shadow:3px 3px 0 rgba(29,53,87,0.25);
      transition:transform .15s ease;
      font-family:'Patrick Hand', cursive;
    }
    #ct-chat-bubble:hover{transform:translateY(-2px);}
    #ct-chat-bubble svg{width:26px; height:26px;}

    #ct-chat-panel{
      position:fixed; bottom:90px; right:22px; z-index:9999;
      width:340px; max-width:calc(100vw - 40px);
      height:440px; max-height:calc(100vh - 140px);
      background:#FAF7EF; border:2px solid #1D3557; border-radius:12px;
      box-shadow:6px 6px 0 rgba(29,53,87,0.12);
      display:none; flex-direction:column; overflow:hidden;
      font-family:'Lexend', sans-serif;
    }
    #ct-chat-panel.open{display:flex;}

    #ct-chat-head{
      background:#1D3557; color:#fff; padding:12px 16px;
      display:flex; align-items:center; justify-content:space-between;
      font-family:'Patrick Hand', cursive; font-size:1.1rem;
    }
    #ct-chat-head .sub{font-family:'Lexend'; font-size:0.7rem; color:#B7C4DC; display:block; font-weight:400;}
    #ct-chat-close{background:none; border:none; color:#fff; font-size:1.2rem; cursor:pointer; line-height:1;}

    #ct-chat-messages{
      flex:1; overflow-y:auto; padding:14px; display:flex; flex-direction:column; gap:10px;
    }
    .ct-msg{max-width:85%; padding:9px 12px; border-radius:10px; font-size:0.88rem; line-height:1.45;}
    .ct-msg.bot{background:#fff; border:2px solid #1D3557; align-self:flex-start; border-bottom-left-radius:2px;}
    .ct-msg.user{background:#FBEAB0; border:2px solid #1D3557; align-self:flex-end; border-bottom-right-radius:2px;}
    .ct-msg.typing{color:#7A7368; font-style:italic;}

    #ct-chat-inputrow{
      border-top:2px solid #1D3557; padding:10px; display:flex; gap:8px; background:#fff;
    }
    #ct-chat-input{
      flex:1; border:2px solid #C7D3E8; border-radius:20px; padding:9px 14px;
      font-family:'Lexend'; font-size:0.88rem; outline:none;
    }
    #ct-chat-input:focus{border-color:#B23A2F;}
    #ct-chat-send{
      background:#B23A2F; color:#fff; border:none; border-radius:50%;
      width:38px; height:38px; cursor:pointer; flex-shrink:0;
      display:flex; align-items:center; justify-content:center;
    }
    #ct-chat-send:disabled{opacity:0.5; cursor:default;}
  `;

  const styleTag = document.createElement('style');
  styleTag.textContent = STYLE;
  document.head.appendChild(styleTag);

  const bubble = document.createElement('div');
  bubble.id = 'ct-chat-bubble';
  bubble.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>`;

  const panel = document.createElement('div');
  panel.id = 'ct-chat-panel';
  panel.innerHTML = `
    <div id="ct-chat-head">
      <div>Ask PlainSlate<span class="sub">Usually explains in one try</span></div>
      <button id="ct-chat-close" aria-label="Close chat">✕</button>
    </div>
    <div id="ct-chat-messages">
      <div class="ct-msg bot">Hey! Ask me anything about DBMS, DSA, or any subject on this site — I'll explain it simply first.</div>
    </div>
    <div id="ct-chat-inputrow">
      <input id="ct-chat-input" type="text" placeholder="Type your doubt..." autocomplete="off">
      <button id="ct-chat-send" aria-label="Send message">➤</button>
    </div>
  `;

  document.body.appendChild(bubble);
  document.body.appendChild(panel);

  const messagesEl = panel.querySelector('#ct-chat-messages');
  const inputEl = panel.querySelector('#ct-chat-input');
  const sendBtn = panel.querySelector('#ct-chat-send');
  const closeBtn = panel.querySelector('#ct-chat-close');

  let history = []; // {role: 'user'|'assistant', content: '...'}

  bubble.addEventListener('click', () => {
    panel.classList.toggle('open');
    if(panel.classList.contains('open')) inputEl.focus();
  });
  closeBtn.addEventListener('click', () => panel.classList.remove('open'));

  function addMessage(text, role){
    const div = document.createElement('div');
    div.className = 'ct-msg ' + (role === 'user' ? 'user' : 'bot');
    div.textContent = text;
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return div;
  }

  async function sendMessage(){
    const text = inputEl.value.trim();
    if(!text) return;
    inputEl.value = '';
    sendBtn.disabled = true;

    addMessage(text, 'user');
    history.push({role:'user', content:text});

    const typingEl = addMessage('Thinking...', 'bot');
    typingEl.classList.add('typing');

    try{
      // This calls YOUR backend, not Anthropic directly.
      // See api/chat.js — that's where the real API key lives, safely.
      const res = await fetch('/api/chat', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ messages: history })
      });
      const data = await res.json();
      typingEl.remove();

      if(data && data.reply){
        addMessage(data.reply, 'bot');
        history.push({role:'assistant', content:data.reply});
      } else {
        addMessage("Sorry, I couldn't get an answer right now. Try again in a moment.", 'bot');
      }
    } catch(err){
      typingEl.remove();
      addMessage("Something went wrong reaching the AI. Please try again.", 'bot');
      console.error('PlainSlate chat error:', err);
    } finally {
      sendBtn.disabled = false;
    }
  }

  sendBtn.addEventListener('click', sendMessage);
  inputEl.addEventListener('keydown', (e) => {
    if(e.key === 'Enter') sendMessage();
  });

})();
