---
marp: true
paginate: true
html: true
theme: default
style: |
  @import url('https://fonts.googleapis.com/css2?family=DM+Mono:ital,wght@0,300;0,400;0,500;1,400&family=DM+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap');

  :root {
    --body: 'DM Sans', ui-sans-serif, system-ui, sans-serif;
    --mono: 'DM Mono', ui-monospace, monospace;
    --black:       #101010;
    --dark:        #2c2c2a;
    --subtle:      #55554f;
    --muted:       #86857f;
    --faint:       #b5b4ae;
    --bg:          #f7f6f2;
    --accent:      #d77600;
    --card-border: #dedcd4;
  }

  section {
    font-family: var(--body);
    background: var(--bg);
    color: var(--black);
    padding: 176px 96px 92px;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    overflow: hidden;
    position: relative;
    border-radius: 0;
  }

  h1 {
    font-size: 48px;
    font-weight: 700;
    line-height: 1.08;
    margin: 0 0 20px 0;
    color: var(--black);
    letter-spacing: -0.01em;
  }
  h2 {
    font-size: 36px;
    font-weight: 700;
    line-height: 1.1;
    margin: 0 0 24px 0;
    color: var(--black);
    letter-spacing: -0.01em;
    border: none;
  }
  p {
    font-size: 20px;
    line-height: 1.5;
    color: var(--subtle);
    margin: 0 0 16px 0;
  }
  strong { color: var(--black); font-weight: 600; }
  em     { color: var(--accent); font-style: normal; }
  code {
    font-family: var(--mono);
    background: transparent;
    border: none;
    color: var(--accent);
    padding: 0;
    border-radius: 0;
    font-size: 0.9em;
  }
  .header-row {
    display: flex;
    justify-content: flex-start;
    align-items: baseline;
    gap: 24px;
    margin-bottom: 36px;
  }
  .header-row h2 {
    margin: 0;
    font-size: 36px;
  }
  .page-num {
    font-family: var(--mono);
    font-size: 30px;
    line-height: 1.15;
    color: var(--accent);
    letter-spacing: 0;
    flex-shrink: 0;
  }
  .cards-col {
    display: flex;
    flex-direction: column;
    gap: 18px;
    width: 100%;
    max-width: 880px;
    margin: 0 auto 24px;
  }
  .card-row {
    background: transparent;
    border: none;
    border-left: 2px solid var(--accent);
    border-radius: 0;
    padding: 0 0 0 22px;
    display: flex;
    align-items: flex-start;
    gap: 18px;
  }
  .card-row-letter {
    font-family: var(--mono);
    font-size: 14px;
    color: var(--accent);
    flex-shrink: 0;
    margin-top: 2px;
    min-width: 20px;
  }
  .card-row-body h3 {
    font-size: 20px;
    font-weight: 600;
    color: var(--black);
    margin: 0 0 6px;
  }
  .card-row-body p {
    font-size: 18px;
    color: var(--subtle);
    margin: 0;
    line-height: 1.45;
  }

  .list {
    display: flex;
    flex-direction: column;
    gap: 16px;
    width: 100%;
    max-width: 880px;
    margin: 0 auto 24px;
  }
  .list-item {
    display: flex;
    align-items: flex-start;
    gap: 20px;
    background: transparent;
    border: none;
    border-radius: 0;
    padding: 0;
  }
  .list-num {
    font-family: var(--mono);
    font-size: 14px;
    color: var(--accent);
    flex-shrink: 0;
    margin-top: 3px;
    min-width: 22px;
  }
  .list-text { font-size: 20px; color: var(--subtle); line-height: 1.45; }
  .list-text strong { color: var(--black); }

  section.cover {
    justify-content: center;
    text-align: center;
    padding: 64px 96px 92px;
    background: #fbfaf7;
  }
  .cover-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    max-width: 900px;
  }
  .cover-kicker,
  .cta-kicker {
    font-family: var(--mono);
    font-size: 14px;
    color: var(--accent);
    letter-spacing: 3px;
    text-transform: uppercase;
    margin-bottom: 30px;
  }
  section.cover h1 {
    font-size: 72px;
    line-height: 1.02;
    margin-bottom: 24px;
  }
  section.cover p {
    max-width: 760px;
    font-size: 24px;
    color: var(--subtle);
    margin-bottom: 28px;
  }
  .cover-meta {
    display: flex;
    flex-direction: column;
    gap: 8px;
    font-family: var(--mono);
    font-size: 14px;
    color: var(--muted);
    letter-spacing: 2px;
    text-transform: uppercase;
  }

  section.divider {
    justify-content: center;
    border-left: 5px solid var(--accent);
    background: #f1efe9;
  }
  section.divider h1 { font-size: 52px; color: var(--black); margin-bottom: 16px; }
  section.divider p  { font-size: 18px; color: var(--muted); }

  section.cta {
    justify-content: center;
    align-items: center;
    text-align: center;
    background: var(--black);
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
    max-width: 900px;
  }
  section.cta h1 {
    color: #f7f6f2;
    font-size: 56px;
    line-height: 1.1;
    letter-spacing: -0.01em;
    margin-bottom: 24px;
  }
  .cta-line {
    font-family: var(--mono);
    font-size: 15px;
    color: var(--accent);
    letter-spacing: 1px;
    margin-bottom: 4px;
  }
  section.cta .handle {
    font-family: var(--mono);
    font-size: 15px;
    color: #a7a6a1;
    margin-top: 22px;
    letter-spacing: 2px;
    text-transform: uppercase;
  }

  section.split-slide {
    padding-top: 140px;
  }
  section.split-slide > .header-row,
  section.split-slide > .cards-col,
  section.split-slide > .list {
    width: 54%;
    max-width: none;
    margin-left: 0;
    margin-right: auto;
  }
  section.split-slide > .header-row {
    margin-bottom: 36px;
  }
  section.split-slide > .cards-col,
  section.split-slide > .list {
    margin-bottom: 24px;
  }
  .visual-panel {
    position: absolute;
    top: 140px;
    right: 96px;
    width: 36%;
    max-width: 410px;
    min-height: 300px;
    box-sizing: border-box;
    padding: 24px;
    background: #fbfaf7;
    border: 1px solid var(--card-border);
  }
  .visual-caption,
  .visual-flow-label {
    font-family: var(--mono);
    font-size: 11px;
    letter-spacing: 2px;
    color: var(--accent);
    text-align: center;
  }
  .visual-flow-label {
    color: var(--muted);
    letter-spacing: 1px;
    margin-top: 24px;
  }
  .flow-core {
    width: 150px;
    margin: 20px auto 0;
    padding: 14px 12px 12px;
    box-sizing: border-box;
    border-radius: 8px;
    background: var(--black);
    color: var(--bg);
    font-size: 20px;
    font-weight: 700;
    text-align: center;
  }
  .flow-core span {
    display: block;
    margin-top: 4px;
    color: var(--faint);
    font-family: var(--body);
    font-size: 12px;
    font-weight: 400;
  }
  .flow-stem {
    width: 2px;
    height: 24px;
    margin: 0 auto;
    background: var(--faint);
  }
  .flow-tools {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
    align-items: start;
  }
  .flow-tool {
    position: relative;
    padding: 14px 4px 12px;
    border: 1px solid var(--card-border);
    border-radius: 6px;
    color: var(--black);
    font-family: var(--mono);
    font-size: 13px;
    text-align: center;
  }
  .flow-tool::before {
    content: '↓';
    display: block;
    margin: -27px 0 8px;
    color: var(--accent);
    font-family: var(--body);
    font-size: 18px;
  }
  .tradeoff-flow {
    display: grid;
    grid-template-columns: 1fr auto 1fr auto 1fr;
    gap: 8px;
    align-items: center;
    margin-top: 52px;
  }
  .tradeoff-step {
    min-height: 112px;
    padding: 12px 8px;
    box-sizing: border-box;
    border: 1px solid var(--card-border);
    border-radius: 8px;
    text-align: center;
  }
  .tradeoff-step span {
    display: block;
    color: var(--accent);
    font-family: var(--mono);
    font-size: 11px;
    margin-bottom: 14px;
  }
  .tradeoff-step strong {
    display: block;
    font-size: 14px;
    line-height: 1.2;
  }
  .tradeoff-step small {
    display: block;
    margin-top: 10px;
    color: var(--subtle);
    font-size: 11px;
    line-height: 1.2;
  }
  .tradeoff-arrow {
    color: var(--accent);
    font-size: 22px;
  }

  section > .header-row,
  section > h2 {
    width: 100%;
    max-width: 880px;
  }

  section::after {
    font-family: var(--mono);
    font-size: 11px;
    color: var(--accent);
    letter-spacing: 1px;
    content: 'PI CODING AGENT · ' attr(data-marpit-pagination) ' / ' attr(data-marpit-pagination-total);
    position: absolute;
    bottom: 26px;
    right: 48px;
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
<!-- _class: split-slide -->

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

<div class="visual-panel" aria-label="Pi connected to four tools">
  <div class="visual-caption">ONE SMALL CORE</div>
  <div class="flow-core">PI<span>coding agent</span></div>
  <div class="flow-stem"></div>
  <div class="flow-tools">
    <div class="flow-tool">read</div>
    <div class="flow-tool">write</div>
    <div class="flow-tool">edit</div>
    <div class="flow-tool">bash</div>
  </div>
  <div class="visual-flow-label">LOCAL RUNTIME · FOUR TOOLS</div>
</div>

---

<!-- SLIDE 3 · WHY PI -->
<!-- _class: split-slide -->

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

<div class="visual-panel" aria-label="Flow from less built in to more control and more extensibility">
  <div class="visual-caption">THE TRADE-OFF</div>
  <div class="tradeoff-flow">
    <div class="tradeoff-step"><span>01</span><strong>Less built in</strong><small>fewer defaults</small></div>
    <div class="tradeoff-arrow">→</div>
    <div class="tradeoff-step"><span>02</span><strong>More control</strong><small>choose boundaries</small></div>
    <div class="tradeoff-arrow">→</div>
    <div class="tradeoff-step"><span>03</span><strong>More extensible</strong><small>add as needed</small></div>
  </div>
  <div class="visual-flow-label">SIMPLER CORE → GREATER AGENCY</div>
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