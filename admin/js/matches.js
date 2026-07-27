// ============================================================
// МАТЧИ
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
            <div class="flex" style="margin-bottom: 16px;">
                <select id="matchTournamentSelect" onchange="loadMatches()">
                    <option value="">Выберите турнир...</option>
                </select>
                <button onclick="generateMatches()" class="warning">🔄 Создать матчи</button>
            </div>
            <div id="matchesContainer"><p class="empty">Выберите турнир</p></div>
        </div>
    `;
    
    try {
        const data = await supabaseRequest('/rest/v1/tournaments?select=id,title,status&order=created_at.desc');
        const select = document.getElementById('matchTournamentSelect');
        if (select) {
            select.innerHTML = '<option value="">Выберите турнир...</option>' +
                data.map(t => `<option value="${t.id}">${t.title || 'Турнир'} (${t.status})</option>`).join('');
        }
        setStatus('matchesStatus', '✅ Выберите турнир', 'success');
    } catch (e) {
        console.error('❌ Ошибка загрузки турниров:', e);
        setStatus('matchesStatus', '❌ ' + e.message, 'error');
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
    container.innerHTML = '<p>⏳ Загрузка...</p>';
    statusEl.textContent = '⏳ Загрузка матчей...';
    statusEl.className = 'status loading';
    
    try {
        const teams = await supabaseRequest(`/rest/v1/tournament_teams?select=*&tournament_id=eq.${tournamentId}`);
        console.log('🏆 Команд найдено:', teams?.length || 0);
        
        let matches = await supabaseRequest(`/rest/v1/matches?select=*&tournament_id=eq.${tournamentId}`);
        console.log('⚽ Матчей найдено:', matches?.length || 0);
        
        if (!matches || matches.length === 0) {
            container.innerHTML = '<p class="empty">Нет матчей. Нажмите "Создать матчи"</p>';
            statusEl.textContent = 'ℹ️ Нет матчей';
            statusEl.className = 'status success';
            return;
        }
        
        const teamMap = {};
        teams.forEach(t => teamMap[t.id] = t.team_name);
        
        container.innerHTML = `
            <div style="display:grid;gap:10px;">
                ${matches.map(m => `
                    <div class="match-row">
                        <span style="font-weight:600;min-width:60px;">Матч ${m.match_number}</span>
                        <span class="team-name">${teamMap[m.team_a_id] || '?'}</span>
                        <input type="number" value="${m.score_a || 0}" onchange="updateMatchScore('${m.id}','a',this.value)" ${m.is_finished ? 'disabled' : ''} />
                        <span>:</span>
                        <input type="number" value="${m.score_b || 0}" onchange="updateMatchScore('${m.id}','b',this.value)" ${m.is_finished ? 'disabled' : ''} />
                        <span class="team-name">${teamMap[m.team_b_id] || '?'}</span>
                        <span class="status-text ${m.is_finished ? 'done' : 'pending'}">${m.is_finished ? '✅ Завершен' : '⏳ Ожидает'}</span>
                        ${!m.is_finished ? `<button onclick="finishMatch('${m.id}')" style="padding:4px 16px;background:#22c55e;color:white;border:none;border-radius:6px;cursor:pointer;">Завершить</button>` : ''}
                    </div>
                `).join('')}
            </div>
            <div style="margin-top:16px;">
                <button onclick="finishTournament()" style="padding:10px 24px;background:#ef4444;color:white;border:none;border-radius:10px;cursor:pointer;font-weight:600;">🏁 Завершить турнир</button>
            </div>
        `;
        statusEl.textContent = '✅ Матчи загружены';
        statusEl.className = 'status success';
        
    } catch (e) {
        console.error('❌ Ошибка:', e);
        statusEl.textContent = '❌ ' + e.message;
        statusEl.className = 'status error';
        container.innerHTML = '<p class="empty">❌ Ошибка загрузки</p>';
    }
}

async function generateMatches() {
    const tournamentId = currentMatchTournamentId;
    if (!tournamentId) return alert('Выберите турнир!');
    
    try {
        const teams = await supabaseRequest(`/rest/v1/tournament_teams?select=*&tournament_id=eq.${tournamentId}`);
        if (!teams || teams.length < 3) {
            return alert('Нужно 3 команды! Сначала создайте команды в разделе "Команды"');
        }
        
        // Удаляем старые матчи
        await supabaseRequest(`/rest/v1/matches?tournament_id=eq.${tournamentId}`, 'DELETE');
        
        const teamPairs = [
            ['А','Б'],['А','В'],['Б','В'],
            ['А','Б'],['А','В'],['Б','В'],
            ['А','Б'],['А','В'],['Б','В'],
            ['А','Б'],['А','В'],['Б','В']
        ];
        const teamMap = {};
        teams.forEach(t => teamMap[t.team_name] = t.id);
        
        let matchNum = 1;
        let created = 0;
        for (const [a, b] of teamPairs) {
            if (teamMap[a] && teamMap[b]) {
                await supabaseRequest('/rest/v1/matches', 'POST', [{
                    tournament_id: tournamentId,
                    team_a_id: teamMap[a],
                    team_b_id: teamMap[b],
                    match_number: matchNum++,
                    is_finished: false
                }]);
                created++;
            }
        }
        
        alert('✅ ' + created + ' матчей созданы!');
        loadMatches();
    } catch (e) {
        console.error('❌ Ошибка:', e);
        alert('❌ Ошибка: ' + e.message);
    }
}

async function updateMatchScore(matchId, side, value) {
    const field = side === 'a' ? 'score_a' : 'score_b';
    try {
        await supabaseRequest(`/rest/v1/matches?id=eq.${matchId}`, 'PATCH', { [field]: parseInt(value) || 0 });
    } catch (e) { 
        console.error('Ошибка обновления счета:', e); 
    }
}

async function finishMatch(matchId) {
    try {
        await supabaseRequest(`/rest/v1/matches?id=eq.${matchId}`, 'PATCH', { is_finished: true });
        loadMatches();
        alert('✅ Матч завершен!');
    } catch (e) { 
        alert('❌ ' + e.message); 
    }
}

async function finishTournament() {
    if (!confirm('Завершить турнир?')) return;
    try {
        await supabaseRequest(`/rest/v1/tournaments?id=eq.${currentMatchTournamentId}`, 'PATCH', { status: 'finished' });
        alert('🏆 Турнир завершен!');
        loadMatches();
    } catch (e) { 
        alert('❌ ' + e.message); 
    }
}
