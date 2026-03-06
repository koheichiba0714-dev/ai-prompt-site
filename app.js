// ===== AI Prompt Lab — 2026 Bento Dashboard =====
document.addEventListener('DOMContentLoaded', () => {
    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => document.querySelectorAll(sel);

    // DOM refs
    const topPage = $('#top-page');
    const categoryPage = $('#category-page');
    const searchResults = $('#search-results');
    const categoryGrid = $('#category-grid');
    const promptList = $('#prompt-list');
    const filterTabs = $('#filter-tabs');
    const toast = $('#toast');

    // Command Palette refs
    const cmdOverlay = $('#cmd-palette-overlay');
    const cmdInput = $('#cmd-search-input');
    const cmdResultsEl = $('#cmd-results');
    const searchTrigger = $('#search-trigger');

    let currentCategory = null;

    // ===== LocalStorage Helpers =====
    const STORAGE_KEYS = {
        COPY_COUNTS: 'promptlab_copy_counts',
        RATINGS: 'promptlab_ratings',
        MEMOS: 'promptlab_memos'
    };

    function getStore(key) {
        try { return JSON.parse(localStorage.getItem(key)) || {}; } catch { return {}; }
    }
    function setStore(key, data) {
        localStorage.setItem(key, JSON.stringify(data));
    }

    function getCopyCount(promptId) {
        return getStore(STORAGE_KEYS.COPY_COUNTS)[promptId] || 0;
    }
    function incrementCopyCount(promptId) {
        const counts = getStore(STORAGE_KEYS.COPY_COUNTS);
        counts[promptId] = (counts[promptId] || 0) + 1;
        setStore(STORAGE_KEYS.COPY_COUNTS, counts);
        return counts[promptId];
    }
    function getTotalCopies() {
        const counts = getStore(STORAGE_KEYS.COPY_COUNTS);
        return Object.values(counts).reduce((a, b) => a + b, 0);
    }

    function getRating(promptId) {
        return getStore(STORAGE_KEYS.RATINGS)[promptId] || 0;
    }
    function setRating(promptId, rating) {
        const ratings = getStore(STORAGE_KEYS.RATINGS);
        ratings[promptId] = rating;
        setStore(STORAGE_KEYS.RATINGS, ratings);
    }

    function getMemo(promptId) {
        return getStore(STORAGE_KEYS.MEMOS)[promptId] || '';
    }
    function saveMemo(promptId, text) {
        const memos = getStore(STORAGE_KEYS.MEMOS);
        if (text.trim()) { memos[promptId] = text; } else { delete memos[promptId]; }
        setStore(STORAGE_KEYS.MEMOS, memos);
    }

    // ===== Stats =====
    function computeStats() {
        let totalPrompts = 0;
        const totalCategories = Object.keys(PROMPT_DATA).length;
        Object.values(PROMPT_DATA).forEach(cat => {
            cat.sections.forEach(s => { totalPrompts += s.items.length; });
        });
        return { totalPrompts, totalCategories, totalCopies: getTotalCopies() };
    }

    function animateCounter(el, target) {
        const duration = 800;
        const start = performance.now();
        const initial = 0;
        function tick(now) {
            const progress = Math.min((now - start) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            el.textContent = Math.floor(initial + (target - initial) * eased);
            if (progress < 1) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
    }

    function updateStats() {
        const stats = computeStats();
        animateCounter($('#stat-prompts'), stats.totalPrompts);
        animateCounter($('#stat-categories'), stats.totalCategories);
        animateCounter($('#stat-copies'), stats.totalCopies);
    }

    // ===== Star Rating HTML =====
    function renderStars(promptId, interactive = true) {
        const current = getRating(promptId);
        const stars = [1, 2, 3, 4, 5].map(n => {
            const filled = n <= current;
            const cls = interactive ? 'star-btn' : 'star-btn star-btn--static';
            return `<button class="${cls} ${filled ? 'star-btn--filled' : ''}" data-prompt-id="${promptId}" data-value="${n}" ${!interactive ? 'disabled' : ''}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="${filled ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                </svg>
            </button>`;
        }).join('');
        const countLabel = current > 0 ? `<span class="star-rating__value">${current}/5</span>` : '';
        return `<div class="star-rating" data-prompt-id="${promptId}">${stars}${countLabel}</div>`;
    }

    // ===== Render Category Cards =====
    function renderCategoryGrid() {
        categoryGrid.innerHTML = '';
        Object.entries(PROMPT_DATA).forEach(([key, cat]) => {
            const tags = cat.sections.slice(0, 4).map(s => `<span class="category-card__tag">${s.title}</span>`).join('');
            const moreCount = cat.sections.length > 4 ? `<span class="category-card__tag">+${cat.sections.length - 4}</span>` : '';
            const totalPrompts = cat.sections.reduce((sum, s) => sum + s.items.length, 0);
            categoryGrid.innerHTML += `
        <div class="category-card" data-cat="${key}" onclick="window.APP.openCategory('${key}')">
          <div class="category-card__content">
            <div class="category-card__icon-badge">${cat.icon}</div>
            <div class="category-card__title-row">
              <h3 class="category-card__title">${cat.title}</h3>
              <span class="category-card__count">${totalPrompts}件</span>
            </div>
            <p class="category-card__desc">${cat.description}</p>
            <div class="category-card__meta">${tags}${moreCount}</div>
          </div>
          <div class="category-card__arrow"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg></div>
        </div>`;
        });
    }

    // ===== Open Category =====
    function openCategory(key) {
        currentCategory = key;
        const cat = PROMPT_DATA[key];
        $('#cat-icon').textContent = cat.icon;
        $('#cat-title').textContent = cat.title;
        $('#cat-desc').textContent = cat.description;

        filterTabs.innerHTML = `<button class="filter-tab active" data-filter="all">すべて</button>`;
        cat.sections.forEach((s, i) => {
            filterTabs.innerHTML += `<button class="filter-tab" data-filter="${i}">${s.title}</button>`;
        });
        $$('.filter-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                $$('.filter-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                renderPrompts(key, tab.dataset.filter);
            });
        });

        renderPrompts(key, 'all');
        topPage.style.display = 'none';
        searchResults.style.display = 'none';
        categoryPage.style.display = 'block';
        categoryPage.classList.add('page-enter');
        setTimeout(() => categoryPage.classList.remove('page-enter'), 400);
        window.scrollTo(0, 0);
        history.pushState({ cat: key }, '', `#${key}`);
    }

    // ===== Render Prompts =====
    function renderPrompts(key, filter) {
        const cat = PROMPT_DATA[key];
        promptList.innerHTML = '';
        cat.sections.forEach((section, sIdx) => {
            if (filter !== 'all' && parseInt(filter) !== sIdx) return;
            let html = `<div class="prompt-section"><h3 class="prompt-section__title">${section.title}<span class="prompt-section__badge">${section.items.length}件</span></h3>`;
            section.items.forEach((item, iIdx) => {
                const id = `${key}-${sIdx}-${iIdx}`;
                const promptHtml = highlightBrackets(item.prompt);
                const copyCount = getCopyCount(id);
                const copyBadge = copyCount > 0 ? `<span class="copy-count-badge" title="コピーされた回数">${copyCount}回コピー</span>` : '';
                const memo = getMemo(id);
                const memoVal = memo ? escapeHtml(memo) : '';
                html += `
          <div class="prompt-item" id="pi-${id}">
            <div class="prompt-item__header" onclick="window.APP.toggleItem('pi-${id}')">
              <span class="prompt-item__title">${item.title}${copyBadge}</span>
              <svg class="prompt-item__chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
            </div>
            <div class="prompt-item__body"><div class="prompt-item__content">
              <div class="prompt-item__prompt">
                <button class="copy-btn" onclick="event.stopPropagation();window.APP.copyPrompt(this,'${id}')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>コピー</button>
                ${promptHtml}
              </div>
              <div class="prompt-item__actions">
                <div class="prompt-item__rating">
                  <span class="prompt-item__rating-label">評価</span>
                  ${renderStars(id)}
                </div>
                <div class="prompt-item__memo">
                  <label class="prompt-item__memo-label" for="memo-${id}">📝 メモ</label>
                  <textarea class="prompt-item__memo-input" id="memo-${id}" data-prompt-id="${id}" placeholder="使ってみた感想やカスタマイズのメモ…" rows="2">${memoVal}</textarea>
                </div>
              </div>
            </div></div>
          </div>`;
            });
            html += '</div>';
            promptList.innerHTML += html;
        });

        // Attach memo listeners
        $$('.prompt-item__memo-input').forEach(ta => {
            ta.addEventListener('blur', () => {
                saveMemo(ta.dataset.promptId, ta.value);
                showToast('メモを保存しました');
            });
        });

        // Attach star listeners
        attachStarListeners();
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // ===== Highlight 【】 brackets =====
    function highlightBrackets(text) {
        return text.replace(/【([^】]*)】/g, '<span class="highlight">【$1】</span>');
    }

    // ===== Toggle Accordion =====
    function toggleItem(id) {
        const el = document.getElementById(id);
        el.classList.toggle('open');
    }

    // ===== Copy Prompt =====
    function copyPrompt(btn, id) {
        const promptEl = btn.closest('.prompt-item__prompt');
        const text = promptEl.innerText.replace('コピー', '').replace('PROMPT', '').trim();
        navigator.clipboard.writeText(text).then(() => {
            const count = incrementCopyCount(id);
            btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>完了';
            btn.classList.add('copied');
            showToast(`コピーしました（${count}回目）`);

            // Update badge in header
            const header = btn.closest('.prompt-item').querySelector('.copy-count-badge');
            if (header) {
                header.textContent = `${count}回コピー`;
            } else {
                const titleEl = btn.closest('.prompt-item').querySelector('.prompt-item__title');
                titleEl.insertAdjacentHTML('beforeend', `<span class="copy-count-badge">${count}回コピー</span>`);
            }

            // Update hero stat
            $('#stat-copies').textContent = getTotalCopies();

            setTimeout(() => {
                btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>コピー';
                btn.classList.remove('copied');
            }, 2000);
        });
    }

    // ===== Star Rating Interaction =====
    function attachStarListeners() {
        $$('.star-btn:not(.star-btn--static)').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const promptId = btn.dataset.promptId;
                const value = parseInt(btn.dataset.value);
                setRating(promptId, value);
                // Re-render stars in this rating container
                const container = btn.closest('.star-rating');
                container.outerHTML = renderStars(promptId);
                attachStarListeners();
                showToast(`★${value} を評価しました`);
            });
        });
    }

    // ===== Toast =====
    function showToast(msg) {
        $('#toast-msg').textContent = msg;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 2500);
    }

    // ===== Command Palette =====
    function openCmdPalette() {
        cmdOverlay.classList.add('open');
        setTimeout(() => cmdInput.focus(), 100);
    }

    function closeCmdPalette() {
        cmdOverlay.classList.remove('open');
        cmdInput.value = '';
        cmdResultsEl.innerHTML = '<div class="cmd-palette__empty">キーワードを入力してプロンプトを検索</div>';
    }

    searchTrigger.addEventListener('click', openCmdPalette);

    cmdOverlay.addEventListener('click', (e) => {
        if (e.target === cmdOverlay) closeCmdPalette();
    });

    document.addEventListener('keydown', (e) => {
        // ⌘K or CtrlK
        if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
            e.preventDefault();
            if (cmdOverlay.classList.contains('open')) { closeCmdPalette(); }
            else { openCmdPalette(); }
        }
        // / to search
        if (e.key === '/' && !cmdOverlay.classList.contains('open') && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
            e.preventDefault();
            openCmdPalette();
        }
        // Escape
        if (e.key === 'Escape' && cmdOverlay.classList.contains('open')) {
            closeCmdPalette();
        }
    });

    let cmdSearchTimeout;
    cmdInput.addEventListener('input', () => {
        clearTimeout(cmdSearchTimeout);
        cmdSearchTimeout = setTimeout(() => {
            const q = cmdInput.value.trim().toLowerCase();
            if (q.length < 1) {
                cmdResultsEl.innerHTML = '<div class="cmd-palette__empty">キーワードを入力してプロンプトを検索</div>';
                return;
            }
            const results = searchAllPrompts(q);
            renderCmdResults(results, q);
        }, 150);
    });

    function searchAllPrompts(query) {
        const results = [];
        Object.entries(PROMPT_DATA).forEach(([key, cat]) => {
            cat.sections.forEach((section, sIdx) => {
                section.items.forEach((item, iIdx) => {
                    if (item.title.toLowerCase().includes(query) || item.prompt.toLowerCase().includes(query)) {
                        results.push({
                            ...item, catKey: key, catTitle: cat.title, catIcon: cat.icon,
                            sectionTitle: section.title, sIdx, iIdx,
                            id: `${key}-${sIdx}-${iIdx}`
                        });
                    }
                });
            });
        });
        return results;
    }

    const catColorMap = {
        cameraman: 'var(--accent-camera)',
        designer: 'var(--accent-designer)',
        lifesupport: 'var(--accent-lifesupport)',
        agency: 'var(--accent-agency)',
        coder: 'var(--accent-coder)'
    };

    const catBgMap = {
        cameraman: 'var(--accent-camera-bg)',
        designer: 'var(--accent-designer-bg)',
        lifesupport: 'var(--accent-lifesupport-bg)',
        agency: 'var(--accent-agency-bg)',
        coder: 'var(--accent-coder-bg)'
    };

    function renderCmdResults(results, query) {
        if (results.length === 0) {
            cmdResultsEl.innerHTML = `<div class="cmd-palette__empty">「${query}」に一致するプロンプトが見つかりません</div>`;
            return;
        }
        cmdResultsEl.innerHTML = results.slice(0, 15).map(r => {
            const copyCount = getCopyCount(r.id);
            const copyInfo = copyCount > 0 ? `<span style="margin-left:4px;opacity:0.5">・${copyCount}回コピー</span>` : '';
            return `
            <div class="cmd-palette__item" onclick="window.APP.cmdSelectItem('${r.catKey}', '${r.id}')">
                <div class="cmd-palette__item-icon" style="background:${catBgMap[r.catKey] || '#f0f0f0'}">${r.catIcon}</div>
                <div class="cmd-palette__item-content">
                    <div class="cmd-palette__item-title">${r.title}</div>
                    <div class="cmd-palette__item-meta">${r.catTitle} › ${r.sectionTitle}${copyInfo}</div>
                </div>
                <svg class="cmd-palette__item-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
            </div>`;
        }).join('');

        if (results.length > 15) {
            cmdResultsEl.innerHTML += `<div class="cmd-palette__empty" style="padding:12px">他 ${results.length - 15} 件…</div>`;
        }
    }

    function cmdSelectItem(catKey, promptId) {
        closeCmdPalette();
        openCategory(catKey);
        // Open the specific prompt
        setTimeout(() => {
            const el = document.getElementById(`pi-${promptId}`);
            if (el) {
                el.classList.add('open');
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                el.style.boxShadow = '0 0 0 2px var(--accent-primary), var(--shadow-lg)';
                setTimeout(() => { el.style.boxShadow = ''; }, 2000);
            }
        }, 200);
    }

    // ===== Old search (kept for search results page fallback) =====
    const globalSearch = $('#global-search');
    function performSearch(query) {
        const results = searchAllPrompts(query);

        $('#search-query-display').textContent = `"${query}"`;
        $('#search-count').textContent = `${results.length}件のプロンプトが見つかりました`;

        const list = $('#search-prompt-list');
        list.innerHTML = '';
        results.forEach((item, i) => {
            const id = `search-${i}`;
            const promptHtml = highlightBrackets(item.prompt);
            const catColor = catColorMap[item.catKey] || 'var(--accent-primary)';
            const copyCount = getCopyCount(item.id);
            const copyBadge = copyCount > 0 ? `<span class="copy-count-badge">${copyCount}回コピー</span>` : '';
            list.innerHTML += `
        <div class="prompt-item" id="pi-${id}">
          <div class="prompt-item__header" onclick="window.APP.toggleItem('pi-${id}')">
            <span class="prompt-item__title"><span class="prompt-item__cat-badge" style="background:${catColor}20;color:${catColor}">${item.catIcon} ${item.catTitle}</span>${item.title}${copyBadge}</span>
            <svg class="prompt-item__chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
          </div>
          <div class="prompt-item__body"><div class="prompt-item__content">
            <div class="prompt-item__prompt">
              <button class="copy-btn" onclick="event.stopPropagation();window.APP.copyPrompt(this,'${item.id}')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>コピー</button>
              ${promptHtml}
            </div>
          </div></div>
        </div>`;
        });

        topPage.style.display = 'none';
        categoryPage.style.display = 'none';
        searchResults.style.display = 'block';
    }

    // ===== Navigation =====
    function goHome() {
        topPage.style.display = 'block';
        categoryPage.style.display = 'none';
        searchResults.style.display = 'none';
        currentCategory = null;
        history.pushState({}, '', window.location.pathname);
        window.scrollTo(0, 0);
        updateStats();
    }

    $('#back-btn').addEventListener('click', goHome);
    $('#search-back-btn').addEventListener('click', () => { globalSearch.value = ''; goHome(); });
    $('#logo-link').addEventListener('click', (e) => { e.preventDefault(); globalSearch.value = ''; goHome(); });

    window.addEventListener('popstate', (e) => {
        if (e.state && e.state.cat) { openCategory(e.state.cat); }
        else { goHome(); }
    });

    // ===== Expose global API =====
    window.APP = { openCategory, toggleItem, copyPrompt, cmdSelectItem };

    // ===== Init =====
    renderCategoryGrid();
    updateStats();

    // Handle direct hash navigation
    const hash = window.location.hash.slice(1);
    if (hash && PROMPT_DATA[hash]) { openCategory(hash); }
});
