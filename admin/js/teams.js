// ============================================================
// КОМАНДЫ (РАБОЧАЯ ВЕРСИЯ)
// ============================================================

let currentTournamentId = null;
let allPlayers = [];
let teamData = {};

async function loadTeamsPage() {
    const container = document.getElementById('page-teams');
    container.innerHTML = `
        <div class="card">
            <h2>👥 Формирование команд</h2>
            <div id="teamsStatus" class="status loading">⏳ Загрузка...</div>
            <div class="flex" style="margin-bottom: 16px;">
                <select id="teamsTournamentSelect" onchange="loadTeams()">
                    <option value="">Выберите турнир...</option>
                </select>
                <button onclick="forceCreateTeams()" class="warning">🔧 Создать команды</button>
                <button onclick="autoFillTeams()" class="warning">⚡ Заполнить случайно</button>
                <button onclick="clearTeams()" class="danger">🗑️ Очистить все</button>
            </div>
            <div id="teamsContainer"><p class="empty">Выберите турнир</p></div>
        </div>
    `;
    
    // Загружаем список турниров
    try {
        const data = await supabaseRequest('/rest/v1/tournaments?select=id,title,status&order=created_at.desc');
        const select = document.getElementById('teamsTournamentSelect');
        select.innerHTML = '<option value="">Выберите турнир...</option>' +
            data.map(t => `<option value="${t.id}">${t.title || 'Турнир'} (${t.status})</option>`).join('');
        setStatus('teamsStatus', '✅ Выберите турнир', 'success');
    } catch (e) {
        setStatus('teamsStatus', '❌ ' + e.message, 'error');
    }
}

async function loadTeams() {
    const select = document.getElementById('teamsTournamentSelect');
    const tournamentId = select?.value;
    const container = document.getElementById('teamsContainer');
    const statusEl = document.getElementById('teamsStatus');
    
    if (!tournamentId) {
        container.innerHTML = '<p class="empty">Выберите турнир</p>';
        return;
    }
    
    currentTournamentId = tournamentId;
    container.innerHTML = '<p>⏳ Загрузка...</p>';
    statusEl.textContent = '⏳ Загрузка команд...';
    statusEl.className = 'status loading';

    try {
        // 1. Загружаем всех игроков
        allPlayers = await supabaseRequest('/rest/v1/players?select=*&order=name.asc');
        console.log('✅ Игроков:', allPlayers.length);

        // 2. Загружаем команды для турнира
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
            teams = await supabaseRequest(`/rest/v1/tournament_teams?select=*&tournament_id=eq.${tournamentId}`);
            console.log('✅ Создано команд:', teams?.length || 0);
        }

        // 4. Загружаем составы команд
        const teamIds = teams.map(t => t.id).join(',');
        let teamPlayers = [];
        if (teamIds) {
            teamPlayers = await supabaseRequest(`/rest/v1/team_players?select=*,player:players(name)&team_id=in.(${teamIds})`);
        }

        // 5. Группируем по командам
        teamData = {};
        teams.forEach(t => {
            teamData[t.team_name] = { 
                id: t.id, 
                name: t.team_name, 
                players: [] 
            };
        });
        
        teamPlayers.forEach(tp => {
            const teamName = teams.find(t => t.id === tp.team_id)?.team_name;
            if (teamName && teamData[teamName]) {
                const player = allPlayers.find(p => p.id === tp.player_id);
                if (player) teamData[teamName].players.push(player);
            }
        });

        // 6. Рендерим
        renderTeams();

        statusEl.textContent = '✅ Команды загружены';
        statusEl.className = 'status success';

    } catch (e) {
        console.error(e);
        statusEl.textContent = '❌ ' + e.message;
        statusEl.className = 'status error';
        container.innerHTML = '<p class="empty">❌ Ошибка: ' + e.message + '</p>';
    }
}

function renderTeams() {
    const container = document.getElementById('teamsContainer');
    const teamNames = ['А', 'Б', 'В'];
    const teamColors = { 'А': 'team-a', 'Б': 'team-b', 'В': 'team-c' };
    
    let html = '<div class="teams-grid">';
    for (const name of teamNames) {
        const team = teamData[name];
        if (!team) {
            // Если команды нет в данных, показываем пустую
            html += `
                <div class="team-card">
                    <h4>Команда ${name} (0/5)</h4>
                    <div class="empty-slot">Команда не создана</div>
                </div>
            `;
            continue;
        }
        
        // Доступные игроки (не в этой команде и не в других)
        const usedPlayers = new Set();
        for (const t of Object.values(teamData)) {
            if (t.name !== name) {
                t.players.forEach(p => usedPlayers.add(p.id));
            }
        }
        const availablePlayers = allPlayers.filter(p => !usedPlayers.has(p.id));
        
        html += `
            <div class="team-card ${teamColors[name] || ''}">
                <h4>Команда ${name} (${team.players.length}/5)</h4>
                <div>
                    ${team.players.map(p => `
                        <span class="player-tag">
                            ${p.name}
                            <button onclick="removeFromTeam('${name}','${p.id}')" style="border:none;background:none;color:#ef4444;cursor:pointer;">✕</button>
                        </span>
                    `).join('')}
                    ${team.players.length < 5 ? '<div class="empty-slot">+ свободное место</div>' : ''}
                </div>
                ${team.players.length < 5 ? `
                    <select onchange="addToTeam('${name}', this.value)">
                        <option value="">+ Добавить игрока</option>
                        ${availablePlayers.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
                    </select>
                ` : ''}
            </div>
        `;
    }
    html += '</div>';
    container.innerHTML = html;
}

// --- ПРИНУДИТЕЛЬНОЕ СОЗДАНИЕ КОМАНД ---
async function forceCreateTeams() {
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
        loadTeams();
    } catch (e) {
        alert('❌ Ошибка: ' + e.message);
    }
}

async function addToTeam(teamName, playerId) {
    if (!playerId) return;
    const team = teamData[teamName];
    if (!team) return;
    
    if (team.players.length >= 5) {
        alert('В команде уже 5 игроков!');
        return;
    }
    
    try {
        await supabaseRequest('/rest/v1/team_players', 'POST', [{
            team_id: team.id,
            player_id: playerId
        }]);
        loadTeams();
    } catch (e) {
        alert('❌ ' + e.message);
    }
}

async function removeFromTeam(teamName, playerId) {
    if (!confirm('Убрать игрока из команды?')) return;
    const team = teamData[teamName];
    if (!team) return;
    
    try {
        await supabaseRequest(`/rest/v1/team_players?team_id=eq.${team.id}&player_id=eq.${playerId}`, 'DELETE');
        loadTeams();
    } catch (e) {
        alert('❌ ' + e.message);
    }
}

async function autoFillTeams() {
    if (!currentTournamentId) return alert('Сначала выберите турнир!');
    if (allPlayers.length < 9) return alert('Нужно минимум 9 игроков для 3 команд!');
    
    // Проверяем, что все 3 команды существуют
    const teamNames = ['А', 'Б', 'В'];
    for (const name of teamNames) {
        if (!teamData[name]) {
            alert('❌ Команда ' + name + ' не создана! Нажмите "Создать команды"');
            return;
        }
    }
    
    try {
        // Очищаем все составы
        for (const team of Object.values(teamData)) {
            for (const p of team.players) {
                await supabaseRequest(`/rest/v1/team_players?team_id=eq.${team.id}&player_id=eq.${p.id}`, 'DELETE');
            }
        }
        
        // Перемешиваем и распределяем
        const shuffled = [...allPlayers].sort(() => Math.random() - 0.5);
        let idx = 0;
        for (const player of shuffled) {
            const name = teamNames[idx % teamNames.length];
            const team = teamData[name];
            await supabaseRequest('/rest/v1/team_players', 'POST', [{
                team_id: team.id,
                player_id: player.id
            }]);
            idx++;
        }
        
        loadTeams();
        alert('✅ Игроки распределены по командам!');
    } catch (e) {
        alert('❌ ' + e.message);
    }
}

async function clearTeams() {
    if (!confirm('Очистить все составы?')) return;
    try {
        for (const team of Object.values(teamData)) {
            for (const p of team.players) {
                await supabaseRequest(`/rest/v1/team_players?team_id=eq.${team.id}&player_id=eq.${p.id}`, 'DELETE');
            }
        }
        loadTeams();
        alert('✅ Все составы очищены!');
    } catch (e) {
        alert('❌ ' + e.message);
    }
}
