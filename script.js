/* ==========================================================================
   1. CONFIGURAÇÃO DE PERFIS E BASE DE FEEDS
   ========================================================================== */
const urlParams = new URLSearchParams(window.location.search);
const isMaeProfile = urlParams.get('perfil') === 'mae';
const STORAGE_PREFIX = isMaeProfile ? 'mae_' : '';

const DEFAULT_CATEGORIES = {
  politica_br: { name: 'Política Brasileira', icon: '🏛️', url: 'https://g1.globo.com/rss/g1/politica/' },
  politica_int: { name: 'Política Internacional', icon: '🌐', url: 'https://g1.globo.com/rss/g1/mundo/' },
  economia: { name: 'Economia & Negócios', icon: '📈', url: 'https://g1.globo.com/rss/g1/economia/' },
  futebol_br: { name: 'Futebol Brasileiro', icon: '⚽', url: 'https://ge.globo.com/rss/ge/futebol/' },
  inter: { name: 'Sport Club Internacional', icon: '🇦🇹', url: 'https://ge.globo.com/rss/ge/futebol/times/internacional/' },
  lutas: { name: 'UFC & Lutas', icon: '🥊', url: 'https://ge.globo.com/rss/ge/combate/' },
  tecnologia: { name: 'Tecnologia & Inovação', icon: '💻', url: 'https://g1.globo.com/rss/g1/tecnologia/' }
};

let customCategories = JSON.parse(localStorage.getItem(STORAGE_PREFIX + 'meu_feed_custom_sources')) || {};
let CATEGORIES_DATABASE = { ...DEFAULT_CATEGORIES, ...customCategories };

let userCategories = JSON.parse(localStorage.getItem(STORAGE_PREFIX + 'meu_feed_categories')) || [];
if (userCategories.length === 0) {
  if (isMaeProfile) {
    userCategories = ['politica_br', 'politica_int', 'economia', 'saude'];
  } else {
    Object.keys(DEFAULT_CATEGORIES).forEach(key => {
      if (!userCategories.includes(key)) userCategories.push(key);
    });
  }
  localStorage.setItem(STORAGE_PREFIX + 'meu_feed_categories', JSON.stringify(userCategories));
}

let userKeywords = JSON.parse(localStorage.getItem(STORAGE_PREFIX + 'meu_feed_keywords')) || (isMaeProfile ? ['família', 'saúde', 'economia', 'brasil'] : ['Internacional', 'Inter', 'Colorado', 'UFC', 'economia', 'política']);
let savedArticles = JSON.parse(localStorage.getItem(STORAGE_PREFIX + 'meu_feed_saved')) || [];
let readArticles = JSON.parse(localStorage.getItem(STORAGE_PREFIX + 'meu_feed_read')) || [];
let hiddenKeywords = JSON.parse(localStorage.getItem(STORAGE_PREFIX + 'meu_feed_hidden_keywords')) || [];
let readingHistory = JSON.parse(localStorage.getItem(STORAGE_PREFIX + 'meu_feed_history')) || [];
let isOledMode = localStorage.getItem(STORAGE_PREFIX + 'meu_feed_oled') === 'true';

let loadedSectorsData = {}; 
let recentArticles = [];
let currentView = 'feed';
let activeCategoryFilter = 'all';

/* ==========================================================================
   2. ELEMENTOS DA INTERFACE (DOM)
   ========================================================================== */
const onboardingScreen         = document.getElementById('onboarding-screen');
const onboardingCategories     = document.getElementById('onboarding-categories');
const onboardingKeywordsInput  = document.getElementById('onboarding-keywords');
const btnFinishOnboarding      = document.getElementById('btn-finish-onboarding');

const settingsModal            = document.getElementById('settings-modal');
const settingsReorderList      = document.getElementById('settings-reorder-list');
const settingsKeywordsInput    = document.getElementById('settings-keywords');
const btnSaveSettings          = document.getElementById('btn-save-settings');
const btnCloseSettings         = document.getElementById('btn-close-settings');

const customRssNameInput       = document.getElementById('custom-rss-name');
const customRssUrlInput        = document.getElementById('custom-rss-url');
const btnAddCustomRss          = document.getElementById('btn-add-custom-rss');

const btnToggleOled            = document.getElementById('btn-toggle-oled');
const categoryFilterBar        = document.getElementById('category-filter-bar');

const carouselTrack            = document.getElementById('carousel-track');
const btnCarouselPrev          = document.getElementById('btn-carousel-prev');
const btnCarouselNext          = document.getElementById('btn-carousel-next');

const sectorsContainer         = document.getElementById('sectors-container');
const searchInput              = document.getElementById('search-input');
const btnRefresh               = document.getElementById('btn-refresh');
const brandHomeBtn             = document.getElementById('brand-home-btn');

const sidebar                  = document.getElementById('sidebar');
const sidebarOverlay           = document.getElementById('sidebar-overlay');
const btnOpenMenu              = document.getElementById('btn-open-menu');
const btnCloseSidebar          = document.getElementById('btn-close-sidebar');

const readerModal              = document.getElementById('reader-modal');
const readerBody               = document.getElementById('reader-body');
const btnCloseReader           = document.getElementById('btn-close-reader');

/* ==========================================================================
   3. INICIALIZAÇÃO
   ========================================================================== */
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  if (isOledMode) document.body.classList.add('oled-mode');

  const isInstalled = localStorage.getItem(STORAGE_PREFIX + 'meu_feed_installed');
  if (!isInstalled) {
    if (isMaeProfile) {
      localStorage.setItem(STORAGE_PREFIX + 'meu_feed_installed', 'true');
      loadAllSectors();
    } else {
      if (onboardingKeywordsInput) onboardingKeywordsInput.value = userKeywords.join(', ');
      if (onboardingCategories) renderCategoryGrid(onboardingCategories, userCategories);
      if (onboardingScreen) onboardingScreen.classList.add('active');
    }
  } else {
    loadAllSectors();
  }
});

function renderCategoryGrid(container, selectedKeys) {
  if (!container) return;
  container.innerHTML = '';
  Object.keys(CATEGORIES_DATABASE).forEach(catKey => {
    const cat = CATEGORIES_DATABASE[catKey];
    const isChecked = selectedKeys.includes(catKey) ? 'checked' : '';
    const label = document.createElement('label');
    label.className = 'category-checkbox';
    label.innerHTML = `<input type="checkbox" value="${catKey}" ${isChecked}> ${cat.icon} ${cat.name}`;
    container.appendChild(label);
  });
}

/* ==========================================================================
   4. FUNÇÃO DE LIMPEZA DE TEXTO (LEGENDAS E CRÉDITOS)
   ========================================================================== */
function cleanArticleContent(rawText) {
  if (!rawText) return '';
  return rawText
    .replace(/<figcaption[^>]*>[\s\S]*?<\/figcaption>/gi, '')
    .replace(/(?:Foto|Crédito|Imagem|Fonte)\s*:\s*[^<\n\.\-]+(?:\/[^<\n\.\-]+)?/gi, '')
    .replace(/\b\d{1,2}\/\d{1,2}\/\d{2,4}(?:\s*[-–—]\s*\d{1,2}h\d{0,2})?\b/gi, '')
    .replace(/<p[^>]*>\s*(?:Policiais|Agentes|Equipes|Foto|Legenda)[^<]*?atuam[^<]*?<\/p>/gi, '')
    .replace(/<p[^>]*>\s*<\/p>/gi, '');
}

/* ==========================================================================
   5. PROCESSAMENTO DOS FEEDS (VIA FEED.JSON COM LIMITE EXPANDIDO)
   ========================================================================== */
async function loadAllSectors() {
  if (!sectorsContainer) return;

  if (currentView === 'saved') {
    const carouselSec = document.querySelector('.carousel-section');
    if (carouselSec) carouselSec.style.display = 'none';
    if (categoryFilterBar) categoryFilterBar.style.display = 'none';
    renderSavedArticles();
    return;
  }
  if (currentView === 'stats') {
    const carouselSec = document.querySelector('.carousel-section');
    if (carouselSec) carouselSec.style.display = 'none';
    if (categoryFilterBar) categoryFilterBar.style.display = 'none';
    renderStatsPanel();
    return;
  }

  const carouselSec = document.querySelector('.carousel-section');
  if (carouselSec) carouselSec.style.display = 'block';
  if (categoryFilterBar) categoryFilterBar.style.display = 'flex';

  sectorsContainer.innerHTML = '<p style="color:var(--text-secondary); grid-column: 1/-1; text-align:center; padding:40px;">Carregando últimas manchetes...</p>';
  
  loadedSectorsData = {};
  recentArticles = [];
  const now = new Date();
  const maxAgeMs = 30 * 24 * 60 * 60 * 1000; // 30 dias de validade para evitar itens ocultos

  try {
    const response = await fetch('./feed.json?t=' + Date.now());
    if (!response.ok) throw new Error('feed.json não encontrado');
    const json = await response.json();

    Object.keys(json.data || {}).forEach(catKey => {
      const items = json.data[catKey] || [];
      const catInfo = CATEGORIES_DATABASE[catKey] || { name: 'Portal', icon: '📰' };

      const filtered = items.filter(art => {
        const articleId = btoa(unescape(encodeURIComponent(art.link)));
        if (readArticles.includes(articleId)) return false;
        
        const fullText = (art.title + ' ' + (art.description || '')).toLowerCase();
        if (hiddenKeywords.some(kw => fullText.includes(kw.toLowerCase()))) return false;

        if (!art.pubDate) return true;
        return (now - new Date(art.pubDate)) <= maxAgeMs;
      }).map(art => ({
        ...art,
        id: btoa(unescape(encodeURIComponent(art.link))),
        description: cleanArticleContent(art.description || ''),
        content: cleanArticleContent(art.content || art.description || ''),
        sourceName: catInfo.name, // Nome do portal para exibir no card
        categoryIcon: catInfo.icon,
        readTime: calculateReadTime(art.title + ' ' + (art.description || ''))
      }));

      loadedSectorsData[catKey] = filtered;
      filtered.forEach(art => {
        if (!recentArticles.some(a => a.id === art.id)) recentArticles.push(art);
      });
    });

  } catch (err) {
    console.error('Erro ao carregar feed.json:', err);
    sectorsContainer.innerHTML = '<p style="color:var(--text-secondary); grid-column: 1/-1; text-align:center; padding:40px;">Erro ao carregar o feed de notícias.</p>';
    return;
  }

  recentArticles.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

  renderCategoryFilterBar();
  renderCarousel();
  renderDashboard();
}

/* ==========================================================================
   6. BARRA DE FILTROS (TOPO + MENU LATERAL MOBILE)
   ========================================================================== */
function renderCategoryFilterBar() {
  if (categoryFilterBar) {
    categoryFilterBar.innerHTML = '';

    const allBtn = document.createElement('button');
    allBtn.className = `category-pill ${activeCategoryFilter === 'all' ? 'active' : ''}`;
    allBtn.innerHTML = `🔥 Todas`;
    allBtn.addEventListener('click', () => {
      activeCategoryFilter = 'all';
      renderCategoryFilterBar();
      renderDashboard(searchInput ? searchInput.value : '');
    });
    categoryFilterBar.appendChild(allBtn);

    userCategories.forEach(catKey => {
      const catInfo = CATEGORIES_DATABASE[catKey];
      if (!catInfo) return;

      const btn = document.createElement('button');
      btn.className = `category-pill ${activeCategoryFilter === catKey ? 'active' : ''}`;
      btn.innerHTML = `${catInfo.icon} ${catInfo.name}`;
      btn.addEventListener('click', () => {
        activeCategoryFilter = catKey;
        renderCategoryFilterBar();
        renderDashboard(searchInput ? searchInput.value : '');
      });
      categoryFilterBar.appendChild(btn);
    });
  }

  const sidebarCatContainer = document.getElementById('sidebar-categories-container');
  if (sidebarCatContainer) {
    sidebarCatContainer.innerHTML = '';

    const allSidebarBtn = document.createElement('button');
    allSidebarBtn.className = `sidebar-cat-btn ${activeCategoryFilter === 'all' ? 'active' : ''}`;
    allSidebarBtn.innerHTML = `🔥 Todas as Notícias`;
    allSidebarBtn.addEventListener('click', () => {
      activeCategoryFilter = 'all';
      renderCategoryFilterBar();
      renderDashboard(searchInput ? searchInput.value : '');
      closeSidebarMenu();
    });
    sidebarCatContainer.appendChild(allSidebarBtn);

    userCategories.forEach(catKey => {
      const catInfo = CATEGORIES_DATABASE[catKey];
      if (!catInfo) return;

      const btn = document.createElement('button');
      btn.className = `sidebar-cat-btn ${activeCategoryFilter === catKey ? 'active' : ''}`;
      btn.innerHTML = `${catInfo.icon} ${catInfo.name}`;
      btn.addEventListener('click', () => {
        activeCategoryFilter = catKey;
        renderCategoryFilterBar();
        renderDashboard(searchInput ? searchInput.value : '');
        closeSidebarMenu();
      });
      sidebarCatContainer.appendChild(btn);
    });
  }
}

function closeSidebarMenu() {
  sidebar?.classList.remove('active');
  sidebarOverlay?.classList.remove('active');
} 

/* ==========================================================================
   7. RENDERIZAÇÃO DE TELA (CARROSSEL E PAINEL)
   ========================================================================== */
function renderCarousel() {
  if (!carouselTrack) return;
  carouselTrack.innerHTML = '';
  const top10 = recentArticles.filter(art => !readArticles.includes(art.id)).slice(0, 10);

  const carouselSec = document.querySelector('.carousel-section');
  if (top10.length === 0) {
    if (carouselSec) carouselSec.style.display = 'none';
    return;
  }
  if (carouselSec) carouselSec.style.display = 'block';

  top10.forEach(art => {
    const slide = document.createElement('div');
    slide.className = 'carousel-slide';
    slide.setAttribute('data-article-id', art.id);
    
    slide.innerHTML = `
      ${art.imageUrl ? `<img src="${art.imageUrl}" class="carousel-img" alt="Capa" loading="lazy">` : ''}
      <div class="carousel-body">
        <span class="card-vip-tag" style="background:var(--accent-primary);">${art.categoryIcon || '📰'} ${art.sourceName || 'Notícia'}</span>
        <a href="${art.link}" target="_blank" class="carousel-title">${art.title}</a>
        <div class="card-meta">
          <span>⏱️ ${art.readTime} min</span>
          <span>${formatDate(art.pubDate)}</span>
        </div>
      </div>
    `;

    slide.querySelector('.carousel-title').addEventListener('click', (e) => {
      e.preventDefault();
      openReaderMode(art);
    });

    carouselTrack.appendChild(slide);
  });
}

async function renderDashboard(searchTerm = '') {
  if (!sectorsContainer) return;
  sectorsContainer.innerHTML = '';
  const filterByCat = activeCategoryFilter !== 'all' ? activeCategoryFilter : null;

  const carouselSec = document.querySelector('.carousel-section');
  if (filterByCat) {
    if (carouselSec) carouselSec.style.display = 'none';
  } else {
    if (carouselSec) carouselSec.style.display = 'block';

    if (!searchTerm) {
      const vipByKeyword = {};
      userKeywords.forEach(kw => { vipByKeyword[kw.toLowerCase()] = []; });

      Object.keys(loadedSectorsData).forEach(catKey => {
        (loadedSectorsData[catKey] || []).forEach(article => {
          if (readArticles.includes(article.id)) return;
          userKeywords.forEach(kw => {
            const kLower = kw.toLowerCase();
            if (article.title.toLowerCase().includes(kLower) || article.description.toLowerCase().includes(kLower)) {
              vipByKeyword[kLower].push(article);
            }
          });
        });
      });

      const interleavedVip = [];
      let added = true, round = 0;
      while (added && round < 10) {
        added = false;
        Object.keys(vipByKeyword).forEach(kLower => {
          if (vipByKeyword[kLower][round] && !interleavedVip.some(a => a.id === vipByKeyword[kLower][round].id)) {
            interleavedVip.push(vipByKeyword[kLower][round]);
            added = true;
          }
        });
        round++;
      }

      if (interleavedVip.length > 0) {
        const vipSector = document.createElement('section');
        vipSector.className = 'sector-block vip-sector';
        vipSector.innerHTML = `
          <div class="sector-header">
            <h3 class="sector-title">⭐ Destaques & Favoritos</h3>
            <span class="sector-badge">${interleavedVip.length} matérias recentes</span>
          </div>
          <div class="sector-cards" id="vip-cards-container"></div>
        `;
        const container = vipSector.querySelector('#vip-cards-container');
        interleavedVip.slice(0, 9).forEach(art => container.appendChild(createNewsCard(art, true)));
        sectorsContainer.appendChild(vipSector);
      }
    }
  }

  let renderedAny = false;
  userCategories.forEach(catKey => {
    if (filterByCat && filterByCat !== catKey) return;

    const catInfo = CATEGORIES_DATABASE[catKey];
    if (!catInfo) return;

    let articles = (loadedSectorsData[catKey] || []).filter(art => !readArticles.includes(art.id));
    if (searchTerm) articles = articles.filter(a => a.title.toLowerCase().includes(searchTerm.toLowerCase()) || a.description.toLowerCase().includes(searchTerm.toLowerCase()));

    if (articles.length > 0) {
      renderedAny = true;
      const sector = document.createElement('section');
      sector.className = 'sector-block';
      sector.innerHTML = `
        <div class="sector-header">
          <h3 class="sector-title">${catInfo.icon} ${catInfo.name}</h3>
          <span class="sector-badge">${articles.length} notícias</span>
        </div>
        <div class="sector-cards" id="cards-${catKey}"></div>
      `;

      const container = sector.querySelector(`#cards-${catKey}`);
      articles.slice(0, filterByCat ? 50 : 6).forEach(art => container.appendChild(createNewsCard(art, false)));
      sectorsContainer.appendChild(sector);
    }
  });

  if (!renderedAny && !sectorsContainer.querySelector('.vip-sector')) {
    sectorsContainer.innerHTML = '<p style="color:var(--text-secondary); grid-column: 1/-1; text-align:center; padding:40px;">Nenhuma notícia encontrada com estes filtros.</p>';
  }
}

function createNewsCard(article, isVip) {
  const isSaved = savedArticles.some(a => a.id === article.id);
  const card = document.createElement('article');
  card.className = 'news-card';
  card.setAttribute('data-article-id', article.id);

  card.innerHTML = `
    ${article.imageUrl ? `<img src="${article.imageUrl}" class="card-img" alt="Capa" loading="lazy">` : ''}
    <div class="card-body">
      ${isVip ? `<span class="card-vip-tag">🔴 Destaque</span>` : ''}
      <a href="${article.link}" target="_blank" class="card-title">${article.title}</a>
      <div class="card-footer" style="display: flex; justify-content: space-between; align-items: center; margin-top: 10px;">
        <span class="card-source" style="font-size: 0.75rem; color: var(--accent-hover); font-weight: 600;">📰 ${article.sourceName}</span>
        <span class="card-time" style="font-size: 0.75rem; color: var(--text-secondary);">⏱️ ${article.readTime} min</span>
      </div>
      <div class="card-actions" style="margin-top: 10px;">
        <button class="action-btn btn-read">📖 Leitura</button>
        <button class="action-btn btn-save">${isSaved ? '🔖 Salvo' : '📌 Salvar'}</button>
        <button class="action-btn btn-like" title="Mais disso">👍🏻</button>
        <button class="action-btn btn-dislike" title="Não sugerir">👎🏻</button>
        <button class="action-btn btn-hide" title="Ocultar notícia lida">👁️ Lido</button>
        <button class="action-btn btn-share" title="Partilhar no WhatsApp">📲</button>
      </div>
    </div>
  `;

  card.querySelector('.btn-read').addEventListener('click', () => openReaderMode(article));
  card.querySelector('.btn-save').addEventListener('click', (e) => toggleSave(article, e.target));
  card.querySelector('.btn-like').addEventListener('click', () => feedbackLike(article));
  card.querySelector('.btn-dislike').addEventListener('click', () => feedbackDislike(article));
  card.querySelector('.btn-hide').addEventListener('click', () => markAsRead(article.id));
  card.querySelector('.btn-share').addEventListener('click', () => shareToWhatsApp(article));

  return card;
}

/* ==========================================================================
   8. FEEDBACK E HÁBITOS
   ========================================================================== */
function feedbackLike(article) {
  const words = article.title.split(' ').filter(w => w.length > 4);
  if (words.length > 0 && !userKeywords.includes(words[0])) {
    userKeywords.push(words[0]);
    localStorage.setItem(STORAGE_PREFIX + 'meu_feed_keywords', JSON.stringify(userKeywords));
  }
  alert('👍🏻 Feedback registado!');
  loadAllSectors();
}

function feedbackDislike(article) {
  const snippet = article.title.split(' ').slice(0, 3).join(' ');
  if (!hiddenKeywords.includes(snippet)) {
    hiddenKeywords.push(snippet);
    localStorage.setItem(STORAGE_PREFIX + 'meu_feed_hidden_keywords', JSON.stringify(hiddenKeywords));
  }
  markAsRead(article.id);
  alert('👎🏻 Conteúdo semelhante ocultado.');
}

function markAsRead(articleId) {
  if (!readArticles.includes(articleId)) {
    readArticles.push(articleId);
    localStorage.setItem(STORAGE_PREFIX + 'meu_feed_read', JSON.stringify(readArticles));
  }
  const cards = document.querySelectorAll(`[data-article-id="${articleId}"]`);
  cards.forEach(card => {
    card.style.transition = 'all 0.3s ease';
    card.style.opacity = '0';
    setTimeout(() => card.remove(), 300);
  });
}

function recordReadingHabit(article) {
  readingHistory.unshift({
    title: article.title,
    date: new Date().toISOString(),
    readTime: article.readTime
  });
  if (readingHistory.length > 50) readingHistory.pop();
  localStorage.setItem(STORAGE_PREFIX + 'meu_feed_history', JSON.stringify(readingHistory));
}

function renderStatsPanel() {
  if (!sectorsContainer) return;
  sectorsContainer.innerHTML = '';
  const sector = document.createElement('section');
  sector.className = 'sector-block';
  sector.style.gridColumn = '1 / -1';
  
  sector.innerHTML = `
    <div class="sector-header">
      <h3 class="sector-title">📊 Painel de Hábitos e Estatísticas</h3>
      <span class="sector-badge">Seu consumo</span>
    </div>
    <div style="padding: 20px; color: var(--text-primary);">
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 24px;">
        <div style="background: var(--card-bg); border: 1px solid var(--card-border); padding: 20px; border-radius: 12px; text-align: center;">
          <h4 style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 8px;">Artigos Lidos</h4>
          <span style="font-size: 2rem; font-weight: 700; color: var(--accent-primary);">${readArticles.length}</span>
        </div>
        <div style="background: var(--card-bg); border: 1px solid var(--card-border); padding: 20px; border-radius: 12px; text-align: center;">
          <h4 style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 8px;">Itens Salvos</h4>
          <span style="font-size: 2rem; font-weight: 700; color: var(--accent-primary);">${savedArticles.length}</span>
        </div>
      </div>
      <h4 style="margin-bottom: 12px; font-size: 1.1rem;">📝 Histórico Recente de Leitura</h4>
      <div style="background: var(--card-bg); border: 1px solid var(--card-border); border-radius: 12px; padding: 15px;">
        ${readingHistory.length === 0 ? '<p style="color: var(--text-secondary); text-align: center; padding: 10px;">Ainda não abriu nenhuma matéria no modo de leitura limpa.</p>' : 
          readingHistory.map(h => `<div style="padding: 10px 0; border-bottom: 1px solid var(--card-border); font-size: 0.9rem;"><strong>${h.title}</strong><br><span style="color: var(--text-secondary); font-size: 0.75rem;">⏱️ ${h.readTime} min • ${formatDate(h.date)}</span></div>`).join('')}
      </div>
    </div>
  `;
  sectorsContainer.appendChild(sector);
}

function shareToWhatsApp(article) {
  const text = `📰 *${article.title}*\n⏱️ Leitura de ${article.readTime} min\n\n🔗 ${article.link}`;
  window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
}

/* ==========================================================================
   9. LEITURA LIMPA (READER VIEW)
   ========================================================================== */
function openReaderMode(article) {
  recordReadingHabit(article);

  const cleanDesc = (article.description || '').replace(/<[^>]*>?/gm, '');
  const sentences = cleanDesc.split('. ').filter(s => s.trim().length > 10);
  const summaryPoints = sentences.slice(0, 2).map(s => `• ${s.trim()}${s.endsWith('.') ? '' : '.'}`).join('<br>');

  let rawContent = cleanArticleContent(article.content || article.description || '');
  if (!rawContent.includes('<p>') && !rawContent.includes('<br>')) {
    const paragraphs = rawContent.split('. ').filter(p => p.trim().length > 0);
    rawContent = paragraphs.map(p => `<p style="margin-bottom: 16px; line-height: 1.7; color: var(--text-primary);">${p.trim()}${p.endsWith('.') ? '' : '.'}</p>`).join('');
  } else {
    rawContent = rawContent.replace(/<p>/g, '<p style="margin-bottom: 16px; line-height: 1.7; color: var(--text-primary);">');
  }

  if (readerBody) {
    readerBody.innerHTML = `
      ${article.imageUrl ? `<div class="reader-img-container"><img src="${article.imageUrl}" alt="Imagem" style="width:100%; border-radius:12px; margin-bottom:16px; object-fit:cover; max-height:350px;"></div>` : ''}
      <h2 style="font-size: 1.4rem; margin-bottom: 12px; line-height: 1.35; color: var(--text-primary); font-weight:700;">${article.title}</h2>
      <p style="color: var(--text-secondary); font-size: 0.85rem; margin-bottom: 20px;">
        Fonte: <strong>${article.sourceName}</strong> • Publicado em ${formatDate(article.pubDate)} • Tempo de leitura: ${article.readTime} min
      </p>

      <div style="background: rgba(37, 99, 235, 0.1); border-left: 4px solid var(--accent-primary); padding: 14px 18px; border-radius: 8px; margin-bottom: 24px;">
        <strong style="color: var(--accent-hover); display: block; margin-bottom: 6px;">📌 Resumo dos Pontos Principais:</strong>
        <p style="font-size: 0.95rem; line-height: 1.6; color: #e2e8f0; margin: 0;">
          ${summaryPoints || 'Confira a matéria completa no link abaixo.'}
        </p>
      </div>

      <div class="reader-text-body" style="font-size: 1.05rem;">
        ${rawContent}
      </div>

      <div style="display: flex; gap: 10px; margin-top: 24px;">
        <button id="btn-read-modal-hide" class="primary-btn" style="background: var(--surface-hover); border: 1px solid var(--card-border);">
          👁️ Marcar como Lido e Fechar
        </button>
        <a href="${article.link}" target="_blank" class="primary-btn" style="text-align:center; text-decoration:none;">
          Abrir original ↗
        </a>
      </div>
    `;

    document.getElementById('btn-read-modal-hide')?.addEventListener('click', () => {
      markAsRead(article.id);
      readerModal?.classList.remove('active');
    });
  }

  readerModal?.classList.add('active');
}

function toggleSave(article, buttonElement) {
  const index = savedArticles.findIndex(a => a.id === article.id);
  if (index > -1) {
    savedArticles.splice(index, 1);
    buttonElement.innerText = '📌 Salvar';
  } else {
    savedArticles.push(article);
    buttonElement.innerText = '🔖 Salvo';
  }
  localStorage.setItem(STORAGE_PREFIX + 'meu_feed_saved', JSON.stringify(savedArticles));
}

function renderSavedArticles() {
  if (!sectorsContainer) return;
  sectorsContainer.innerHTML = '';
  const sector = document.createElement('section');
  sector.className = 'sector-block';
  sector.style.gridColumn = '1 / -1';
  sector.innerHTML = `
    <div class="sector-header">
      <h3 class="sector-title">🔖 Salvos para Leitura</h3>
      <span class="sector-badge">${savedArticles.length} itens</span>
    </div>
    <div class="sector-cards" id="saved-cards-container"></div>
  `;
  const container = sector.querySelector('#saved-cards-container');
  if (savedArticles.length === 0) {
    container.innerHTML = '<p style="color:var(--text-secondary); padding:20px;">Nenhum artigo salvo.</p>';
  } else {
    savedArticles.forEach(art => container.appendChild(createNewsCard(art, false)));
  }
  sectorsContainer.appendChild(sector);
}

function calculateReadTime(text) {
  const cleanText = text.replace(/<[^>]*>?/gm, '');
  const wordCount = cleanText.trim().split(/\s+/).length;
  return Math.max(1, Math.ceil(wordCount / 200));
}

function formatDate(dateString) {
  if (!dateString) return 'Recente';
  return new Date(dateString).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function parseKeywords(stringInput) {
  return stringInput.split(',').map(s => s.trim()).filter(s => s.length > 0);
}

/* ==========================================================================
   10. EVENTOS DA INTERFACE
   ========================================================================== */
function setupEventListeners() {
  if (btnToggleOled) {
    btnToggleOled.addEventListener('click', () => {
      isOledMode = !isOledMode;
      document.body.classList.toggle('oled-mode', isOledMode);
      localStorage.setItem(STORAGE_PREFIX + 'meu_feed_oled', isOledMode ? 'true' : 'false');
    });
  }

  if (btnAddCustomRss) btnAddCustomRss.addEventListener('click', () => {
    const name = customRssNameInput?.value.trim();
    const url = customRssUrlInput?.value.trim();
    if (!name || !url) return alert('Preencha Nome e URL.');
    const customKey = `custom_${Date.now()}`;
    const newCat = { name: name, icon: '🌐', url: url };
    customCategories[customKey] = newCat;
    CATEGORIES_DATABASE[customKey] = newCat;
    localStorage.setItem(STORAGE_PREFIX + 'meu_feed_custom_sources', JSON.stringify(customCategories));
    userCategories.push(customKey);
    localStorage.setItem(STORAGE_PREFIX + 'meu_feed_categories', JSON.stringify(userCategories));
    if (customRssNameInput) customRssNameInput.value = '';
    if (customRssUrlInput) customRssUrlInput.value = '';
    renderReorderSettings();
    alert(`Fonte "${name}" adicionada!`);
  });

  if (brandHomeBtn) {
    brandHomeBtn.addEventListener('click', () => {
      currentView = 'feed';
      activeCategoryFilter = 'all';
      if (searchInput) searchInput.value = '';
      loadAllSectors();
    });
  }

  if (btnFinishOnboarding) {
    btnFinishOnboarding.addEventListener('click', () => {
      const selectedCats = Array.from(onboardingCategories?.querySelectorAll('input[type="checkbox"]:checked') || []).map(cb => cb.value);
      if (selectedCats.length === 0) return alert('Selecione pelo menos uma categoria.');
      userCategories = selectedCats;
      userKeywords = parseKeywords(onboardingKeywordsInput?.value || '');
      localStorage.setItem(STORAGE_PREFIX + 'meu_feed_categories', JSON.stringify(userCategories));
      localStorage.setItem(STORAGE_PREFIX + 'meu_feed_keywords', JSON.stringify(userKeywords));
      localStorage.setItem(STORAGE_PREFIX + 'meu_feed_installed', 'true');
      onboardingScreen?.classList.remove('active');
      loadAllSectors();
    });
  }

  if (btnCarouselPrev && carouselTrack) btnCarouselPrev.addEventListener('click', () => carouselTrack.scrollBy({ left: -350, behavior: 'smooth' }));
  if (btnCarouselNext && carouselTrack) btnCarouselNext.addEventListener('click', () => carouselTrack.scrollBy({ left: 350, behavior: 'smooth' }));

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      if (currentView === 'feed') renderDashboard(e.target.value);
    });
  }

  if (btnRefresh) btnRefresh.addEventListener('click', loadAllSectors);

  const closeMenu = () => {
    sidebar?.classList.remove('active');
    sidebarOverlay?.classList.remove('active');
  };

  if (btnOpenMenu) {
    btnOpenMenu.addEventListener('click', () => {
      sidebar?.classList.add('active');
      sidebarOverlay?.classList.add('active');
    });
  }

  if (btnCloseSidebar) btnCloseSidebar.addEventListener('click', closeMenu);
  if (sidebarOverlay) sidebarOverlay.addEventListener('click', closeMenu);

  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
      const target = e.currentTarget;
      target.classList.add('active');
      const view = target.getAttribute('data-view');
      closeMenu();

      if (view === 'settings') {
        if (settingsKeywordsInput) settingsKeywordsInput.value = userKeywords.join(', ');
        renderReorderSettings();
        settingsModal?.classList.add('active');
      } else {
        currentView = view;
        activeCategoryFilter = 'all';
        loadAllSectors();
      }
    });
  });

  if (btnSaveSettings) {
    btnSaveSettings.addEventListener('click', () => {
      userKeywords = parseKeywords(settingsKeywordsInput?.value || '');
      localStorage.setItem(STORAGE_PREFIX + 'meu_feed_categories', JSON.stringify(userCategories));
      localStorage.setItem(STORAGE_PREFIX + 'meu_feed_keywords', JSON.stringify(userKeywords));
      settingsModal?.classList.remove('active');
      currentView = 'feed';
      loadAllSectors();
    });
  }

  if (btnCloseSettings) btnCloseSettings.addEventListener('click', () => settingsModal?.classList.remove('active'));
  if (btnCloseReader) btnCloseReader.addEventListener('click', () => readerModal?.classList.remove('active'));

  document.querySelectorAll('.overlay-screen').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.classList.remove('active');
    });
  });
}

function renderReorderSettings() {
  if (!settingsReorderList) return;
  settingsReorderList.innerHTML = '';
  userCategories.forEach(catKey => {
    const cat = CATEGORIES_DATABASE[catKey];
    if (!cat) return;
    const row = document.createElement('div');
    row.className = 'reorder-row';
    row.innerHTML = `
      <span style="font-weight:600;">${cat.icon} ${cat.name}</span>
      <div class="reorder-actions">
        <button class="reorder-btn btn-up" title="Subir">⬆️</button>
        <button class="reorder-btn btn-down" title="Descer">⬇️</button>
        <button class="reorder-btn btn-delete" title="Excluir" style="border-color:var(--accent-red); color:var(--accent-red);">🗑️</button>
      </div>
    `;
    row.querySelector('.btn-up').addEventListener('click', () => {
      const idx = userCategories.indexOf(catKey);
      if (idx > 0) {
        [userCategories[idx], userCategories[idx-1]] = [userCategories[idx-1], userCategories[idx]];
        renderReorderSettings();
      }
    });
    row.querySelector('.btn-down').addEventListener('click', () => {
      const idx = userCategories.indexOf(catKey);
      if (idx < userCategories.length - 1) {
        [userCategories[idx], userCategories[idx+1]] = [userCategories[idx+1], userCategories[idx]];
        renderReorderSettings();
      }
    });
    row.querySelector('.btn-delete').addEventListener('click', () => {
      if (userCategories.length <= 1) return alert('Mantenha pelo menos uma categoria.');
      userCategories = userCategories.filter(k => k !== catKey);
      renderReorderSettings();
    });
    settingsReorderList.appendChild(row);
  });
}