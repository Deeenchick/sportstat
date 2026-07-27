// ============================================================
// ТУРНИРЫ
// ============================================================

async function loadTournaments() {
    const container = document.getElementById('page-tournaments');
    container.innerHTML = `
        <div class="card">
            <h2>🏆 Турниры</h2>
            <div id="tournamentsStatus" class="status loading">⏳ Загрузка...</div>
            <div style="background: #f8fafc; padding: 16px; border-radius: 10px; margin-bottom: 16px;">
                <h4 style="margin-bottom: 12px;">📝 Создать турнир</h4>
                <div class="flex">
                    <input id="tournamentTitle" placeholder="Название турнира..." />
                    <input type="date" id="tournamentDate" />
                    <button onclick="createTournament()" class="success">🚀 Создать</button>
                </div>
            </div>
            <ul id="tournamentsList"><li class="empty">Загрузка...</li></ul>
        </div>
    `;
    await renderTournaments();
}

async function renderTournaments() {
    const list = document.getElementById('tournamentsList');
    if (!list) return;
    list.innerHTML = '<li class="empty">⏳ Загрузка...</li>';
    try {
        const data = await supabaseRequest('/rest/v1/tournaments?select=*&order=created_at.desc');
        setStatus('tournamentsStatus', '✅ Турниров: ' + (data?.length || 0), 'success');
        if (!data || data.length === 0) {
            list.innerHTML = '<li class="empty">📋 Нет турниров. Создайте первый!</li>';
            return;
        }
        list.innerHTML = data.map(t => `
            <div class="tournament-item">
                <div class="info">
                    <div class="title">${t.title || 'Турнир'}</div>
                    <div class="date">${t.tournament_date || ''}</div>
                </div>
                <div class="actions">
                    <span class="status-badge ${t.status}">${t.status || 'draft'}</span>
                    <button onclick="deleteTournament('${t.id}')" class="delete-btn">✕</button>
                    <button onclick="checkTeams('${t.id}')" class="warning" style="padding:4px 12px;font-size:12px;">🔍 Проверить команды</button>
                </div>
            </div>
        `).join('');
    } catch (e) {
        setStatus('tournamentsStatus', '❌ ' + e.message, 'error');
        list.innerHTML = '<li class="empty">❌ Ошибка</li>';
    }
}

async function createTournament() {
    const title = document.getElementById('tournamentTitle').value.trim() || 'Турнир';
    const date = document.getElementById('tournamentDate').value || new Date().toISOString().split('T')[0];
    const btn = document.querySelector('#page-tournaments .card .flex button');
    btn.disabled = true; btn.textContent = '⏳...';
    
    try {
        // 1. Создаем турнир
        const data = await supabaseRequest('/rest/v1/tournaments', 'POST', [{
            title,
            tournament_date: date,
            status: 'draft',
            registered_players: []
        }]);
        
        const tournamentId = data[0].id;
        console.log('✅ Турнир создан:', tournamentId);
        
        // 2. СОЗДАЕМ КОМАНДЫ А, Б, В
        const teamNames = ['А', 'Б', 'В'];
        for (const name of teamNames) {
            const result = await supabaseRequest('/rest/v1/tournament_teams', 'POST', [{
                tournament_id: tournamentId,
                team_name: name,
                wins: 0,
                draws: 0,
                losses: 0,
                goals_for: 0,
                goals_against: 0,
                points: 0
            }]);
            console.log('✅ Команда', name, 'создана');
        }
        
        // 3. Проверяем, что команды создались
        const teams = await supabaseRequest(`/rest/v1/tournament_teams?select=*&tournament_id=eq.${tournamentId}`);
        console.log('📋 Всего команд в турнире:', teams.length);
        
        document.getElementById('tournamentTitle').value = '';
        await renderTournaments();
        
        alert('✅ Турнир создан! Команды А, Б, В готовы. Перейдите в "Команды" для распределения игроков.');
        
    } catch (e) {
        console.error('❌ Ошибка:', e);
        alert('❌ Ошибка: ' + e.message);
    }
    
    btn.disabled = false;
    btn.textContent = '🚀 Создать';
}

async function deleteTournament(id) {
    if (!confirm('Удалить турнир?')) return;
    try {
        await supabaseRequest('/rest/v1/tournaments?id=eq.' + id, 'DELETE');
        renderTournaments();
    } catch (e) { alert('❌ ' + e.message); }
}

// --- ФУНКЦИЯ ДЛЯ ПРОВЕРКИ КОМАНД ---
async function checkTeams(tournamentId) {
    try {
        const teams = await supabaseRequest(`/rest/v1/tournament_teams?select=*&tournament_id=eq.${tournamentId}`);
        if (teams && teams.length > 0) {
            alert('✅ Найдено команд: ' + teams.length + '\n' + teams.map(t => t.team_name).join(', '));
        } else {
            alert('❌ Команд нет! Нужно создать.');
        }
    } catch (e) {
        alert('❌ Ошибка: ' + e.message);
    }
}
