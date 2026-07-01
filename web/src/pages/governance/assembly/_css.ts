export const ASSEMBLY_CSS = `@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');

  .kp-root, .kp-root * { box-sizing: border-box; }
  
  .kp-root { background:#07090C; color:#E8ECF0; font-family:'Inter',system-ui,sans-serif; -webkit-font-smoothing:antialiased; min-height:100vh; }
  .kp-root ::selection { background: rgba(240,165,0,.3); }
  .krd-scroll::-webkit-scrollbar { width: 5px; }
  .krd-scroll::-webkit-scrollbar-thumb { background: #2D3540; border-radius: 9999px; }
  .kp-root a { text-decoration:none; color:inherit; }
  @keyframes pp-spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }
  @keyframes pp-spin-rev { from { transform: rotate(0); } to { transform: rotate(-360deg); } }
  @keyframes pp-pulse { 0%,100% { opacity: 1; } 50% { opacity: .55; } }
  @keyframes pp-glow { 0%,100% { opacity: .5; transform: scale(1);} 50% { opacity: .9; transform: scale(1.06);} }
  @keyframes pp-grow { from { transform: scaleX(0);} to { transform: scaleX(1);} }
  @keyframes pp-blink { 0%,100% { opacity: 1; } 50% { opacity: .25; } }
  @keyframes pp-float { 0%,100% { transform: translateY(0);} 50% { transform: translateY(-6px);} }
  @keyframes pp-drift { from { background-position: 0 0; } to { background-position: 600px 300px; } }
`;
