---
marp: true
paginate: true
html: true
size: 4:3
style: |
  @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:ital,wght@0,400;0,500;0,600;1,400&family=STIX+Two+Text:ital,wght@0,400;0,500;0,600;1,400;1,500&display=swap');

  :root {
    --body: 'STIX Two Text', 'Latin Modern Roman', Georgia, serif;
    --mono: 'JetBrains Mono', 'IBM Plex Mono', ui-monospace, monospace;
    --white:       #e8e7e3;
    --off-white:   #c9c8c3;
    --subtle:      #a7a6a1;
    --muted:       #85847f;
    --faint:       #4e4e4a;
    --bg:          #121313;
    --card-border: #2a2a28;
  }

  section {
    font-family: var(--body);
    background: var(--bg);
    color: var(--white);
    padding: 64px 88px 72px;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    position: relative;
  }

  h1 {
    font-size: 40px;
    font-weight: 600;
    line-height: 1.12;
    margin: 0 0 16px 0;
    color: var(--white);
    letter-spacing: 0;
  }
  h2 {
    font-size: 28px;
    font-weight: 600;
    line-height: 1.15;
    margin: 0 0 18px 0;
    color: var(--white);
    letter-spacing: 0;
    border: none;
  }
  p {
    font-size: 17px;
    line-height: 1.65;
    color: var(--subtle);
    margin: 0 0 14px 0;
  }
  strong { color: var(--white); font-weight: 600; }
  em     { color: var(--muted); font-style: italic; }
  code {
    font-family: var(--mono);
    background: transparent;
    border: none;
    color: var(--white);
    padding: 0;
    border-radius: 0;
    font-size: 0.9em;
  }
  .header-row {
    display: flex;
    justify-content: flex-start;
    align-items: baseline;
    gap: 20px;
    margin-bottom: 28px;
  }
  .header-row h2 {
    margin: 0;
    font-size: 30px;
  }
  .page-num {
    font-family: var(--mono);
    font-size: 30px;
    line-height: 1.15;
    color: var(--muted);
    letter-spacing: 0;
    flex-shrink: 0;
  }
  .cards-col {
    display: flex;
    flex-direction: column;
    gap: 10px;
    width: 100%;
    max-width: 720px;
    margin: 0 auto 16px;
  }
  .card-row {
    background: transparent;
    border: none;
    border-left: 1px solid var(--card-border);
    border-radius: 0;
    padding: 0 0 0 18px;
    display: flex;
    align-items: flex-start;
    gap: 14px;
  }
  .card-row-letter {
    font-family: var(--mono);
    font-size: 12px;
    color: var(--muted);
    flex-shrink: 0;
    margin-top: 1px;
    min-width: 16px;
  }
  .card-row-body h3 {
    font-size: 16px;
    font-weight: 600;
    color: var(--white);
    margin: 0 0 3px;
  }
  .card-row-body p {
    font-size: 15px;
    color: var(--subtle);
    margin: 0;
    line-height: 1.45;
  }

  .list {
    display: flex;
    flex-direction: column;
    gap: 9px;
    width: 100%;
    max-width: 720px;
    margin: 0 auto 16px;
  }
  .list-item {
    display: flex;
    align-items: flex-start;
    gap: 16px;
    background: transparent;
    border: none;
    border-radius: 0;
    padding: 0;
  }
  .list-num {
    font-family: var(--mono);
    font-size: 12px;
    color: var(--muted);
    flex-shrink: 0;
    margin-top: 1px;
    min-width: 18px;
  }
  .list-text { font-size: 16px; color: var(--subtle); line-height: 1.45; }
  .list-text strong { color: var(--white); }

  section.cover {
    justify-content: center;
    text-align: center;
    padding-bottom: 72px;
    background: #0f1010;
  }
  .cover-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    max-width: 720px;
  }
  .cover-kicker,
  .cta-kicker {
    font-family: var(--mono);
    font-size: 12px;
    color: var(--muted);
    letter-spacing: 3px;
    text-transform: uppercase;
    margin-bottom: 24px;
  }
  section.cover h1 {
    font-size: 58px;
    line-height: 1.05;
    margin-bottom: 18px;
  }
  section.cover p {
    max-width: 620px;
    font-size: 20px;
    color: var(--subtle);
    margin-bottom: 20px;
  }
  .cover-meta {
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-family: var(--mono);
    font-size: 12px;
    color: var(--muted);
    letter-spacing: 2px;
    text-transform: uppercase;
  }

  section.divider {
    justify-content: center;
    border-left: 5px solid var(--off-white);
    background: #171817;
  }
  section.divider h1 { font-size: 42px; color: var(--white); margin-bottom: 10px; }
  section.divider p  { font-size: 15px; color: var(--muted); }

  section.cta {
    justify-content: center;
    align-items: center;
    text-align: center;
    background: #e9e9e5;
  }
  section.cover::after,
  section.cta::after {
    display: none !important;
  }
  .cta-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    max-width: 720px;
  }
  section.cta h1 {
    color: #171716;
    font-size: 44px;
    line-height: 1.1;
    letter-spacing: 0;
    margin-bottom: 24px;
  }
  .cta-line {
    font-family: var(--mono);
    font-size: 13px;
    color: #65645f;
    letter-spacing: 1px;
    margin-bottom: 4px;
  }
  section.cta .handle {
    font-family: var(--mono);
    font-size: 13px;
    color: #555550;
    margin-top: 22px;
    letter-spacing: 2px;
    text-transform: uppercase;
  }

  section > .header-row,
  section > h2 {
    width: 100%;
    max-width: 720px;
  }

  section::after {
    font-family: var(--mono);
    font-size: 9px;
    color: var(--muted);
    letter-spacing: 1px;
    content: 'PI CODING AGENT · ' attr(data-marpit-pagination) ' / ' attr(data-marpit-pagination-total);
    position: absolute;
    bottom: 20px;
    right: 40px;
  }
---

<!-- SLIDE 1 · COVER -->
<!-- _class: cover -->

<div class="cover-content">
  <div class="cover-kicker">PI CODING AGENT</div>
  <h1>Pi Coding Agent</h1>
  <p>A small, provider-agnostic coding agent.</p>
  <div class="cover-meta">
    <span>Four tools</span>
    <span>Many providers</span>
    <span>Runs locally</span>
  </div>
</div>

---

<!-- SLIDE 2 · WHAT IT IS -->

<div class="header-row">
  <span class="page-num">I.</span>
  <h2>What Pi is</h2>
</div>

<div class="cards-col">
  <div class="card-row">
    <span class="card-row-letter">01</span>
    <div class="card-row-body">
      <h3>Four tools</h3>
      <p><code>read</code> · <code>write</code> · <code>edit</code> · <code>bash</code></p>
    </div>
  </div>
  <div class="card-row">
    <span class="card-row-letter">02</span>
    <div class="card-row-body">
      <h3>Open source</h3>
      <p>MIT-licensed. Runs locally.</p>
    </div>
  </div>
  <div class="card-row">
    <span class="card-row-letter">03</span>
    <div class="card-row-body">
      <h3>Provider-agnostic</h3>
      <p>Use Anthropic, OpenAI, Google, Groq, and more.</p>
    </div>
  </div>
</div>

---

<!-- SLIDE 3 · WHY PI -->

<div class="header-row">
  <span class="page-num">II.</span>
  <h2>Why Pi</h2>
</div>

<div class="list">
  <div class="list-item">
    <span class="list-num">01</span>
    <span class="list-text"><strong>Less built in</strong> — fewer defaults and less hidden behavior</span>
  </div>
  <div class="list-item">
    <span class="list-num">02</span>
    <span class="list-text"><strong>More control</strong> — choose the model, tools, and boundaries</span>
  </div>
  <div class="list-item">
    <span class="list-num">03</span>
    <span class="list-text"><strong>More extensible</strong> — add capabilities only when needed</span>
  </div>
</div>

---

<!-- SLIDE 4 · PHILOSOPHY -->

<div class="header-row">
  <span class="page-num">III.</span>
  <h2>The philosophy</h2>
</div>

<div class="list">
  <div class="list-item">
    <span class="list-num">01</span>
    <span class="list-text"><strong>Adapt the agent</strong> — fit Pi to the way you already work</span>
  </div>
  <div class="list-item">
    <span class="list-num">02</span>
    <span class="list-text"><strong>Keep the core small</strong> — add tools and features opt in</span>
  </div>
  <div class="list-item">
    <span class="list-num">03</span>
    <span class="list-text"><strong>Own the runtime</strong> — run locally and sandbox it yourself</span>
  </div>
</div>

---

<!-- SLIDE 5 · THE 4 PILLARS -->

<div class="header-row">
  <span class="page-num">IV.</span>
  <h2>Four building blocks</h2>
</div>

<div class="list">
  <div class="list-item">
    <span class="list-num">01</span>
    <span class="list-text"><strong>Context</strong> — project instructions</span>
  </div>
  <div class="list-item">
    <span class="list-num">02</span>
    <span class="list-text"><strong>Extensions</strong> — tools and commands</span>
  </div>
  <div class="list-item">
    <span class="list-num">03</span>
    <span class="list-text"><strong>Skills</strong> — on-demand capabilities</span>
  </div>
  <div class="list-item">
    <span class="list-num">04</span>
    <span class="list-text"><strong>Memory</strong> — long-session context</span>
  </div>
</div>

---

<!-- SLIDE 6 · HOW IT RUNS -->

<div class="header-row">
  <span class="page-num">V.</span>
  <h2>Ways to run Pi</h2>
</div>

<div class="list">
  <div class="list-item">
    <span class="list-num">01</span>
    <span class="list-text"><strong>Interactive</strong> — work in the terminal</span>
  </div>
  <div class="list-item">
    <span class="list-num">02</span>
    <span class="list-text"><strong>Print / JSON</strong> — script and pipe output</span>
  </div>
  <div class="list-item">
    <span class="list-num">03</span>
    <span class="list-text"><strong>RPC</strong> — drive Pi programmatically</span>
  </div>
  <div class="list-item">
    <span class="list-num">04</span>
    <span class="list-text"><strong>SDK</strong> — embed Pi in an application</span>
  </div>
</div>

---

<!-- SLIDE 7 · TRY IT -->

<div class="header-row">
  <span class="page-num">VI.</span>
  <h2>Install</h2>
</div>

<div class="list">
  <div class="list-item">
    <span class="list-num">01</span>
    <span class="list-text"><strong>Install</strong> — <code>npm i -g @earendil-works/pi-coding-agent</code></span>
  </div>
  <div class="list-item">
    <span class="list-num">02</span>
    <span class="list-text"><strong>Run</strong> — <code>pi</code></span>
  </div>
</div>

---

<!-- SLIDE 8 · TAKEAWAY -->

<div class="header-row">
  <span class="page-num">VII.</span>
  <h2>Takeaway</h2>
</div>

<div class="list">
  <div class="list-item">
    <span class="list-num">01</span>
    <span class="list-text"><strong>Start with the core</strong> — four tools and a local runtime</span>
  </div>
  <div class="list-item">
    <span class="list-num">02</span>
    <span class="list-text"><strong>Choose your boundaries</strong> — sandbox what the agent can do</span>
  </div>
  <div class="list-item">
    <span class="list-num">03</span>
    <span class="list-text"><strong>Shape the rest</strong> — add extensions and skills as needed</span>
  </div>
</div>

---

<!-- SLIDE 9 · CTA -->
<!-- _class: cta -->

<div class="cta-content">
  <div class="cta-kicker">PI CODING AGENT</div>
  <h1>There are many coding agents.<br>This one is mine.</h1>
  <div class="cta-line">Install. Sandbox. Shape.</div>
  <!-- <div class="handle">earendil-works/pi</div> -->
</div>