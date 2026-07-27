// ============================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================

// --- ЗАПРОС К SUPABASE ---
async function supabaseRequest(endpoint, method = 'GET', data = null) {
    const headers = {
        'apikey': CONFIG.SUPABASE_KEY,
        'Authorization': 'Bearer ' + CONFIG.SUPABASE_KEY,
        'Content-Type': 'application/json'
    };
    const options = { method, headers };
    if (data) options.body = JSON.stringify(data);
    const resp = await fetch(CONFIG.SUPABASE_URL + endpoint, options);
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    return resp.json();
}

// --- УСТАНОВКА СТАТУСА ---
function setStatus(id, msg, type = 'loading') {
    const el = document.getElementById(id);
    if (el) { el.textContent = msg; el.className = 'status ' + type; }
}

// --- ЗАГРУЗКА ТУРНИРОВ ДЛЯ SELECT ---
async function loadTournamentsForSelect(selectId) {
    const select = document.getElementById(selectId);
    if (!select) return;
    try {
        const data = await supabaseRequest('/rest/v1/tournaments?select=id,title,status&order=created_at.desc');
        const currentVal = select.value;
        select.innerHTML = '<option value="">Выберите турнир...</option>' +
            data.map(t => `<option value="${t.id}">${t.title || 'Турнир'} (${t.status})</option>`).join('');
        if (currentVal) select.value = currentVal;
    } catch (e) {
        console.error('Ошибка загрузки турниров:', e);
    }
}

// --- ПЕРЕКЛЮЧЕНИЕ СТРАНИЦ ---
function showPage(page) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('page-' + page).classList.add('active');
    document.querySelectorAll('.nav-links button').forEach(b => b.classList.remove('active'));
    document.querySelector(`.nav-links button[data-page="${page}"]`).classList.add('active');
    
    // Загружаем данные для страницы
    if (page === 'players') loadPlayers();
    if (page === 'tournaments') loadTournaments();
    if (page === 'teams') { loadTournamentsForSelect('teamsTournamentSelect'); loadTeams(); }
    if (page === 'matches') { loadTournamentsForSelect('matchTournamentSelect'); }
}
