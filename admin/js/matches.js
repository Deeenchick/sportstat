// ============================================================
// МАТЧИ (ИСПРАВЛЕННЫЙ)
// ============================================================

let currentMatchTournamentId = null;

async function loadMatchesPage() {
    const container = document.getElementById('page-matches');
    if (!container) {
        console.error('❌ Контейнер page-matches не найден');
        return;
    }
    
    container.innerHTML = `
        <div class="card">
            <h2>⚽ Ввод матчей</h2>
            <div id="matchesStatus" class="status loading">⏳ Загрузка...</div>
            <div class="flex" style="margin-bottom: 16px; flex-wrap: wrap; gap: 10px;">
                <select id="matchTournamentSelect" onchange="loadMatches()" style="min-width: 200px; padding: 8px 12px; border: 2px solid #d1d5db; border-radius: 6px;">
                    <option value="">Выберите турнир...</option>
                </select>
                <button onclick="generateMatches()" class="warning">🔄 Создать матчи</button>
            </div>
            <div id="matchesContainer"><p class="empty">Выберите турнир</p></div>
        </div>
    `;
    
    // Загружаем турниры для select
    await loadTournamentsForSelect('matchTournamentSelect');
    
    // Проверяем, есть ли сохраненный турнир
    const savedTournament = localStorage.getItem('selectedTournament');
    const select = document.getElementById('matchTournamentSelect');
    if (select && savedTournament) {
        select.value = savedTournament;
        await loadMatches();
    }
}

async function loadMatches() {
    const select = document.getElementById('matchTournamentSelect');
    if (!select) {
        console.error('❌ select не найден');
        return;
    }
    
    const tournamentId = select.value;
    const container = document.getElementById('matchesContainer');
    const statusEl = document.getElementById('matchesStatus');
    
    if (!container || !statusEl) {
        console.error('❌ Контейнеры не найдены');
        return;
    }
    
    if (!tournamentId) {
        container.innerHTML = '<p class="empty">Выберите турнир</p>';
        return;
    }
    
    currentMatchTournamentId = tournamentId;
    localStorage.setItem('selectedTournament', tournamentId);
    container.innerHTML = '<p>⏳ Загрузка...</p>';
    statusEl.textContent = '⏳ Загрузка матчей...';
    statusEl.className = 'status loading';
    
    try {
        // Загружаем команды и матчи параллельно
        const [teams, matches] = await Promise.all([
            supabaseRequest(`/rest/v1/tournament_teams?select=*&tournament_id=eq.${tournamentId}`),
            supabaseRequest(`/rest/v1/matches?select=*&tournament_id=eq.${tournamentId}&order=match_number.asc`)
        ]);
        
        console.log('🏆 Команд найдено:', teams?.length || 0);
        console.log('⚽ Матчей найдено:', matches?.length || 0);
        
        // Проверяем, что есть команды
        if (!teams || teams.length === 0) {
            container.innerHTML = '<p class="empty">❌ В турнире нет команд. Сначала создайте команды в разделе "Команды"</p>';
            statusEl.textContent = '❌ Нет команд';
            statusEl.className = 'status error';
            return;
        }
        
        // Проверяем, что есть ровно 3 команды
        if (teams.length !== 3) {
            container.innerHTML = `<p class="empty">❌ В турнире должно быть ровно 3 команды. Сейчас: ${teams.length}</p>`;
            statusEl.textContent = '❌ Нужно 3 команды';
            statusEl.className = 'status error';
            return;
        }
        
        if (!matches || matches.length === 0) {
            container.innerHTML = '<p class="empty">Нет матчей. Нажмите "Создать матчи"</p>';
            statusEl.textContent = 'ℹ️ Нет матчей';
            statusEl.className = 'status success';
            return;
        }
        
        // Создаем карту команд
        const teamMap = {};
        teams.forEach(t => teamMap[t.id] = t.team_name);
        
        renderMatches(container, matches, teamMap);
        
        statusEl.textContent = '✅ Матчи загружены';
        statusEl.className = 'status success';
        
    } catch (e) {
        console.error('❌ Ошибка:', e);
        statusEl.textContent = '❌ ' + e.message;
        statusEl.className = 'status error';
        container.innerHTML = '<p class="empty">❌ Ошибка загрузки</p>';
    }
}

function renderMatches(container, matches, teamMap) {
    // Используем DocumentFragment для производительности
    const fragment = document.createDocumentFragment();
    const wrapper = document.createElement('div');
    wrapper.style.display = 'grid';
    wrapper.style.gap = '10px';
    
    matches.forEach(m => {
        const row = document.createElement('div');
        row.className = 'match-row';
        row.style.cssText = 'display:flex;align-items:center;gap:10px;padding:10px;background:#f8fafc;border-radius:8px;flex-wrap:wrap;';
        
        row.innerHTML = `
            <span style="font-weight:600;min-width:70px;">Матч ${m.match_number}</span>
            <span class="team-name" style="font-weight:500;min-width:50px;">${teamMap[m.team_a_id] || '❌'}</span>
            <input type="number" min="0" value="${m.score_a || 0}" 
                   onchange="updateMatchScore('${m.id}','a',this.value)" 
                   ${m.is_finished ? 'disabled' : ''} 
                   style="width:60px;padding:6px;border:2px solid #d1d5db;border-radius:6px;text-align:center;font-size:16px;" />
            <span style="font-weight:bold;font-size:18px;">:</span>
            <input type="number" min="0" value="${m.score_b || 0}" 
                   onchange="updateMatchScore('${m.id}','b',this.value)" 
                   ${m.is_finished ? 'disabled' : ''} 
                   style="width:60px;padding:6px;border:2px solid #d1d5db;border-radius:6px;text-align:center;font-size:16px;" />
            <span class="team-name" style="font-weight:500;min-width:50px;">${teamMap[m.team_b_id] || '❌'}</span>
            <span class="status-text ${m.is_finished ? 'done' : 'pending'}" style="padding:4px 12px;border-radius:12px;font-size:14px;background:${m.is_finished ? '#dcfce7' : '#fef3c7'};color:${m.is_finished ? '#166534' : '#92400e'};">
                ${m.is_finished ? '✅ Завершен' : '⏳ Ожидает'}
            </span>
            ${!m.is_finished ? `<button onclick="finishMatch('${m.id}')" class="btn-success">Завершить</button>` : ''}
        `;
        fragment.appendChild(row);
    });
    
    wrapper.appendChild(fragment);
    container.innerHTML = '';
    container.appendChild(wrapper);
    
    // Добавляем кнопку завершения турнира
    const finishBtn = document.createElement('div');
    finishBtn.style.marginTop = '16px';
    finishBtn.innerHTML = `<button onclick="finishTournament()" class="btn-danger">🏁 Завершить турнир</button>`;
    container.appendChild(finishBtn);
}

// Остальные функции (generateMatches, updateMatchScore, etc.) остаются без изменений
