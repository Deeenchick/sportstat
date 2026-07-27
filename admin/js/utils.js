// ============================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ (УЛУЧШЕННЫЕ)
// ============================================================

// --- КОНФИГУРАЦИЯ ---
const API_CONFIG = {
    timeout: 30000, // 30 секунд
    retries: 3,
    retryDelay: 1000,
    cacheTTL: 300000 // 5 минут
};

// --- КЭШ ---
const cache = new Map();

// --- ЗАПРОС К SUPABASE (УЛУЧШЕННЫЙ) ---
async function supabaseRequest(endpoint, method = 'GET', data = null, options = {}) {
    const {
        retries = API_CONFIG.retries,
        timeout = API_CONFIG.timeout,
        useCache = method === 'GET',
        cacheKey = null,
        showLoading = true
    } = options;

    // Проверяем кэш для GET запросов
    const cacheKeyFinal = cacheKey || `${method}:${endpoint}:${JSON.stringify(data)}`;
    if (useCache && method === 'GET') {
        const cached = getFromCache(cacheKeyFinal);
        if (cached) {
            console.log(`📦 Использую кэш для: ${endpoint}`);
            return cached;
        }
    }

    // Проверяем интернет-соединение
    if (!navigator.onLine) {
        throw new Error('📡 Нет интернет-соединения. Проверьте сеть.');
    }

    let lastError = null;
    
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            console.log(`🔄 Запрос ${attempt}/${retries}: ${method} ${endpoint}`);
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeout);

            const headers = {
                'apikey': CONFIG.SUPABASE_KEY,
                'Authorization': 'Bearer ' + CONFIG.SUPABASE_KEY,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            };

            const fetchOptions = {
                method,
                headers,
                signal: controller.signal
            };

            if (data) {
                fetchOptions.body = JSON.stringify(data);
                console.log(`📤 Данные запроса:`, data);
            }

            const startTime = Date.now();
            const resp = await fetch(CONFIG.SUPABASE_URL + endpoint, fetchOptions);
            clearTimeout(timeoutId);
            const duration = Date.now() - startTime;

            console.log(`⏱️ Запрос выполнен за ${duration}ms`);

            // Проверяем статус ответа
            if (!resp.ok) {
                let errorMessage = `HTTP ${resp.status}`;
                try {
                    const errorData = await resp.json();
                    if (errorData.message) {
                        errorMessage = errorData.message;
                    }
                } catch (e) {
                    // Игнорируем
                }
                throw new Error(errorMessage);
            }

            const result = await resp.json();
            
            // Сохраняем в кэш для GET запросов
            if (useCache && method === 'GET') {
                setCache(cacheKeyFinal, result);
            }

            console.log(`✅ Успешный ответ от ${endpoint}:`, result);
            return result;

        } catch (error) {
            lastError = error;
            console.warn(`⚠️ Попытка ${attempt}/${retries} не удалась:`, error.message);
            
            // Если это отмена запроса (AbortError) - не повторяем
            if (error.name === 'AbortError') {
                throw new Error('⏱️ Превышено время ожидания ответа от сервера');
            }

            // Если не последняя попытка - ждем и повторяем
            if (attempt < retries) {
                const delay = API_CONFIG.retryDelay * attempt;
                console.log(`⏳ Повтор через ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    // Все попытки неудачны
    console.error('❌ Все попытки запроса не удались:', lastError);
    throw new Error(`Не удалось выполнить запрос: ${lastError?.message || 'Неизвестная ошибка'}`);
}

// --- ФУНКЦИИ КЭШИРОВАНИЯ ---
function getFromCache(key) {
    const cached = cache.get(key);
    if (!cached) return null;
    
    const now = Date.now();
    if (now - cached.timestamp > API_CONFIG.cacheTTL) {
        cache.delete(key);
        return null;
    }
    
    return cached.data;
}

function setCache(key, data) {
    cache.set(key, {
        data: data,
        timestamp: Date.now()
    });
}

function clearCache() {
    cache.clear();
    console.log('🧹 Кэш очищен');
}

function invalidateCacheForEndpoint(endpoint) {
    // Удаляем все записи, содержащие endpoint
    for (const [key, value] of cache) {
        if (key.includes(endpoint)) {
            cache.delete(key);
        }
    }
    console.log(`🧹 Кэш для ${endpoint} очищен`);
}

// --- УСТАНОВКА СТАТУСА (УЛУЧШЕННАЯ) ---
function setStatus(id, msg, type = 'loading') {
    const el = document.getElementById(id);
    if (el) {
        el.textContent = msg;
        el.className = 'status ' + type;
        
        // Добавляем иконки для разных типов
        const icons = {
            'loading': '⏳',
            'success': '✅',
            'error': '❌',
            'warning': '⚠️',
            'info': 'ℹ️'
        };
        
        if (icons[type] && !msg.startsWith(icons[type])) {
            el.textContent = icons[type] + ' ' + msg;
        }
    }
}

// --- ПОКАЗ УВЕДОМЛЕНИЯ ---
function showNotification(message, type = 'info', duration = 3000) {
    // Удаляем старые уведомления
    const oldNotifications = document.querySelectorAll('.notification-toast');
    oldNotifications.forEach(n => n.remove());
    
    const colors = {
        'success': '#22c55e',
        'error': '#ef4444',
        'warning': '#f59e0b',
        'info': '#3b82f6'
    };
    
    const notification = document.createElement('div');
    notification.className = 'notification-toast';
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${colors[type] || '#3b82f6'};
        color: white;
        padding: 12px 20px;
        border-radius: 10px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        max-width: 400px;
        font-weight: 500;
        animation: slideIn 0.3s ease;
        cursor: pointer;
    `;
    notification.textContent = message;
    
    // Добавляем стиль анимации
    if (!document.getElementById('notification-styles')) {
        const style = document.createElement('style');
        style.id = 'notification-styles';
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes slideOut {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(100%); opacity: 0; }
            }
        `;
        document.head.appendChild(style);
    }
    
    document.body.appendChild(notification);
    
    // Клик для закрытия
    notification.addEventListener('click', () => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    });
    
    // Авто-закрытие
    if (duration > 0) {
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.animation = 'slideOut 0.3s ease';
                setTimeout(() => notification.remove(), 300);
            }
        }, duration);
    }
}

// --- ЗАГРУЗКА ТУРНИРОВ ДЛЯ SELECT (УЛУЧШЕННАЯ) ---
async function loadTournamentsForSelect(selectId, preserveValue = true) {
    const select = document.getElementById(selectId);
    if (!select) {
        console.error(`❌ Select ${selectId} не найден`);
        return;
    }
    
    const currentVal = preserveValue ? select.value : '';
    
    try {
        select.disabled = true;
        select.innerHTML = '<option value="">⏳ Загрузка...</option>';
        
        const data = await supabaseRequest('/rest/v1/tournaments?select=id,title,status&order=created_at.desc');
        
        if (!data || data.length === 0) {
            select.innerHTML = '<option value="">Нет турниров</option>';
            return;
        }
        
        select.innerHTML = '<option value="">Выберите турнир...</option>' +
            data.map(t => `<option value="${t.id}">${t.title || 'Турнир'} (${t.status})</option>`).join('');
        
        if (currentVal && data.some(t => t.id === currentVal)) {
            select.value = currentVal;
        }
        
        console.log(`✅ Загружено ${data.length} турниров для ${selectId}`);
        
    } catch (e) {
        console.error(`❌ Ошибка загрузки турниров для ${selectId}:`, e);
        select.innerHTML = '<option value="">❌ Ошибка загрузки</option>';
        if (typeof showNotification === 'function') {
            showNotification('Не удалось загрузить турниры', 'error');
        }
    } finally {
        select.disabled = false;
    }
}

// --- ПЕРЕКЛЮЧЕНИЕ СТРАНИЦ (УЛУЧШЕННОЕ) ---
const pageLoadStatus = {};

async function showPage(page) {
    console.log(`📄 Переход на страницу: ${page}`);
    
    // Переключаем видимость страниц
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const pageEl = document.getElementById('page-' + page);
    if (pageEl) {
        pageEl.classList.add('active');
    }
    
    // Обновляем навигацию
    document.querySelectorAll('.nav-links button').forEach(b => b.classList.remove('active'));
    const navBtn = document.querySelector(`.nav-links button[data-page="${page}"]`);
    if (navBtn) {
        navBtn.classList.add('active');
    }
    
    // Загружаем данные для страницы (только если не загружены или принудительно)
    const forceReload = pageLoadStatus[page] === undefined || 
                        (page === 'teams' || page === 'matches');
    
    try {
        switch(page) {
            case 'players':
                if (forceReload || !pageLoadStatus.players) {
                    await loadPlayers();
                    pageLoadStatus.players = true;
                }
                break;
                
            case 'tournaments':
                if (forceReload || !pageLoadStatus.tournaments) {
                    await loadTournaments();
                    pageLoadStatus.tournaments = true;
                }
                break;
                
            case 'teams':
                await Promise.all([
                    loadTournamentsForSelect('teamsTournamentSelect'),
                    loadTeams()
                ]);
                pageLoadStatus.teams = true;
                break;
                
            case 'matches':
                await loadTournamentsForSelect('matchTournamentSelect');
                await loadMatches();
                pageLoadStatus.matches = true;
                break;
        }
    } catch (e) {
        console.error(`❌ Ошибка загрузки страницы ${page}:`, e);
        showNotification(`Ошибка загрузки: ${e.message}`, 'error');
    }
}

// --- ОБНОВЛЕНИЕ ВСЕХ ДАННЫХ ---
async function refreshAll() {
    console.log('🔄 Обновление всех данных...');
    
    clearCache();
    pageLoadStatus.teams = false;
    pageLoadStatus.matches = false;
    pageLoadStatus.players = false;
    pageLoadStatus.tournaments = false;
    
    const currentPage = document.querySelector('.page.active');
    if (currentPage) {
        const pageId = currentPage.id.replace('page-', '');
        await showPage(pageId);
    }
    
    showNotification('✅ Все данные обновлены', 'success');
}

// --- ПРОВЕРКА ИНТЕРНЕТ СОЕДИНЕНИЯ ---
function checkConnection() {
    if (!navigator.onLine) {
        showNotification('📡 Нет интернет-соединения', 'error', 0);
        return false;
    }
    return true;
}

// --- ЭКРАНИРОВАНИЕ HTML ---
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// --- ФОРМАТИРОВАНИЕ ДАТЫ ---
function formatDate(dateStr, locale = 'ru-RU') {
    if (!dateStr) return '';
    try {
        const date = new Date(dateStr);
        return date.toLocaleDateString(locale, {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    } catch (e) {
        return dateStr;
    }
}

// --- ОБРАБОТЧИК ГЛОБАЛЬНЫХ ОШИБОК ---
window.addEventListener('error', (event) => {
    console.error('❌ Глобальная ошибка:', event.error || event.message);
    if (event.error && event.error.message) {
        showNotification(`Ошибка: ${event.error.message}`, 'error');
    }
});

// --- ОБРАБОТЧИК НЕПЕРЕХВАЧЕННЫХ ПРОМИСОВ ---
window.addEventListener('unhandledrejection', (event) => {
    console.error('❌ Неперехваченная ошибка Promise:', event.reason);
    if (event.reason && event.reason.message) {
        showNotification(`Ошибка: ${event.reason.message}`, 'error');
    }
});

// --- СЛУШАТЕЛЬ ОНЛАЙН/ОФФЛАЙН ---
window.addEventListener('online', () => {
    showNotification('📡 Интернет соединение восстановлено', 'success');
    refreshAll();
});

window.addEventListener('offline', () => {
    showNotification('📡 Интернет соединение потеряно', 'error', 0);
});

// --- ПЕРИОДИЧЕСКОЕ ОБНОВЛЕНИЕ ---
let autoRefreshInterval = null;

function startAutoRefresh(interval = 300000) { // 5 минут
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
    }
    autoRefreshInterval = setInterval(() => {
        console.log('🔄 Автоматическое обновление данных');
        refreshAll();
    }, interval);
}

function stopAutoRefresh() {
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
        autoRefreshInterval = null;
    }
}

// --- ИНИЦИАЛИЗАЦИЯ ---
document.addEventListener('DOMContentLoaded', () => {
    // Запускаем автообновление
    startAutoRefresh();
    
    console.log('🚀 Вспомогательные функции инициализированы');
});

