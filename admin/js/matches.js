// ============================================================
// МАТЧИ
// ============================================================

let currentMatchesTournamentId = null;

async function loadMatches() {
    const container = document.getElementById('page-matches');
    container.innerHTML = `
        <div class="card">
            <h2>⚽ Ввод матчей</h2>
            <div id="matchesStatus" class="status loading">⏳ Загрузка...</div>
            <div class="flex" style="margin-bottom: 16px;">
                <select id="matchTournamentSelect" onchange="loadMatchesData()">
                    <option value="">Выберите турнир...</option>
                </select>
                <button onclick="generateMatches()" class="warning">🔄 Создать матчи</button>
            </div>
            <div id="matchesContainer"><p class="empty">Выберите турнир</p></div>
        </div>
    `;
    await loadTournamentsForSelect('matchTournamentSelect');
    await loadMatchesData();
}

async function loadMatchesData() {
    const tournamentId = document.getElementById('matchTournamentSelect')?.value;
    const container = document.getElementById('matchesContainer');
    if (!tournamentId || !container) {
        if (container) container.innerHTML = '<p class="empty">Выберите турнир для ввода матчей</p>';
        return;
    }
    currentMatchesTournamentId = tournamentId;
    container.innerHTML = '<p>⏳ Загрузка матчей...</p>';
    try {
        const teams = await supabaseRequest(`/rest/v1/tournament_teams?select=*&tournament_id=eq.${tournamentId}`);
        let matches = await supabaseRequest(`/rest/v1/matches?select=*&tournament_id=eq.${tournamentId}`);
        if (!matches || matches.length === 0) {
            container.innerHTML = '<p class="empty">Нет матчей. Нажмите "Создать матчи"</p>';
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
            <div style="margin-top:16px;display:flex;gap:10px;flex-wrap:wrap;">
                <button onclick="calculateTournament()" style="padding:10px 24px;background:#8b5cf6;color:white;border:none;border-radius:10px;cursor:pointer;font-weight:600;">📊 Рассчитать PEI</button>
                <button onclick="finishTournament()" style="padding:10px 24px;background:#ef4444;color:white;border:none;border-radius:10px;cursor:pointer;font-weight:600;">🏁 Завершить турнир</button>
            </div>
        `;
        setStatus('matchesStatus', '✅ Матчи загружены', 'success');
    } catch (e) {
        setStatus('matchesStatus', '❌ ' + e.message, 'error');
        container.innerHTML = '<p class="empty">❌ Ошибка загрузки</p>';
    }
}

async function generateMatches() {
    const tournamentId = currentMatchesTournamentId;
    if (!tournamentId) return alert('Выберите турнир!');
    try {
        const teams = await supabaseRequest(`/rest/v1/tournament_teams?select=*&tournament_id=eq.${tournamentId}`);
        if (teams.length < 3) return alert('Нужно 3 команды!');
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
        for (const [a, b] of teamPairs) {
            if (teamMap[a] && teamMap[b]) {
                await supabaseRequest('/rest/v1/matches', 'POST', [{
                    tournament_id: tournamentId,
                    team_a_id: teamMap[a],
                    team_b_id: teamMap[b],
                    match_number: matchNum++,
                    is_finished: false
                }]);
            }
        }
        alert('✅ 12 матчей созданы!');
        loadMatchesData();
    } catch (e) { alert('❌ ' + e.message); }
}

async function updateMatchScore(matchId, side, value) {
    const field = side === 'a' ? 'score_a' : 'score_b';
    try {
        await supabaseRequest(`/rest/v1/matches?id=eq.${matchId}`, 'PATCH', { [field]: parseInt(value) || 0 });
    } catch (e) { console.error(e); }
}

async function finishMatch(matchId) {
    try {
        await supabaseRequest(`/rest/v1/matches?id=eq.${matchId}`, 'PATCH', { is_finished: true });
        loadMatchesData();
        alert('✅ Матч завершен!');
    } catch (e) { alert('❌ ' + e.message); }
}

async function calculateTournament() {
    alert('📊 Расчет PEI пока в разработке! Скоро будет готово.');
}

async function finishTournament() {
    if (!confirm('Завершить турнир? Это действие нельзя отменить!')) return;
    try {
        await supabaseRequest(`/rest/v1/tournaments?id=eq.${currentMatchesTournamentId}`, 'PATCH', { status: 'finished' });
        alert('🏆 Турнир завершен!');
        loadMatchesData();
    } catch (e) { alert('❌ ' + e.message); }
}
