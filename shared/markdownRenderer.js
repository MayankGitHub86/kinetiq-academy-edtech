/**
 * Kinetiq Academy — Universal Educational Markdown & Diagram Renderer
 * Safely transforms technical course markdown into rich, accessible textbook HTML.
 * Supports: Code blocks with copy, Mermaid diagrams, tables, callout notes,
 * task checkboxes, definitions, and knowledge-check question cards.
 */

(function () {
  'use strict';

  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function render(rawMarkdown) {
    if (!rawMarkdown || typeof rawMarkdown !== 'string') return '';

    // Step 1: Extract and protect Code Blocks & Diagrams
    const preservedBlocks = [];

    let text = rawMarkdown.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (match, lang, code) => {
      const idx = preservedBlocks.length;
      const cleanLang = (lang || 'code').trim().toLowerCase();

      if (cleanLang === 'mermaid') {
        preservedBlocks.push({ type: 'mermaid', code: code.trim() });
      } else {
        preservedBlocks.push({ type: 'code', lang: cleanLang, code: code.trim() });
      }
      return `\n\n@@PRESERVED_BLOCK_${idx}@@\n\n`;
    });

    // Step 2: Escape text HTML
    text = escapeHtml(text);

    // Step 3: Markdown Tables
    text = text.replace(/((?:\|[^\n]+\|\r?\n)+)/g, (tableText) => {
      const lines = tableText.trim().split('\n').map(l => l.trim()).filter(Boolean);
      if (lines.length < 2) return tableText;

      const headers = lines[0].split('|').map(c => c.trim()).filter((_, i, arr) => i > 0 && i < arr.length - 1);
      const isDivider = lines[1].includes('---');
      const rowStartIndex = isDivider ? 2 : 1;

      let html = '<div class="my-5 overflow-x-auto rounded-xl border border-outline-variant/30 bg-surface-container-lowest shadow-sm"><table class="w-full text-left text-xs border-collapse">';
      
      html += '<thead><tr class="bg-surface-container border-b border-outline-variant/30">';
      headers.forEach(h => {
        html += `<th class="py-2.5 px-3.5 font-bold text-primary uppercase tracking-wider text-[11px]">${h}</th>`;
      });
      html += '</tr></thead><tbody>';

      for (let r = rowStartIndex; r < lines.length; r++) {
        const cells = lines[r].split('|').map(c => c.trim()).filter((_, i, arr) => i > 0 && i < arr.length - 1);
        html += `<tr class="border-b border-outline-variant/15 hover:bg-surface-container/50 transition-colors">`;
        cells.forEach(cell => {
          html += `<td class="py-2.5 px-3.5 text-on-surface">${cell}</td>`;
        });
        html += '</tr>';
      }

      html += '</tbody></table></div>';
      return html;
    });

    // Step 4: Headings with styled badge and clean hierarchy
    text = text
      .replace(/^#### (.*$)/gim, '<h4 class="text-sm font-bold text-on-surface mt-5 mb-2">$1</h4>')
      .replace(/^### (.*$)/gim, '<h3 class="text-base font-bold text-on-surface mt-6 mb-2.5 flex items-center gap-2"><span class="w-1.5 h-4 rounded-full bg-secondary"></span>$1</h3>')
      .replace(/^## (.*$)/gim, '<h2 class="text-lg font-bold text-primary mt-8 mb-3 pb-1.5 border-b border-outline-variant/30 flex items-center gap-2"><span class="w-2 h-5 rounded-full bg-primary"></span>$1</h2>')
      .replace(/^# (.*$)/gim, '<h1 class="text-2xl font-bold text-on-surface mt-6 mb-3 tracking-tight">$1</h1>');

    // Step 5: Callout Notes & Blockquotes
    text = text.replace(/^&gt; (.*$)/gim, (match, content) => {
      if (content.includes('⚠️') || content.toLowerCase().includes('mistake') || content.toLowerCase().includes('warning')) {
        return `<div class="my-4 p-4 rounded-xl bg-error-container/10 border-l-4 border-error text-xs space-y-1"><div class="font-bold text-error flex items-center gap-1.5"><span class="material-symbols-outlined text-[16px]">warning</span> Caution / Common Mistake</div><div class="text-on-surface-variant leading-relaxed">${content.replace(/^[⚠️\s*]+/, '')}</div></div>`;
      }
      if (content.includes('💡') || content.toLowerCase().includes('tip') || content.toLowerCase().includes('takeaway')) {
        return `<div class="my-4 p-4 rounded-xl bg-primary/10 border-l-4 border-primary text-xs space-y-1"><div class="font-bold text-primary flex items-center gap-1.5"><span class="material-symbols-outlined text-[16px]">lightbulb</span> Key Architectural Takeaway</div><div class="text-on-surface leading-relaxed">${content.replace(/^[💡\s*]+/, '')}</div></div>`;
      }
      return `<blockquote class="p-3.5 my-3.5 rounded-xl bg-surface-container border-l-4 border-secondary text-xs text-on-surface-variant italic leading-relaxed">${content}</blockquote>`;
    });

    // Step 6: Task Lists & Checkboxes
    text = text.replace(/^\s*-\s*\[x\]\s*(.*$)/gim, '<div class="flex items-center gap-2.5 my-1.5 text-xs text-on-surface"><span class="w-4 h-4 rounded bg-secondary/20 text-secondary flex items-center justify-center text-[12px] font-bold">✓</span><span>$1</span></div>');
    text = text.replace(/^\s*-\s*\[\s*\]\s*(.*$)/gim, '<div class="flex items-center gap-2.5 my-1.5 text-xs text-on-surface-variant"><span class="w-4 h-4 rounded border border-outline-variant flex items-center justify-center"></span><span>$1</span></div>');

    // Step 7: Standard Lists
    text = text.replace(/^\s*[-*]\s+(.*$)/gim, '<li class="ml-4 list-disc text-on-surface-variant text-xs leading-relaxed my-1">$1</li>');
    text = text.replace(/^\s*(\d+)\.\s+(.*$)/gim, '<li class="ml-4 list-decimal text-on-surface-variant text-xs leading-relaxed my-1"><strong class="text-on-surface">$1.</strong> $2</li>');

    // Step 8: Inline Styling (Bold, Italic, Code)
    text = text
      .replace(/\*\*(.*?)\*\*/g, '<strong class="text-on-surface font-bold">$1</strong>')
      .replace(/\*(.*?)\*/g, '<em class="text-on-surface-variant italic">$1</em>')
      .replace(/`([^`]+)`/g, '<code class="px-1.5 py-0.5 rounded bg-surface-container-high text-primary font-mono text-xs border border-outline-variant/30">$1</code>');

    // Step 9: Paragraph formatting
    text = text.replace(/\n\n+/g, '<div class="my-3"></div>');

    // Step 10: Restore Code Blocks & Diagrams
    preservedBlocks.forEach((block, idx) => {
      const placeholder = `@@PRESERVED_BLOCK_${idx}@@`;

      if (block.type === 'mermaid') {
        const diagramHtml = `
          <div class="my-5 p-4 rounded-xl bg-surface-container-lowest border border-outline-variant/40 shadow-md space-y-2">
            <div class="flex items-center justify-between text-xs pb-2 border-b border-outline-variant/20">
              <span class="font-bold text-primary flex items-center gap-1.5">
                <span class="material-symbols-outlined text-[16px]">account_tree</span> Architectural Diagram
              </span>
              <span class="text-[10px] uppercase font-mono text-outline">Mermaid Flow</span>
            </div>
            <div class="p-3 bg-surface-container-high/40 rounded-lg overflow-x-auto text-xs font-mono text-secondary leading-relaxed">
              <pre>${escapeHtml(block.code)}</pre>
            </div>
          </div>
        `;
        text = text.replace(placeholder, diagramHtml);
      } else {
        const copyId = `code-block-${idx}-${Date.now()}`;
        const codeHtml = `
          <div class="my-5 rounded-xl overflow-hidden border border-outline-variant/40 bg-surface-container-lowest shadow-lg">
            <div class="px-4 py-2 bg-surface-container flex items-center justify-between border-b border-outline-variant/30 text-xs font-mono text-outline">
              <div class="flex items-center gap-2">
                <span class="w-2.5 h-2.5 rounded-full bg-error/40"></span>
                <span class="w-2.5 h-2.5 rounded-full bg-tertiary/40"></span>
                <span class="w-2.5 h-2.5 rounded-full bg-secondary/40"></span>
                <span class="uppercase font-bold text-primary ml-1">${escapeHtml(block.lang)}</span>
              </div>
              <button onclick="window.copyLessonCode('${copyId}')" type="button" class="text-[11px] hover:text-on-surface flex items-center gap-1 transition-colors px-2 py-0.5 rounded hover:bg-surface-container-high">
                <span class="material-symbols-outlined text-[14px]">content_copy</span> Copy
              </button>
            </div>
            <pre id="${copyId}" class="p-4 text-xs font-mono leading-relaxed text-secondary overflow-x-auto whitespace-pre"><code>${escapeHtml(block.code)}</code></pre>
          </div>
        `;
        text = text.replace(placeholder, codeHtml);
      }
    });

    return text;
  }

  // Copy helper
  window.copyLessonCode = function (elId) {
    const el = document.getElementById(elId);
    if (!el) return;
    const text = el.innerText || el.textContent;
    navigator.clipboard.writeText(text).then(() => {
      window.KinetiqAPI?.ui?.showSuccess('Code copied to clipboard!') || console.log('Copied');
    }).catch(() => {});
  };

  window.KinetiqMarkdown = {
    render,
    escapeHtml,
  };
})();
