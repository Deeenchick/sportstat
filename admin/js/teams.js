// ============================================================
// КОМАНДЫ
// ============================================================

let currentTeamsData = { tournamentId: null, teams: {}, players: [] };

async function loadTeams() {
    const container = document.getElementById('page-teams');
    container.innerHTML = `
        <div class="card">
            <h2>👥 Формирование команд</h2>
            <div id="teamsStatus" class="status loading">⏳ Загрузка...</div>
            <div class="flex" style="margin-bottom: 16px;">
                <select id="teamsTournamentSelect" onchange="loadTeamsData()">
                    <option value="">Выберите турнир...</option>
                </select>
                <button onclick="autoFillTeams()" class="warning">⚡ Заполнить случайно</button>
                <button onclick="saveTeams()" class="success">💾 Сохранить составы</button>
            </div>
            <div id="teamsContainer"><p class="empty">Выберите турнир</p></div>
        </div>
    `;
    await loadTournamentsForSelect('teamsTournamentSelect');
    await loadTeamsData();
}

async function loadTeamsData() {
    const select = document.getElementById('teamsTournamentSelect');
    const tournamentId = select?.value;
    const container = document.getElementById('teamsContainer');
    if (!tournamentId || !container) return;
    
    container.innerHTML = '<p>⏳ Загрузка...</p>';
    currentTeamsData.tournamentId = tournamentId;

    try {
        const players = await supabaseRequest('/rest/v1/players?select=*&order=name.asc');
        currentTeamsData.players = players;
        let teams = await supabaseRequest(`/rest/v1/tournament_teams?select=*&tournament_id=eq.${tournamentId}`);
        if (!teams || teams.length === 0) {
            container.innerHTML = '<p class="empty">❌ Нет команд! Создайте турнир заново.</p>';
            return;
        }
        const teamPlayers = await supabaseRequest(`/rest/v1/team_players?select=*,player:players(name)&team_id=in.(${teams.map(t => t.id).join(',')})`);
        const teamMap = {};
        teams.forEach(t => teamMap[t.id] = { ...t, players: [] });
        teamPlayers.forEach(tp => {
            if (teamMap[tp.team_id]) {
                const player = currentTeamsData.players.find(p => p.id === tp.player_id);
                if (player) teamMap[tp.team_id].players.push(player);
            }
        });
        currentTeamsData.teams = teamMap;

        const teamColors = { 'А': 'team-a', 'Б': 'team-b', 'В': 'team-c' };
        let html = '<div class="teams-grid">';
        for (const [id, team] of Object.entries(teamMap)) {
            const color = teamColors[team.team_name] || '';
            const availablePlayers = currentTeamsData.players.filter(p => 
                !Object.values(teamMap).some(t => t.id !== id && t.players.some(tp => tp.id === p.id))
            );
            html += `
                <div class="team-card ${color}">
                    <h4>Команда ${team.team_name} (${team.players.length}/5)</h4>
                    <div>
                        ${team.players.map(p => `
                            <span class="player-tag">
                                ${p.name}
                                <button onclick="removeFromTeam('${id}','${p.id}')" style="border:none;background:none;color:#ef4444;cursor:pointer;">✕</button>
                            </span>
                        `).join('')}
                        ${team.players.length < 5 ? '<div class="empty-slot">+ свободное место</div>' : ''}
                    </div>
                    ${team.players.length < 5 ? `
                        <select onchange="addToTeam('${id}', this.value)">
                            <option value="">+ Добавить игрока</option>
                            ${availablePlayers.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
                        </select>
                    ` : ''}
                </div>
            `;
        }
        html += '</div>';
        container.innerHTML = html;
        setStatus('teamsStatus', '✅ Команды загружены', 'success');
    } catch (e) {
        setStatus('teamsStatus', '❌ ' + e.message, 'error');
        container.innerHTML = '<p class="empty">❌ Ошибка загрузки</p>';
    }
}

async function addToTeam(teamId, playerId) {
    if (!playerId) return;
    try {
        await supabaseRequest('/rest/v1/team_players', 'POST', [{ team_id: teamId, player_id: playerId }]);
        loadTeamsData();
    } catch (e) { alert('❌ ' + e.message); }
}

async function removeFromTeam(teamId, playerId) {
    if (!confirm('Убрать игрока из команды?')) return;
    try {
        await supabaseRequest(`/rest/v1/team_players?team_id=eq.${teamId}&player_id=eq.${playerId}`, 'DELETE');
        loadTeamsData();
    } catch (e) { alert('❌ ' + e.message); }
}

async function autoFillTeams() {
    const tournamentId = currentTeamsData.tournamentId;
    if (!tournamentId) return alert('Выберите турнир!');
    const players = currentTeamsData.players;
    if (players.length < 9) return alert('Нужно минимум 9 игроков');
    try {
        const teams = Object.values(currentTeamsData.teams);
        for (const team of teams) {
            for (const p of team.players) {
                await supabaseRequest(`/rest/v1/team_players?team_id=eq.${team.id}&player_id=eq.${p.id}`, 'DELETE');
            }
        }
        const shuffled = [...players].sort(() => Math.random() - 0.5);
        const teamIds = Object.keys(currentTeamsData.teams);
        let idx = 0;
        for (const player of shuffled) {
            const teamId = teamIds[idx % teamIds.length];
            await supabaseRequest('/rest/v1/team_players', 'POST', [{ team_id: teamId, player_id: player.id }]);
            idx++;
        }
        loadTeamsData();
        alert('✅ Игроки распределены по командам!');
    } catch (e) { alert('❌ ' + e.message); }
}

async function saveTeams() {
    alert('✅ Составы сохранены! Перейдите в "Матчи".');
}
