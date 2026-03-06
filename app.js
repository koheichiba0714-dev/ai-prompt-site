// ===== App Logic =====
document.addEventListener('DOMContentLoaded', () => {
    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => document.querySelectorAll(sel);

    const topPage = $('#top-page');
    const categoryPage = $('#category-page');
    const searchResults = $('#search-results');
    const categoryGrid = $('#category-grid');
    const promptList = $('#prompt-list');
    const filterTabs = $('#filter-tabs');
    const globalSearch = $('#global-search');
    const toast = $('#toast');

    let currentCategory = null;

    // ===== Render Category Cards =====
    function renderCategoryGrid() {
        categoryGrid.innerHTML = '';
        Object.entries(PROMPT_DATA).forEach(([key, cat]) => {
            const tags = cat.sections.map(s => `<span class="category-card__tag">${s.title}</span>`).join('');
            const totalPrompts = cat.sections.reduce((sum, s) => sum + s.items.length, 0);
            categoryGrid.innerHTML += `
        <div class="category-card" data-cat="${key}" onclick="window.APP.openCategory('${key}')">
          <div class="category-card__content">
            <span class="category-card__icon">${cat.icon}</span>
            <h3 class="category-card__title">${cat.title}</h3>
            <p class="category-card__desc">${cat.description}</p>
            <div class="category-card__meta">${tags}<span class="category-card__tag">${totalPrompts}件</span></div>
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

        // Render filter tabs
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
                html += `
          <div class="prompt-item" id="pi-${id}">
            <div class="prompt-item__header" onclick="window.APP.toggleItem('pi-${id}')">
              <span class="prompt-item__title">${item.title}</span>
              <svg class="prompt-item__chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
            </div>
            <div class="prompt-item__body"><div class="prompt-item__content">
              <div class="prompt-item__prompt">
                <button class="copy-btn" onclick="event.stopPropagation();window.APP.copyPrompt(this,'${id}')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>コピー</button>
                ${promptHtml}
              </div>
            </div></div>
          </div>`;
            });
            html += '</div>';
            promptList.innerHTML += html;
        });
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
        const text = promptEl.innerText.replace('コピー', '').trim();
        navigator.clipboard.writeText(text).then(() => {
            btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>完了';
            btn.classList.add('copied');
            showToast('クリップボードにコピーしました');
            setTimeout(() => {
                btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>コピー';
                btn.classList.remove('copied');
            }, 2000);
        });
    }

    // ===== Toast =====
    function showToast(msg) {
        $('#toast-msg').textContent = msg;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 2500);
    }

    // ===== Search =====
    let searchTimeout;
    globalSearch.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            const q = e.target.value.trim().toLowerCase();
            if (q.length < 2) { goHome(); return; }
            performSearch(q);
        }, 300);
    });

    globalSearch.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') { globalSearch.value = ''; goHome(); }
    });

    // Keyboard shortcut: /
    document.addEventListener('keydown', (e) => {
        if (e.key === '/' && document.activeElement !== globalSearch) {
            e.preventDefault();
            globalSearch.focus();
        }
    });

    function performSearch(query) {
        const results = [];
        Object.entries(PROMPT_DATA).forEach(([key, cat]) => {
            cat.sections.forEach((section) => {
                section.items.forEach((item) => {
                    if (item.title.toLowerCase().includes(query) || item.prompt.toLowerCase().includes(query)) {
                        results.push({ ...item, catKey: key, catTitle: cat.title, catIcon: cat.icon, sectionTitle: section.title });
                    }
                });
            });
        });

        $('#search-query-display').textContent = `"${query}"`;
        $('#search-count').textContent = `${results.length}件のプロンプトが見つかりました`;

        const list = $('#search-prompt-list');
        list.innerHTML = '';
        results.forEach((item, i) => {
            const id = `search-${i}`;
            const promptHtml = highlightBrackets(item.prompt);
            const catColor = { cameraman: 'var(--accent-camera)', designer: 'var(--accent-designer)', lifesupport: 'var(--accent-lifesupport)', agency: 'var(--accent-agency)', coder: 'var(--accent-coder)' }[item.catKey];
            list.innerHTML += `
        <div class="prompt-item" id="pi-${id}">
          <div class="prompt-item__header" onclick="window.APP.toggleItem('pi-${id}')">
            <span class="prompt-item__title"><span class="prompt-item__cat-badge" style="background:${catColor}20;color:${catColor}">${item.catIcon} ${item.catTitle}</span>${item.title}</span>
            <svg class="prompt-item__chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
          </div>
          <div class="prompt-item__body"><div class="prompt-item__content">
            <div class="prompt-item__prompt">
              <button class="copy-btn" onclick="event.stopPropagation();window.APP.copyPrompt(this,'${id}')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>コピー</button>
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
    }

    $('#back-btn').addEventListener('click', goHome);
    $('#search-back-btn').addEventListener('click', () => { globalSearch.value = ''; goHome(); });
    $('#logo-link').addEventListener('click', (e) => { e.preventDefault(); globalSearch.value = ''; goHome(); });

    window.addEventListener('popstate', (e) => {
        if (e.state && e.state.cat) { openCategory(e.state.cat); }
        else { goHome(); }
    });

    // ===== Expose global API =====
    window.APP = { openCategory, toggleItem, copyPrompt };

    // ===== Init =====
    renderCategoryGrid();

    // Handle direct hash navigation
    const hash = window.location.hash.slice(1);
    if (hash && PROMPT_DATA[hash]) { openCategory(hash); }
});
