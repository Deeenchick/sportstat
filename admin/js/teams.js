// ============================================================
// КОМАНДЫ (ИСПРАВЛЕННЫЙ)
// ============================================================

const MAX_PLAYERS_PER_TEAM = 5;
const TEAM_NAMES = ['А', 'Б', 'В'];
let currentTournamentId = null;
let allPlayers = [];
let teamData = {};

async function loadTeamsPage() {
    const container = document.getElementById('page-teams');
    if (!container) {
        console.error('❌ Контейнер page-teams не найден');
        return;
    }
    
    container.innerHTML = `
        <div class="card">
            <h2>👥 Формирование команд</h2>
            <div id="teamsStatus" class="status loading">⏳ Загрузка...</div>
            
            <!-- Управление -->
            <div style="display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 16px; align-items: center;">
                <select id="teamsTournamentSelect" onchange="loadTeams()" style="min-width: 200px; padding: 8px 12px; border: 2px solid #d1d5db; border-radius: 6px;">
                    <option value="">Выберите турнир...</option>
                </select>
                <button onclick="forceCreateTeams()" style="padding: 8px 20px; background: #f59e0b; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">
                    🔧 Создать команды
                </button>
                <button onclick="autoFillTeams()" style="padding: 8px 20px; background: #8b5cf6; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">
                    ⚡ Заполнить случайно
                </button>
                <button onclick="clearTeams()" style="padding: 8px 20px; background: #ef4444; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">
                    🗑️ Очистить все
                </button>
                <button onclick="checkTeamBalance()" style="padding: 8px 20px; background: #3b82f6; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">
                    ⚖️ Проверить баланс
                </button>
            </div>
            
            <!-- Список команд -->
            <div id="teamsContainer"><p class="empty">Выберите турнир</p></div>
            
            <!-- Статистика -->
            <div id="teamsStats" style="margin-top: 16px; padding: 12px; background: #f1f5f9; border-radius: 8px; display: none;">
                <div style="display: flex; justify-content: space-between; flex-wrap: wrap; gap: 10px;">
                    <span id="totalPlayersStat">👥 Всего игроков: 0</span>
                    <span id="teamsStatusStat">🏆 Команд: 0</span>
                    <span id="balanceStat">⚖️ Баланс: ✅ Идеально</span>
                </div>
            </div>
        </div>
    `;
    
    // Загружаем турниры для select
    await loadTournamentsForSelect('teamsTournamentSelect');
    
    // Проверяем, есть ли сохраненный турнир
    const savedTournament = localStorage.getItem('selectedTournament');
    const select = document.getElementById('teamsTournamentSelect');
    if (select && savedTournament) {
        select.value = savedTournament;
        await loadTeams();
    }
}

async function loadTeams() {
    const select = document.getElementById('teamsTournamentSelect');
    if (!select) {
        console.error('❌ select не найден');
        return;
    }
    
    const tournamentId = select.value;
    const container = document.getElementById('teamsContainer');
    const statusEl = document.getElementById('teamsStatus');
    
    if (!container || !statusEl) {
        console.error('❌ Контейнеры не найдены');
        return;
    }
    
    if (!tournamentId) {
        container.innerHTML = '<p class="empty">Выберите турнир</p>';
        const statsEl = document.getElementById('teamsStats');
        if (statsEl) statsEl.style.display = 'none';
        return;
    }
    
    currentTournamentId = tournamentId;
    localStorage.setItem('selectedTournament', tournamentId);
    
    container.innerHTML = '<p>⏳ Загрузка...</p>';
    statusEl.textContent = '⏳ Загрузка команд...';
    statusEl.className = 'status loading';

    try {
        // Загружаем всех игроков
        allPlayers = await supabaseRequest('/rest/v1/players?select=*&order=name.asc');
        console.log('✅ Игроков:', allPlayers.length);

        // Загружаем команды турнира
        let teams = await supabaseRequest(`/rest/v1/tournament_teams?select=*&tournament_id=eq.${tournamentId}`);
        console.log('🏆 Команд найдено:', teams?.length || 0);
        
        // Если команд нет - создаем автоматически
        if (!teams || teams.length === 0) {
            console.log('⚠️ Команд нет, создаем...');
            for (const name of TEAM_NAMES) {
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

        if (!teams || teams.length === 0) {
            container.innerHTML = '<p class="empty">❌ Не удалось создать команды</p>';
            statusEl.textContent = '❌ Ошибка: команды не созданы';
            statusEl.className = 'status error';
            const statsEl = document.getElementById('teamsStats');
            if (statsEl) statsEl.style.display = 'none';
            return;
        }

        // Загружаем игроков команд
        const teamIds = teams.map(t => t.id).join(',');
        let teamPlayers = [];
        if (teamIds) {
            teamPlayers = await supabaseRequest(`/rest/v1/team_players?select=*,player:players(name)&team_id=in.(${teamIds})`);
        }

        // Формируем структуру данных
        teamData = {};
        teams.forEach(t => {
            teamData[t.team_name] = { 
                id: t.id, 
                name: t.team_name, 
                players: [],
                stats: {
                    wins: t.wins || 0,
                    draws: t.draws || 0,
                    losses: t.losses || 0,
                    goals_for: t.goals_for || 0,
                    goals_against: t.goals_against || 0,
                    points: t.points || 0
                }
            };
        });
        
        teamPlayers.forEach(tp => {
            const teamName = teams.find(t => t.id === tp.team_id)?.team_name;
            if (teamName && teamData[teamName]) {
                const player = allPlayers.find(p => p.id === tp.player_id);
                if (player) teamData[teamName].players.push(player);
            }
        });

        // Обновляем статистику команд на основе матчей
        await updateTeamsStatistics(tournamentId);

        renderTeams();
        updateStatsDisplay();

        statusEl.textContent = '✅ Команды загружены';
        statusEl.className = 'status success';

    } catch (e) {
        console.error('❌ Ошибка:', e);
        statusEl.textContent = '❌ ' + e.message;
        statusEl.className = 'status error';
        container.innerHTML = '<p class="empty">❌ Ошибка: ' + e.message + '</p>';
        const statsEl = document.getElementById('teamsStats');
        if (statsEl) statsEl.style.display = 'none';
    }
}

// Остальные функции (renderTeams, updateTeamsStatistics, etc.) остаются без изменений
