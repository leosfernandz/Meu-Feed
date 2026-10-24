/* ==========================================================================
   1. BASE OFICIAL DE FEEDS (G1 + GLOBO ESPORTE)
   ========================================================================== */
const DEFAULT_CATEGORIES = {
  politica_br: { 
    name: 'Política Brasileira', 
    icon: '🏛️', 
    url: 'https://g1.globo.com/rss/g1/politica/' 
  },
  politica_int: { 
    name: 'Política Internacional', 
    icon: '🌐', 
    url: 'https://g1.globo.com/rss/g1/mundo/' 
  },
  economia: { 
    name: 'Economia & Negócios', 
    icon: '📈', 
    url: 'https://g1.globo.com/rss/g1/economia/' 
  },
  futebol_br: { 
    name: 'Futebol Brasileiro', 
    icon: '⚽', 
    url: 'https://ge.globo.com/rss/ge/futebol/' 
  },
  inter: { 
    name: 'Sport Club Internacional', 
    icon: '🇦🇹', 
    url: 'https://ge.globo.com/rss/ge/futebol/times/internacional/' 
  },
  lutas: { 
    name: 'UFC & Lutas', 
    icon: '🥊', 
    url: 'https://ge.globo.com/rss/ge/combate/' 
  },
  tecnologia: { 
    name: 'Tecnologia & Inovação', 
    icon: '💻', 
    url: 'https://g1.globo.com/rss/g1/tecnologia/' 
  }
};

let customCategories = JSON.parse(localStorage.getItem('meu_feed_custom_sources')) || {};
let CATEGORIES_DATABASE = { ...DEFAULT_CATEGORIES, ...customCategories };

const PRIMARY_API = 'https://api.rss2json.com/v1/api.json?rss_url=';
const FALLBACK_API = 'https://api.allorigins.win/get?url=';

/* Injeção de categorias padrão */
let userCategories = JSON.parse(localStorage.getItem('meu_feed_categories')) || [];
const defaultKeys = Object.keys(DEFAULT_CATEGORIES);

defaultKeys.forEach(key => {
  if (!userCategories.includes(key)) {
    userCategories.push(key);
  }
});
localStorage.setItem('meu_feed_categories', JSON.stringify(userCategories));

let userKeywords = JSON.parse(localStorage.getItem('meu_feed_keywords')) || [
  'Internacional', 'Inter', 'Colorado', 'UFC', 'economia', 'política'
];

let savedArticles = JSON.parse(localStorage.getItem('meu_feed_saved')) || [];
let readArticles = JSON.parse(localStorage.getItem('meu_feed_read')) || [];
let isOledMode = localStorage.getItem('meu_feed_oled') === 'true';

let loadedSectorsData = {}; 
let recentArticles = [];
let currentView = 'feed';

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

  if (isOledMode) {
    document.body.classList.add('oled-mode');
  }

  if (!localStorage.getItem('meu_feed_installed')) {
    onboardingKeywordsInput.value = userKeywords.join(', ');
    renderCategoryGrid(onboardingCategories, userCategories);
    onboardingScreen.classList.add('active');
  } else {
    loadAllSectors();
  }
});

function renderCategoryGrid(container, selectedKeys) {
  container.innerHTML = '';
  Object.keys(CATEGORIES_DATABASE).forEach(catKey => {
    const cat = CATEGORIES_DATABASE[catKey];
    const isChecked = selectedKeys.includes(catKey) ? 'checked' : '';
    
    const label = document.createElement('label');
    label.className = 'category-checkbox';
    label.innerHTML = `
      <input type="checkbox" value="${catKey}" ${isChecked}>
      ${cat.icon} ${cat.name}
    `;
    container.appendChild(label);
  });
}

/* ==========================================================================
   4. PROCESSAMENTO DOS FEEDS COM FILTRO DE FRESCOR (MÁX 48h)
   ========================================================================== */
async function loadAllSectors() {
  if (currentView === 'saved') {
    document.querySelector('.carousel-section').style.display = 'none';
    renderSavedArticles();
    return;
  }

  document.querySelector('.carousel-section').style.display = 'block';
  sectorsContainer.innerHTML = '<p style="color:var(--text-secondary); grid-column: 1/-1; text-align:center; padding:40px;">Carregando últimas manchetes...</p>';
  
  try {
    // Busca diretamente o feed.json gerado pelo script Python
    const response = await fetch('./feed.json?t=' + Date.now());
    const json = await response.json();

    loadedSectorsData = {};
    recentArticles = [];

    const now = new Date();
    const maxAgeMs = 48 * 60 * 60 * 1000; // Limite estrito de 48 horas

    Object.keys(json.data).forEach(catKey => {
      const items = json.data[catKey] || [];
      const filtered = items.filter(art => {
        const articleId = btoa(unescape(encodeURIComponent(art.link)));
        // Se já leu/ocultou, descarta
        if (readArticles.includes(articleId)) return false;

        if (!art.pubDate) return true;
        const artDate = new Date(art.pubDate);
        return (now - artDate) <= maxAgeMs;
      }).map(art => ({
        ...art,
        id: btoa(unescape(encodeURIComponent(art.link))),
        readTime: calculateReadTime(art.title + ' ' + (art.description || ''))
      }));

      loadedSectorsData[catKey] = filtered;

      filtered.forEach(art => {
        if (!recentArticles.some(a => a.id === art.id)) {
          recentArticles.push(art);
        }
      });
    });

    recentArticles.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

    renderCarousel();
    renderDashboard();

  } catch (err) {
    console.error('Erro ao carregar feed.json:', err);
    sectorsContainer.innerHTML = '<p style="color:var(--text-secondary); grid-column: 1/-1; text-align:center; padding:40px;">Nenhuma notícia encontrada ou aguardando primeira execução do robô.</p>';
  }
}

function extractRealImageUrl(item) {
  if (item.thumbnail && item.thumbnail.startsWith('http')) return item.thumbnail;
  if (item.enclosure && item.enclosure.link && item.enclosure.link.startsWith('http')) return item.enclosure.link;

  const rawHtml = (item.description || '') + (item.content || '');
  const imgMatch = rawHtml.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (imgMatch && imgMatch[1] && imgMatch[1].startsWith('http')) {
    return imgMatch[1];
  }

  return null;
}

/* ==========================================================================
   5. RENDERIZAÇÃO DE TELA (CARROSSEL E PAINEL)
   ========================================================================== */
function renderCarousel() {
  carouselTrack.innerHTML = '';
  const top10 = recentArticles.filter(art => !readArticles.includes(art.id)).slice(0, 10);

  if (top10.length === 0) {
    document.querySelector('.carousel-section').style.display = 'none';
    return;
  }

  top10.forEach(art => {
    const slide = document.createElement('div');
    slide.className = 'carousel-slide';
    slide.setAttribute('data-article-id', art.id);
    
    slide.innerHTML = `
      ${art.imageUrl ? `<img src="${art.imageUrl}" class="carousel-img" alt="Capa" loading="lazy">` : ''}
      <div class="carousel-body">
        <span class="card-vip-tag" style="background:var(--accent-primary);">${art.categoryIcon} ${art.categoryName}</span>
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
  sectorsContainer.innerHTML = '';

  // Setor Destaques & Favoritos
  if (!searchTerm) {
    const vipByKeyword = {};
    userKeywords.forEach(kw => { vipByKeyword[kw.toLowerCase()] = []; });

    Object.keys(loadedSectorsData).forEach(catKey => {
      loadedSectorsData[catKey].forEach(article => {
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
    let added = true;
    let round = 0;
    while (added && round < 10) {
      added = false;
      Object.keys(vipByKeyword).forEach(kLower => {
        if (vipByKeyword[kLower][round]) {
          if (!interleavedVip.some(a => a.id === vipByKeyword[kLower][round].id)) {
            interleavedVip.push(vipByKeyword[kLower][round]);
            added = true;
          }
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

  // Blocos das Categorias Ativas
  let renderedAny = false;
  userCategories.forEach(catKey => {
    const catInfo = CATEGORIES_DATABASE[catKey];
    if (!catInfo) return;

    let articles = (loadedSectorsData[catKey] || []).filter(art => !readArticles.includes(art.id));
    if (searchTerm) {
      articles = articles.filter(a => a.title.toLowerCase().includes(searchTerm.toLowerCase()));
    }

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
      articles.slice(0, 6).forEach(art => container.appendChild(createNewsCard(art, false)));
      sectorsContainer.appendChild(sector);
    }
  });

  if (!renderedAny && !sectorsContainer.querySelector('.vip-sector')) {
    sectorsContainer.innerHTML = '<p style="color:var(--text-secondary); grid-column: 1/-1; text-align:center; padding:40px;">Você já leu todas as notícias mais recentes! Clique em atualizar 🔄 para buscar novas manchetes.</p>';
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
      <div class="card-meta">
        <span>⏱️ ${article.readTime} min</span>
        <span>${formatDate(article.pubDate)}</span>
      </div>
      <div class="card-actions">
        <button class="action-btn btn-read">📖 Leitura</button>
        <button class="action-btn btn-save">${isSaved ? '🔖 Salvo' : '📌 Salvar'}</button>
        <button class="action-btn btn-hide" title="Ocultar notícia lida">👁️ Lido</button>
        <button class="action-btn btn-share">📲 Zap</button>
      </div>
    </div>
  `;

  card.querySelector('.btn-read').addEventListener('click', () => openReaderMode(article));
  card.querySelector('.btn-save').addEventListener('click', (e) => toggleSave(article, e.target));
  card.querySelector('.btn-hide').addEventListener('click', () => markAsRead(article.id));
  card.querySelector('.btn-share').addEventListener('click', () => shareToWhatsApp(article));

  return card;
}

/* MARCAR COMO LIDO E OCULTAR APENAS O CARD ESPECÍFICO SEM RECARREGAR A PÁGINA */
function markAsRead(articleId) {
  if (!readArticles.includes(articleId)) {
    readArticles.push(articleId);
    localStorage.setItem('meu_feed_read', JSON.stringify(readArticles));
  }

  // Remove o card da tela instantaneamente em todos os lugares onde ele aparece (grid e carrossel)
  const cards = document.querySelectorAll(`[data-article-id="${articleId}"]`);
  cards.forEach(card => {
    card.style.transition = 'all 0.3s ease';
    card.style.opacity = '0';
    card.style.transform = 'scale(0.95)';
    setTimeout(() => {
      card.remove();
    }, 300);
  });
}

function shareToWhatsApp(article) {
  const text = `📰 *${article.title}*\n⏱️ Leitura de ${article.readTime} min\n\n🔗 ${article.link}`;
  const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
  window.open(whatsappUrl, '_blank');
}

/* ==========================================================================
   6. CONFIGURAÇÕES, LEITURA LIMPA E UTILITÁRIOS
   ========================================================================== */
function renderReorderSettings() {
  if (!settingsReorderList) return;
  settingsReorderList.innerHTML = '';

  userCategories.forEach((catKey) => {
    const cat = CATEGORIES_DATABASE[catKey];
    if (!cat) return;

    const row = document.createElement('div');
    row.className = 'reorder-row';
    row.innerHTML = `
      <span style="font-weight:600;">${cat.icon} ${cat.name}</span>
      <div class="reorder-actions">
        <button class="reorder-btn btn-up" title="Subir">⬆️</button>
        <button class="reorder-btn btn-down" title="Descer">⬇️</button>
        <button class="reorder-btn btn-delete" title="Excluir Categoria" style="border-color:var(--accent-red); color:var(--accent-red);">🗑️</button>
      </div>
    `;

    row.querySelector('.btn-up').addEventListener('click', () => moveCategory(catKey, -1));
    row.querySelector('.btn-down').addEventListener('click', () => moveCategory(catKey, 1));
    row.querySelector('.btn-delete').addEventListener('click', () => removeCategory(catKey));

    settingsReorderList.appendChild(row);
  });
}

function moveCategory(catKey, direction) {
  const index = userCategories.indexOf(catKey);
  if (index === -1) return;

  const newIndex = index + direction;
  if (newIndex >= 0 && newIndex < userCategories.length) {
    const temp = userCategories[index];
    userCategories[index] = userCategories[newIndex];
    userCategories[newIndex] = temp;
    renderReorderSettings();
  }
}

function removeCategory(catKey) {
  if (userCategories.length <= 1) {
    alert('Você precisa manter pelo menos uma categoria no seu feed.');
    return;
  }

  userCategories = userCategories.filter(key => key !== catKey);
  renderReorderSettings();
}

function handleAddCustomRss() {
  const name = customRssNameInput.value.trim();
  const url = customRssUrlInput.value.trim();

  if (!name || !url) {
    alert('Por favor, preencha o Nome e a URL do RSS.');
    return;
  }

  const customKey = `custom_${Date.now()}`;
  const newCat = { name: name, icon: '🌐', url: url };

  customCategories[customKey] = newCat;
  CATEGORIES_DATABASE[customKey] = newCat;
  localStorage.setItem('meu_feed_custom_sources', JSON.stringify(customCategories));

  userCategories.push(customKey);
  localStorage.setItem('meu_feed_categories', JSON.stringify(userCategories));

  customRssNameInput.value = '';
  customRssUrlInput.value = '';

  renderReorderSettings();
  alert(`Fonte "${name}" adicionada com sucesso!`);
}

function openReaderMode(article) {
  const cleanDesc = (article.description || '').replace(/<[^>]*>?/gm, '');
  const sentences = cleanDesc.split('. ').filter(s => s.trim().length > 10);
  const summaryPoints = sentences.slice(0, 2).map(s => `• ${s.trim()}${s.endsWith('.') ? '' : '.'}`).join('<br>');

  readerBody.innerHTML = `
    ${article.imageUrl ? `<div class="reader-img-container"><img src="${article.imageUrl}" alt="Imagem"></div>` : ''}
    <h2 style="font-size: 1.4rem; margin-bottom: 12px; line-height: 1.35; color: var(--text-primary); font-weight:700;">${article.title}</h2>
    <p style="color: var(--text-secondary); font-size: 0.85rem; margin-bottom: 20px;">
      Publicado em ${formatDate(article.pubDate)} • Tempo de leitura: ${article.readTime} min
    </p>

    <div style="background: rgba(37, 99, 235, 0.1); border-left: 4px solid var(--accent-primary); padding: 14px 18px; border-radius: 8px; margin-bottom: 24px;">
      <strong style="color: var(--accent-hover); display: block; margin-bottom: 6px;">📌 Resumo dos Pontos Principais:</strong>
      <p style="font-size: 0.95rem; line-height: 1.6; color: #e2e8f0; margin: 0;">
        ${summaryPoints || 'Confira a matéria completa no link abaixo.'}
      </p>
    </div>

    <div class="reader-text-body">
      ${article.content || article.description}
    </div>

    <div style="display: flex; gap: 10px; margin-top: 20px;">
      <button id="btn-read-modal-hide" class="primary-btn" style="background: var(--surface-hover); border: 1px solid var(--card-border);">
        👁️ Marcar como Lido e Fechar
      </button>
      <a href="${article.link}" target="_blank" class="primary-btn" style="text-align:center; text-decoration:none;">
        Abrir original ↗
      </a>
    </div>
  `;

  document.getElementById('btn-read-modal-hide').addEventListener('click', () => {
    markAsRead(article.id);
    readerModal.classList.remove('active');
  });

  readerModal.classList.add('active');
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
  localStorage.setItem('meu_feed_saved', JSON.stringify(savedArticles));
}

function renderSavedArticles() {
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
    container.innerHTML = '<p style="color:var(--text-secondary); padding:20px;">Nenhum artigo salvo na sua lista.</p>';
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
  const dateObj = new Date(dateString);
  return dateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function parseKeywords(stringInput) {
  return stringInput.split(',').map(s => s.trim()).filter(s => s.length > 0);
}

/* ==========================================================================
   7. EVENTOS DA INTERFACE
   ========================================================================== */
function setupEventListeners() {
  if (btnToggleOled) {
    btnToggleOled.addEventListener('click', () => {
      isOledMode = !isOledMode;
      document.body.classList.toggle('oled-mode', isOledMode);
      localStorage.setItem('meu_feed_oled', isOledMode ? 'true' : 'false');
    });
  }

  if (btnAddCustomRss) btnAddCustomRss.addEventListener('click', handleAddCustomRss);

  if (brandHomeBtn) {
    brandHomeBtn.addEventListener('click', () => {
      currentView = 'feed';
      if (searchInput) searchInput.value = '';
      loadAllSectors();
    });
  }

  if (btnFinishOnboarding) {
    btnFinishOnboarding.addEventListener('click', () => {
      const checkboxes = onboardingCategories.querySelectorAll('input[type="checkbox"]:checked');
      const selectedCats = Array.from(checkboxes).map(cb => cb.value);

      if (selectedCats.length === 0) return alert('Selecione pelo menos uma categoria.');
      
      userCategories = selectedCats;
      userKeywords = parseKeywords(onboardingKeywordsInput.value);

      localStorage.setItem('meu_feed_categories', JSON.stringify(userCategories));
      localStorage.setItem('meu_feed_keywords', JSON.stringify(userKeywords));
      localStorage.setItem('meu_feed_installed', 'true');

      onboardingScreen.classList.remove('active');
      loadAllSectors();
    });
  }

  if (btnCarouselPrev) btnCarouselPrev.addEventListener('click', () => carouselTrack.scrollBy({ left: -350, behavior: 'smooth' }));
  if (btnCarouselNext) btnCarouselNext.addEventListener('click', () => carouselTrack.scrollBy({ left: 350, behavior: 'smooth' }));

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      if (currentView === 'feed') renderDashboard(e.target.value);
    });
  }

  if (btnRefresh) btnRefresh.addEventListener('click', loadAllSectors);

  const closeMenu = () => {
    sidebar.classList.remove('active');
    sidebarOverlay.classList.remove('active');
  };

  if (btnOpenMenu) {
    btnOpenMenu.addEventListener('click', () => {
      sidebar.classList.add('active');
      sidebarOverlay.classList.add('active');
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
        settingsKeywordsInput.value = userKeywords.join(', ');
        renderReorderSettings();
        settingsModal.classList.add('active');
      } else {
        currentView = view;
        loadAllSectors();
      }
    });
  });

  if (btnSaveSettings) {
    btnSaveSettings.addEventListener('click', () => {
      userKeywords = parseKeywords(settingsKeywordsInput.value);

      localStorage.setItem('meu_feed_categories', JSON.stringify(userCategories));
      localStorage.setItem('meu_feed_keywords', JSON.stringify(userKeywords));

      settingsModal.classList.remove('active');
      currentView = 'feed';
      loadAllSectors();
    });
  }

  if (btnCloseSettings) btnCloseSettings.addEventListener('click', () => settingsModal.classList.remove('active'));
  if (btnCloseReader) btnCloseReader.addEventListener('click', () => readerModal.classList.remove('active'));

  document.querySelectorAll('.overlay-screen').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.classList.remove('active');
      }
    });
  });
}