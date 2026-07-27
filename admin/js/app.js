// ============================================================
// ЗАПУСК АДМИН-ПАНЕЛИ
// ============================================================

console.log('🚀 Админ-панель загружается...');

// ============================================================
// ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ
// ============================================================

// Состояние загрузки страниц
const pageLoadStatus = {};

// ============================================================
// ПЕРЕКЛЮЧЕНИЕ СТРАНИЦ
// ============================================================

/**
 * Переключение между страницами с ленивой загрузкой данных
 * @param {string} page - Имя страницы (players, tournaments, teams, matches)
 */
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
    
    // Закрываем мобильное меню
    closeMobileMenu();
    
    // Загружаем данные для страницы (только если не загружены или принудительно)
    const forceReload = pageLoadStatus[page] === undefined || 
                        (page === 'teams' || page === 'matches');
    
    // Показываем индикатор загрузки
    showGlobalLoader(true);
    
    try {
        switch(page) {
            case 'players':
                if (forceReload || !pageLoadStatus.players) {
                    if (typeof loadPlayers === 'function') {
                        await loadPlayers();
                        pageLoadStatus.players = true;
                    } else {
                        console.warn('⚠️ Функция loadPlayers не определена');
                    }
                }
                break;
                
            case 'tournaments':
                if (forceReload || !pageLoadStatus.tournaments) {
                    if (typeof loadTournaments === 'function') {
                        await loadTournaments();
                        pageLoadStatus.tournaments = true;
                    } else {
                        console.warn('⚠️ Функция loadTournaments не определена');
                    }
                }
                break;
                
            case 'teams':
                if (typeof loadTournamentsForSelect === 'function') {
                    await loadTournamentsForSelect('teamsTournamentSelect');
                }
                if (typeof loadTeams === 'function') {
                    await loadTeams();
                }
                pageLoadStatus.teams = true;
                break;
                
            case 'matches':
                if (typeof loadTournamentsForSelect === 'function') {
                    await loadTournamentsForSelect('matchTournamentSelect');
                }
                if (typeof loadMatches === 'function') {
                    await loadMatches();
                }
                pageLoadStatus.matches = true;
                break;
                
            default:
                console.warn(`⚠️ Неизвестная страница: ${page}`);
        }
    } catch (e) {
        console.error(`❌ Ошибка загрузки страницы ${page}:`, e);
        if (typeof showNotification === 'function') {
            showNotification(`Ошибка загрузки: ${e.message}`, 'error');
        } else {
            alert(`Ошибка: ${e.message}`);
        }
    } finally {
        // Скрываем индикатор загрузки
        showGlobalLoader(false);
    }
}

// ============================================================
// МОБИЛЬНОЕ МЕНЮ
// ============================================================

/**
 * Открытие/закрытие мобильного меню
 */
function toggleMobileMenu() {
    const navToggle = document.getElementById('navToggle');
    const navLinks = document.getElementById('navLinks');
    
    if (navToggle && navLinks) {
        navToggle.classList.toggle('active');
        navLinks.classList.toggle('open');
    }
}

/**
 * Закрытие мобильного меню
 */
function closeMobileMenu() {
    const navToggle = document.getElementById('navToggle');
    const navLinks = document.getElementById('navLinks');
    
    if (navToggle && navLinks) {
        navToggle.classList.remove('active');
        navLinks.classList.remove('open');
    }
}

// ============================================================
// ГЛОБАЛЬНЫЙ ЛОАДЕР
// ============================================================

/**
 * Показ/скрытие глобального индикатора загрузки
 * @param {boolean} show - Показать или скрыть
 */
function showGlobalLoader(show) {
    const loader = document.getElementById('globalLoader');
    if (loader) {
        if (show) {
            loader.classList.add('show');
            loader.style.display = 'block';
        } else {
            loader.classList.remove('show');
            loader.style.display = 'none';
        }
    }
}

// ============================================================
// СТАТУС ОНЛАЙН
// ============================================================

/**
 * Обновление статуса интернет-соединения
 */
function updateOnlineStatus() {
    const statusEl = document.getElementById('onlineStatus');
    if (statusEl) {
        if (navigator.onLine) {
            statusEl.textContent = '🟢 Онлайн';
            statusEl.className = 'badge online';
        } else {
            statusEl.textContent = '🔴 Офлайн';
            statusEl.className = 'badge offline';
        }
    }
}

// ============================================================
// ОБНОВЛЕНИЕ ВСЕХ ДАННЫХ
// ============================================================

/**
 * Принудительное обновление всех данных на текущей странице
 */
async function refreshAll() {
    console.log('🔄 Обновление всех данных...');
    
    // Очищаем кэш, если функция доступна
    if (typeof clearCache === 'function') {
        clearCache();
    }
    
    // Сбрасываем статус загрузки страниц
    for (const key in pageLoadStatus) {
        pageLoadStatus[key] = false;
    }
    
    // Определяем текущую страницу
    const activePage = document.querySelector('.page.active');
    if (activePage) {
        const pageId = activePage.id.replace('page-', '');
        await showPage(pageId);
    }
    
    if (typeof showNotification === 'function') {
        showNotification('✅ Все данные обновлены', 'success');
    }
}

// ============================================================
// АВТОМАТИЧЕСКОЕ ОБНОВЛЕНИЕ
// ============================================================

let autoRefreshInterval = null;

/**
 * Запуск автоматического обновления данных
 * @param {number} interval - Интервал в миллисекундах (по умолчанию 5 минут)
 */
function startAutoRefresh(interval = 300000) {
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
    }
    autoRefreshInterval = setInterval(() => {
        console.log('🔄 Автоматическое обновление данных');
        if (document.hidden) {
            // Если страница не в фокусе, пропускаем обновление
            console.log('⏭️ Страница в фоне, пропускаем обновление');
            return;
        }
        refreshAll();
    }, interval);
    console.log(`⏰ Автообновление запущено (интервал: ${interval/1000}с)`);
}

/**
 * Остановка автоматического обновления
 */
function stopAutoRefresh() {
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
        autoRefreshInterval = null;
        console.log('⏰ Автообновление остановлено');
    }
}

// ============================================================
// КЛАВИАТУРНЫЕ ШОРТКАТЫ
// ============================================================

document.addEventListener('keydown', (e) => {
    // Ctrl + R - обновление данных
    if (e.ctrlKey && e.key === 'r') {
        e.preventDefault();
        refreshAll();
    }
    
    // Alt + 1-4 - переключение страниц
    if (e.altKey) {
        const pageMap = {
            '1': 'players',
            '2': 'tournaments',
            '3': 'teams',
            '4': 'matches'
        };
        const page = pageMap[e.key];
        if (page) {
            e.preventDefault();
            showPage(page);
        }
    }
    
    // Escape - закрыть мобильное меню
    if (e.key === 'Escape') {
        closeMobileMenu();
    }
});

// ============================================================
// ИНИЦИАЛИЗАЦИЯ
// ============================================================

document.addEventListener('DOMContentLoaded', function() {
    console.log('📄 DOM полностью загружен');
    
    // --- НАСТРОЙКА НАВИГАЦИИ ---
    document.querySelectorAll('.nav-links button').forEach(btn => {
        btn.addEventListener('click', function(e) {
            const page = this.dataset.page;
            console.log('📄 Переход на страницу (клик):', page);
            showPage(page);
        });
    });
    
    // --- МОБИЛЬНОЕ МЕНЮ ---
    const navToggle = document.getElementById('navToggle');
    if (navToggle) {
        navToggle.addEventListener('click', toggleMobileMenu);
    }
    
    // Закрываем меню при клике вне навигации
    document.addEventListener('click', function(e) {
        const navbar = document.querySelector('.navbar');
        const navLinks = document.getElementById('navLinks');
        if (navbar && navLinks && !navbar.contains(e.target)) {
            closeMobileMenu();
        }
    });
    
    // --- ОБНОВЛЕНИЕ СТАТУСА ОНЛАЙН ---
    window.addEventListener('online', () => {
        updateOnlineStatus();
        if (typeof showNotification === 'function') {
            showNotification('📡 Интернет соединение восстановлено', 'success');
        }
        // Обновляем данные при восстановлении соединения
        setTimeout(refreshAll, 1000);
    });
    
    window.addEventListener('offline', () => {
        updateOnlineStatus();
        if (typeof showNotification === 'function') {
            showNotification('📡 Интернет соединение потеряно', 'error', 0);
        }
    });
    
    updateOnlineStatus();
    
    // --- ЗАПУСК ---
    // Загружаем начальную страницу (Игроки)
    setTimeout(() => {
        showPage('players');
    }, 100);
    
    // --- АВТООБНОВЛЕНИЕ ---
    startAutoRefresh();
    
    console.log('✅ Админ-панель готова к работе!');
    console.log('📖 Шорткаты:');
    console.log('  Ctrl+R - обновить данные');
    console.log('  Alt+1 - Игроки');
    console.log('  Alt+2 - Турниры');
    console.log('  Alt+3 - Команды');
    console.log('  Alt+4 - Матчи');
    console.log('  Esc - закрыть меню');
});

// ============================================================
// ОБРАБОТКА ГЛОБАЛЬНЫХ ОШИБОК
// ============================================================

// Перехват неперехваченных ошибок
window.addEventListener('error', (event) => {
    console.error('❌ Глобальная ошибка:', event.error || event.message);
    if (typeof showNotification === 'function') {
        showNotification(`Ошибка: ${event.message || 'Неизвестная ошибка'}`, 'error');
    }
});

// Перехват неперехваченных Promise ошибок
window.addEventListener('unhandledrejection', (event) => {
    console.error('❌ Неперехваченная ошибка Promise:', event.reason);
    if (event.reason && event.reason.message) {
        if (typeof showNotification === 'function') {
            showNotification(`Ошибка: ${event.reason.message}`, 'error');
        }
    }
});

// ============================================================
// ОБРАБОТКА ИЗМЕНЕНИЯ ВИДИМОСТИ СТРАНИЦЫ
// ============================================================

document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        console.log('⏸️ Страница скрыта, остановка автообновления');
        stopAutoRefresh();
    } else {
        console.log('▶️ Страница видна, запуск автообновления');
        startAutoRefresh();
        // Обновляем данные при возврате на страницу
        refreshAll();
    }
});

// ============================================================
// ЭКСПОРТ ДЛЯ ИСПОЛЬЗОВАНИЯ В ДРУГИХ МОДУЛЯХ
// ============================================================

// Делаем функции доступными глобально
window.showPage = showPage;
window.refreshAll = refreshAll;
window.toggleMobileMenu = toggleMobileMenu;
window.closeMobileMenu = closeMobileMenu;
window.showGlobalLoader = showGlobalLoader;
window.startAutoRefresh = startAutoRefresh;
window.stopAutoRefresh = stopAutoRefresh;
window.updateOnlineStatus = updateOnlineStatus;

console.log('✅ app.js загружен');

// ============================================================
// ЗАЩИТА ОТ ПОВТОРНОЙ ЗАГРУЗКИ
// ============================================================

if (window._appLoaded) {
    console.warn('⚠️ app.js уже был загружен, пропускаем повторную инициализацию');
} else {
    window._appLoaded = true;
}
