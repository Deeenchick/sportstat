// ============================================================
// КОМАНДЫ
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
    
    // Восстанавливаем сохраненный турнир
    try {
        const data = await supabaseRequest('/rest/v1/tournaments?select=id,title,status&order=created_at.desc');
        const select = document.getElementById('teamsTournamentSelect');
        if (select) {
            select.innerHTML = '<option value="">Выберите турнир...</option>' +
                data.map(t => `<option value="${t.id}">${t.title || 'Турнир'} (${t.status})</option>`).join('');
            
            const savedTournament = localStorage.getItem('selectedTournament');
            if (savedTournament && data.some(t => t.id === savedTournament)) {
                select.value = savedTournament;
                await loadTeams();
            }
        }
        setStatus('teamsStatus', '✅ Выберите турнир', 'success');
    } catch (e) {
        console.error('❌ Ошибка загрузки турниров:', e);
        setStatus('teamsStatus', '❌ ' + e.message, 'error');
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
        document.getElementById('teamsStats').style.display = 'none';
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
            document.getElementById('teamsStats').style.display = 'none';
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
        document.getElementById('teamsStats').style.display = 'none';
    }
}

async function updateTeamsStatistics(tournamentId) {
    try {
        // Получаем все завершенные матчи турнира
        const matches = await supabaseRequest(`/rest/v1/matches?select=*&tournament_id=eq.${tournamentId}&is_finished=eq.true`);
        
        if (!matches || matches.length === 0) {
            console.log('ℹ️ Нет завершенных матчей для обновления статистики');
            return;
        }

        // Инициализируем статистику для каждой команды
        const stats = {};
        for (const team of Object.values(teamData)) {
            stats[team.id] = {
                wins: 0,
                draws: 0,
                losses: 0,
                goals_for: 0,
                goals_against: 0,
                points: 0
            };
        }

        // Обрабатываем каждый матч
        for (const match of matches) {
            const teamAId = match.team_a_id;
            const teamBId = match.team_b_id;
            const scoreA = match.score_a || 0;
            const scoreB = match.score_b || 0;

            // Обновляем голы
            if (stats[teamAId]) {
                stats[teamAId].goals_for += scoreA;
                stats[teamAId].goals_against += scoreB;
            }
            if (stats[teamBId]) {
                stats[teamBId].goals_for += scoreB;
                stats[teamBId].goals_against += scoreA;
            }

            // Определяем победителя
            if (scoreA > scoreB) {
                if (stats[teamAId]) stats[teamAId].wins++;
                if (stats[teamBId]) stats[teamBId].losses++;
            } else if (scoreA < scoreB) {
                if (stats[teamAId]) stats[teamAId].losses++;
                if (stats[teamBId]) stats[teamBId].wins++;
            } else {
                if (stats[teamAId]) stats[teamAId].draws++;
                if (stats[teamBId]) stats[teamBId].draws++;
            }
        }

        // Вычисляем очки (победа = 3, ничья = 1)
        for (const teamId in stats) {
            stats[teamId].points = (stats[teamId].wins * 3) + (stats[teamId].draws * 1);
        }

        // Обновляем статистику в БД
        for (const team of Object.values(teamData)) {
            const teamStats = stats[team.id];
            if (teamStats) {
                await supabaseRequest(`/rest/v1/tournament_teams?id=eq.${team.id}`, 'PATCH', {
                    wins: teamStats.wins,
                    draws: teamStats.draws,
                    losses: teamStats.losses,
                    goals_for: teamStats.goals_for,
                    goals_against: teamStats.goals_against,
                    points: teamStats.points
                });
                
                // Обновляем локальные данные
                team.stats = teamStats;
            }
        }

        console.log('✅ Статистика команд обновлена');

    } catch (e) {
        console.error('❌ Ошибка обновления статистики:', e);
    }
}

function renderTeams() {
    const container = document.getElementById('teamsContainer');
    if (!container) return;
    
    const teamColors = { 'А': 'team-a', 'Б': 'team-b', 'В': 'team-c' };
    
    let html = '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px;">';
    
    for (const name of TEAM_NAMES) {
        const team = teamData[name];
        if (!team) {
            html += `
                <div style="background: #f1f5f9; border-radius: 12px; padding: 20px; border: 2px dashed #cbd5e1;">
                    <h4 style="margin: 0 0 12px 0; color: #475569;">Команда ${name}</h4>
                    <div style="color: #94a3b8; text-align: center; padding: 20px 0;">
                        ❌ Команда не создана
                    </div>
                </div>
            `;
            continue;
        }
        
        const playerCount = team.players.length;
        const isFull = playerCount >= MAX_PLAYERS_PER_TEAM;
        const fillPercentage = (playerCount / MAX_PLAYERS_PER_TEAM) * 100;
        
        // Получаем доступных игроков (не в других командах)
        const usedPlayers = new Set();
        for (const t of Object.values(teamData)) {
            if (t.name !== name) {
                t.players.forEach(p => usedPlayers.add(p.id));
            }
        }
        const availablePlayers = allPlayers.filter(p => !usedPlayers.has(p.id));
        
        // Цвета для команд
        const colors = {
            'А': { bg: '#eff6ff', border: '#3b82f6', header: '#1e40af' },
            'Б': { bg: '#f0fdf4', border: '#22c55e', header: '#166534' },
            'В': { bg: '#fef2f2', border: '#ef4444', header: '#991b1b' }
        };
        const color = colors[name] || colors['А'];
        
        html += `
            <div style="background: ${color.bg}; border-radius: 12px; padding: 20px; border: 2px solid ${color.border};">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <h4 style="margin: 0; color: ${color.header}; font-size: 18px;">Команда ${name}</h4>
                    <span style="font-size: 14px; font-weight: 600; color: ${isFull ? '#22c55e' : '#f59e0b'};">
                        ${playerCount}/${MAX_PLAYERS_PER_TEAM}
                    </span>
                </div>
                
                <!-- Прогресс-бар -->
                <div style="width: 100%; height: 8px; background: #e2e8f0; border-radius: 4px; margin-bottom: 12px; overflow: hidden;">
                    <div style="width: ${fillPercentage}%; height: 100%; background: ${isFull ? '#22c55e' : '#3b82f6'}; transition: width 0.3s;"></div>
                </div>
                
                <!-- Игроки -->
                <div style="min-height: 60px; margin-bottom: 12px;">
                    ${team.players.length > 0 ? 
                        team.players.map(p => `
                            <span style="display: inline-flex; align-items: center; background: white; padding: 4px 8px 4px 12px; border-radius: 16px; margin: 4px; font-size: 14px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                                ${escapeHtml(p.name)}
                                <button onclick="removeFromTeam('${name}','${p.id}')" 
                                        style="margin-left: 6px; border: none; background: none; color: #ef4444; cursor: pointer; font-size: 16px; padding: 0 4px;"
                                        title="Убрать из команды">✕</button>
                            </span>
                        `).join('') 
                    : 
                        '<span style="color: #94a3b8; font-size: 14px;">Нет игроков</span>'
                    }
                </div>
                
                <!-- Статистика команды -->
                ${team.stats ? `
                    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; background: white; border-radius: 8px; padding: 10px; margin-bottom: 12px; font-size: 12px;">
                        <div style="text-align: center;">
                            <div style="font-weight: 700; color: #22c55e;">${team.stats.wins}</div>
                            <div style="color: #6b7280;">Побед</div>
                        </div>
                        <div style="text-align: center;">
                            <div style="font-weight: 700; color: #f59e0b;">${team.stats.draws}</div>
                            <div style="color: #6b7280;">Ничьи</div>
                        </div>
                        <div style="text-align: center;">
                            <div style="font-weight: 700; color: #ef4444;">${team.stats.losses}</div>
                            <div style="color: #6b7280;">Пораж.</div>
                        </div>
                        <div style="text-align: center;">
                            <div style="font-weight: 700; color: #3b82f6;">${team.stats.points}</div>
                            <div style="color: #6b7280;">Очки</div>
                        </div>
                    </div>
                ` : ''}
                
                <!-- Добавление игрока -->
                ${!isFull ? `
                    <div style="display: flex; gap: 8px;">
                        <select onchange="addToTeam('${name}', this.value)" 
                                style="flex: 1; padding: 6px 10px; border: 2px solid #d1d5db; border-radius: 6px; font-size: 14px; background: white;">
                            <option value="">+ Добавить игрока</option>
                            ${availablePlayers.map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('')}
                        </select>
                    </div>
                ` : `
                    <div style="background: #dcfce7; color: #166534; padding: 6px 12px; border-radius: 6px; text-align: center; font-size: 14px; font-weight: 600;">
                        ✅ Команда укомплектована
                    </div>
                `}
            </div>
        `;
    }
    html += '</div>';
    container.innerHTML = html;
}

function updateStatsDisplay() {
    const statsEl = document.getElementById('teamsStats');
    if (!statsEl) return;
    
    const totalPlayers = Object.values(teamData).reduce((sum, team) => sum + team.players.length, 0);
    const teamCount = Object.keys(teamData).length;
    
    // Проверяем баланс
    const playerCounts = Object.values(teamData).map(t => t.players.length);
    const isBalanced = playerCounts.every(count => count === playerCounts[0]);
    const isFull = playerCounts.every(count => count === MAX_PLAYERS_PER_TEAM);
    
    let balanceText = '⚖️ Баланс: ';
    if (isFull && isBalanced) {
        balanceText += '✅ Идеально! Все команды полные';
    } else if (isBalanced) {
        balanceText += `✅ Сбалансировано (по ${playerCounts[0]} игроков)`;
    } else {
        balanceText += `⚠️ Несбалансировано (${playerCounts.join(', ')})`;
    }
    
    document.getElementById('totalPlayersStat').textContent = `👥 Всего игроков: ${totalPlayers}`;
    document.getElementById('teamsStatusStat').textContent = `🏆 Команд: ${teamCount}`;
    document.getElementById('balanceStat').textContent = balanceText;
    
    statsEl.style.display = 'block';
}

function checkTeamBalance() {
    const counts = Object.values(teamData).map(t => ({
        name: t.name,
        count: t.players.length
    }));
    
    const sorted = counts.sort((a, b) => a.count - b.count);
    const min = sorted[0]?.count || 0;
    const max = sorted[sorted.length - 1]?.count || 0;
    
    let message = '📊 Баланс команд:\n\n';
    counts.forEach(c => {
        message += `Команда ${c.name}: ${c.count}/${MAX_PLAYERS_PER_TEAM} игроков\n`;
    });
    
    if (min === max && min === MAX_PLAYERS_PER_TEAM) {
        message += '\n✅ Отлично! Все команды полностью укомплектованы!';
    } else if (min === max) {
        message += `\n✅ Хорошо! Во всех командах по ${min} игроков`;
    } else {
        message += `\n⚠️ Разница: ${max - min} игроков. Нужно перераспределить!`;
    }
    
    alert(message);
}

async function forceCreateTeams() {
    const select = document.getElementById('teamsTournamentSelect');
    if (!select) return;
    const tournamentId = select.value;
    if (!tournamentId) return alert('❌ Сначала выберите турнир!');
    
    try {
        // Проверяем, есть ли уже команды
        const existing = await supabaseRequest(`/rest/v1/tournament_teams?select=id&tournament_id=eq.${tournamentId}`);
        if (existing && existing.length > 0) {
            if (!confirm('⚠️ Команды уже существуют. Удалить старые и создать новые?')) {
                return;
            }
            // Удаляем старые команды
            for (const team of existing) {
                await supabaseRequest(`/rest/v1/tournament_teams?id=eq.${team.id}`, 'DELETE');
            }
        }
        
        // Создаем новые команды
        for (const name of TEAM_NAMES) {
            await supabaseRequest('/rest/v1/tournament_teams', 'POST', [{
                tournament_id: tournamentId,
                team_name: name,
                wins: 0, draws: 0, losses: 0,
                goals_for: 0, goals_against: 0, points: 0
            }]);
        }
        alert(`✅ Команды ${TEAM_NAMES.join(', ')} созданы!`);
        await loadTeams();
    } catch (e) {
        alert('❌ Ошибка: ' + e.message);
    }
}

async function addToTeam(teamName, playerId) {
    if (!playerId) return;
    
    const team = teamData[teamName];
    if (!team) {
        alert('❌ Команда ' + teamName + ' не создана');
        return;
    }
    
    // Проверяем, не в другой ли команде игрок
    for (const [name, t] of Object.entries(teamData)) {
        if (t.players.some(p => p.id === playerId)) {
            alert(`⚠️ Игрок уже в команде ${name}`);
            // Сбрасываем select
            const select = document.querySelector(`select[onchange*="addToTeam('${teamName}']`);
            if (select) select.value = '';
            return;
        }
    }
    
    if (team.players.length >= MAX_PLAYERS_PER_TEAM) {
        alert(`⚠️ В команде уже ${MAX_PLAYERS_PER_TEAM} игроков!`);
        const select = document.querySelector(`select[onchange*="addToTeam('${teamName}']`);
        if (select) select.value = '';
        return;
    }
    
    try {
        await supabaseRequest('/rest/v1/team_players', 'POST', [{
            team_id: team.id,
            player_id: playerId
        }]);
        await loadTeams();
    } catch (e) {
        alert('❌ ' + e.message);
    }
}

async function removeFromTeam(teamName, playerId) {
    const team = teamData[teamName];
    if (!team) return;
    
    const player = team.players.find(p => p.id === playerId);
    if (!player) return;
    
    if (!confirm(`Убрать игрока "${player.name}" из команды ${teamName}?`)) return;
    
    try {
        await supabaseRequest(`/rest/v1/team_players?team_id=eq.${team.id}&player_id=eq.${playerId}`, 'DELETE');
        await loadTeams();
    } catch (e) {
        alert('❌ ' + e.message);
    }
}

async function autoFillTeams() {
    if (!currentTournamentId) return alert('❌ Сначала выберите турнир!');
    
    const requiredPlayers = TEAM_NAMES.length * MAX_PLAYERS_PER_TEAM;
    if (allPlayers.length < requiredPlayers) {
        return alert(`❌ Нужно минимум ${requiredPlayers} игроков для ${TEAM_NAMES.length} команд по ${MAX_PLAYERS_PER_TEAM} игроков! Сейчас: ${allPlayers.length}`);
    }
    
    // Проверяем, что все команды созданы
    for (const name of TEAM_NAMES) {
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
        
        // Перемешиваем игроков
        const shuffled = [...allPlayers].sort(() => Math.random() - 0.5);
        
        // Распределяем по командам равномерно
        let idx = 0;
        for (const player of shuffled) {
            // Пропускаем, если команда уже заполнена
            let attempts = 0;
            let teamName = TEAM_NAMES[idx % TEAM_NAMES.length];
            while (teamData[teamName].players.length >= MAX_PLAYERS_PER_TEAM && attempts < TEAM_NAMES.length) {
                idx++;
                attempts++;
                teamName = TEAM_NAMES[idx % TEAM_NAMES.length];
            }
            
            if (attempts >= TEAM_NAMES.length) break; // Все команды заполнены
            
            const team = teamData[teamName];
            await supabaseRequest('/rest/v1/team_players', 'POST', [{
                team_id: team.id,
                player_id: player.id
            }]);
            idx++;
        }
        
        await loadTeams();
        
        // Проверяем, все ли команды заполнены
        const allFull = Object.values(teamData).every(t => t.players.length === MAX_PLAYERS_PER_TEAM);
        if (allFull) {
            alert(`✅ Все команды полностью укомплектованы по ${MAX_PLAYERS_PER_TEAM} игроков!`);
        } else {
            const counts = Object.values(teamData).map(t => `${t.name}: ${t.players.length}`);
            alert(`⚠️ Игроки распределены, но не все команды полные:\n${counts.join('\n')}`);
        }
    } catch (e) {
        alert('❌ ' + e.message);
    }
}

async function clearTeams() {
    if (!confirm('🗑️ Очистить все составы команд?')) return;
    
    try {
        for (const team of Object.values(teamData)) {
            for (const p of team.players) {
                await supabaseRequest(`/rest/v1/team_players?team_id=eq.${team.id}&player_id=eq.${p.id}`, 'DELETE');
            }
        }
        await loadTeams();
        alert('✅ Все составы очищены!');
    } catch (e) {
        alert('❌ ' + e.message);
    }
}

// Вспомогательная функция для экранирования HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
