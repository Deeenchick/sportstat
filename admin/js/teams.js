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
                <button onclick="createMissingTeams()" class="warning">🔧 Создать команды</button>
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
    const statusEl = document.getElementById('teamsStatus');
    
    if (!tournamentId || !container) {
        if (container) container.innerHTML = '<p class="empty">Выберите турнир</p>';
        return;
    }
    
    container.innerHTML = '<p>⏳ Загрузка...</p>';
    if (statusEl) {
        statusEl.textContent = '⏳ Загрузка команд...';
        statusEl.className = 'status loading';
    }
    
    currentTeamsData.tournamentId = tournamentId;

    try {
        // 1. Получаем всех игроков
        const players = await supabaseRequest('/rest/v1/players?select=*&order=name.asc');
        currentTeamsData.players = players;
        console.log('✅ Игроков загружено:', players.length);

        // 2. Получаем команды для этого турнира
        let teams = await supabaseRequest(`/rest/v1/tournament_teams?select=*&tournament_id=eq.${tournamentId}`);
        console.log('🏆 Команд найдено:', teams?.length || 0);
        
        // 3. Если команд нет — создаем
        if (!teams || teams.length === 0) {
            console.log('⚠️ Команд нет, создаем...');
            const teamNames = ['А', 'Б', 'В'];
            for (const name of teamNames) {
                await supabaseRequest('/rest/v1/tournament_teams', 'POST', [{
                    tournament_id: tournamentId,
                    team_name: name,
                    wins: 0, draws: 0, losses: 0,
                    goals_for: 0, goals_against: 0, points: 0
                }]);
            }
            // Перезагружаем команды
            teams = await supabaseRequest(`/rest/v1/tournament_teams?select=*&tournament_id=eq.${tournamentId}`);
            console.log('✅ Создано команд:', teams?.length || 0);
        }

        if (!teams || teams.length === 0) {
            container.innerHTML = '<p class="empty">❌ Не удалось создать команды. Попробуйте нажать "Создать команды"</p>';
            if (statusEl) {
                statusEl.textContent = '❌ Ошибка: команды не созданы';
                statusEl.className = 'status error';
            }
            return;
        }

        // 4. Получаем составы команд
        const teamIds = teams.map(t => t.id).join(',');
        let teamPlayers = [];
        if (teamIds) {
            teamPlayers = await supabaseRequest(`/rest/v1/team_players?select=*,player:players(name)&team_id=in.(${teamIds})`);
        }
        console.log('👥 Составов загружено:', teamPlayers?.length || 0);

        // 5. Группируем игроков по командам
        const teamMap = {};
        teams.forEach(t => teamMap[t.id] = { ...t, players: [] });
        teamPlayers.forEach(tp => {
            if (teamMap[tp.team_id]) {
                const player = currentTeamsData.players.find(p => p.id === tp.player_id);
                if (player) teamMap[tp.team_id].players.push(player);
            }
        });
        currentTeamsData.teams = teamMap;

        // 6. Показываем
        const teamColors = { 'А': 'team-a', 'Б': 'team-b', 'В': 'team-c' };
        let html = '<div class="teams-grid">';
        for (const [id, team] of Object.entries(teamMap)) {
            const color = teamColors[team.team_name] || '';
            // Доступные игроки (не в других командах)
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
        
        if (statusEl) {
            statusEl.textContent = '✅ Команды загружены (' + Object.keys(teamMap).length + ' команд)';
            statusEl.className = 'status success';
        }

    } catch (e) {
        console.error('❌ Ошибка загрузки команд:', e);
        if (statusEl) {
            statusEl.textContent = '❌ ' + e.message;
            statusEl.className = 'status error';
        }
        container.innerHTML = '<p class="empty">❌ Ошибка загрузки: ' + e.message + '</p>';
    }
}

// --- НОВАЯ ФУНКЦИЯ: ПРИНУДИТЕЛЬНОЕ СОЗДАНИЕ КОМАНД ---
async function createMissingTeams() {
    const select = document.getElementById('teamsTournamentSelect');
    const tournamentId = select?.value;
    if (!tournamentId) return alert('Сначала выберите турнир!');
    
    try {
        const teamNames = ['А', 'Б', 'В'];
        for (const name of teamNames) {
            await supabaseRequest('/rest/v1/tournament_teams', 'POST', [{
                tournament_id: tournamentId,
                team_name: name,
                wins: 0, draws: 0, losses: 0,
                goals_for: 0, goals_against: 0, points: 0
            }]);
        }
        alert('✅ Команды А, Б, В созданы!');
        loadTeamsData();
    } catch (e) {
        alert('❌ Ошибка: ' + e.message);
    }
}

// --- ОСТАЛЬНЫЕ ФУНКЦИИ БЕЗ ИЗМЕНЕНИЙ ---
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
    alert('✅ Составы сохранены! Перейдите в "Матчи" и нажмите "Создать матчи".');
}
