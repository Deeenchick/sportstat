// ============================================================
// МАТЧИ (3 команды: А, Б, В)
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
                <select id="matchTournamentSelect" onchange="loadMatches()" style="min-width: 200px;">
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
            
            // Восстанавливаем выбранный турнир
            const savedTournament = localStorage.getItem('selectedTournament');
            if (savedTournament && data.some(t => t.id === savedTournament)) {
                select.value = savedTournament;
                await loadMatches();
            }
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
    localStorage.setItem('selectedTournament', tournamentId);
    container.innerHTML = '<p>⏳ Загрузка...</p>';
    statusEl.textContent = '⏳ Загрузка матчей...';
    statusEl.className = 'status loading';
    
    try {
        const [teams, matches] = await Promise.all([
            supabaseRequest(`/rest/v1/tournament_teams?select=*&tournament_id=eq.${tournamentId}`),
            supabaseRequest(`/rest/v1/matches?select=*&tournament_id=eq.${tournamentId}&order=match_number.asc`)
        ]);
        
        console.log('🏆 Команд найдено:', teams?.length || 0);
        console.log('⚽ Матчей найдено:', matches?.length || 0);
        
        // Проверяем, что есть ровно 3 команды
        if (!teams || teams.length !== 3) {
            container.innerHTML = `<p class="empty">❌ В турнире должно быть ровно 3 команды. Сейчас: ${teams?.length || 0}</p>`;
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
        
        // Проверяем, что все команды имеют названия А, Б, В (или другие, но главное - они есть)
        const teamNames = teams.map(t => t.team_name);
        console.log('📋 Команды в турнире:', teamNames.join(', '));
        
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
                ${!m.is_finished ? `<button onclick="finishMatch('${m.id}')" style="padding:6px 20px;background:#22c55e;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:600;transition:all 0.2s;">Завершить</button>` : ''}
            `;
            fragment.appendChild(row);
        });
        
        wrapper.appendChild(fragment);
        container.innerHTML = '';
        container.appendChild(wrapper);
        
        // Добавляем информационную панель и кнопки
        const actionsDiv = document.createElement('div');
        actionsDiv.style.cssText = 'margin-top:20px;padding:16px;background:#f1f5f9;border-radius:10px;display:flex;gap:12px;flex-wrap:wrap;align-items:center;';
        
        const finishedCount = matches.filter(m => m.is_finished).length;
        actionsDiv.innerHTML = `
            <span style="font-weight:500;">📊 Прогресс: ${finishedCount}/${matches.length} матчей завершено</span>
            <div style="flex:1;"></div>
            <button onclick="finishTournament()" style="padding:10px 24px;background:#ef4444;color:white;border:none;border-radius:10px;cursor:pointer;font-weight:600;transition:all 0.2s;">
                🏁 Завершить турнир
            </button>
        `;
        container.appendChild(actionsDiv);
        
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
    if (!tournamentId) return alert('❌ Выберите турнир!');
    
    try {
        // Проверяем наличие завершенных матчей
        const existingMatches = await supabaseRequest(`/rest/v1/matches?select=is_finished&tournament_id=eq.${tournamentId}`);
        const hasFinished = existingMatches?.some(m => m.is_finished);
        
        if (hasFinished && !confirm('⚠️ Есть завершенные матчи. Их удаление приведет к потере данных. Продолжить?')) {
            return;
        }
        
        // Получаем команды турнира
        const teams = await supabaseRequest(`/rest/v1/tournament_teams?select=*&tournament_id=eq.${tournamentId}`);
        
        if (!teams || teams.length !== 3) {
            return alert(`❌ В турнире должно быть ровно 3 команды! Сейчас: ${teams?.length || 0}. Создайте команды в разделе "Команды"`);
        }
        
        // Сортируем команды по названию для консистентности
        teams.sort((a, b) => a.team_name.localeCompare(b.team_name));
        
        // Создаем карту команд по их названиям (А, Б, В)
        const teamMap = {};
        teams.forEach(t => {
            teamMap[t.team_name] = t.id;
        });
        
        console.log('📋 Команды в турнире:', teams.map(t => t.team_name).join(', '));
        
        // Удаляем старые матчи
        await supabaseRequest(`/rest/v1/matches?tournament_id=eq.${tournamentId}`, 'DELETE');
        
        // Фиксированные пары для 3 команд (каждая с каждой играет по 4 раза = 12 матчей)
        // Для команд А, Б, В
        const teamPairs = [
            ['А', 'Б'], ['А', 'В'], ['Б', 'В'],  // 1 круг
            ['Б', 'А'], ['В', 'А'], ['В', 'Б'],  // 2 круг
            ['А', 'Б'], ['А', 'В'], ['Б', 'В'],  // 3 круг
            ['Б', 'А'], ['В', 'А'], ['В', 'Б']   // 4 круг
        ];
        
        // Проверяем, что все команды существуют
        let matchNum = 1;
        let created = 0;
        let skipped = 0;
        
        for (const [teamAName, teamBName] of teamPairs) {
            const teamAId = teamMap[teamAName];
            const teamBId = teamMap[teamBName];
            
            if (teamAId && teamBId) {
                await supabaseRequest('/rest/v1/matches', 'POST', [{
                    tournament_id: tournamentId,
                    team_a_id: teamAId,
                    team_b_id: teamBId,
                    match_number: matchNum++,
                    is_finished: false
                }]);
                created++;
            } else {
                skipped++;
                console.warn(`⚠️ Команда не найдена: ${!teamAId ? teamAName : ''} ${!teamBId ? teamBName : ''}`);
            }
        }
        
        if (skipped > 0) {
            alert(`⚠️ Создано ${created} матчей, но ${skipped} пропущено из-за отсутствия команд. Проверьте названия команд (должны быть А, Б, В)`);
        } else {
            alert(`✅ Создано ${created} матчей для команд: ${teams.map(t => t.team_name).join(', ')}`);
        }
        
        await loadMatches();
    } catch (e) {
        console.error('❌ Ошибка:', e);
        alert('❌ Ошибка: ' + e.message);
    }
}

async function updateMatchScore(matchId, side, value) {
    const field = side === 'a' ? 'score_a' : 'score_b';
    const score = parseInt(value) || 0;
    
    if (score < 0) {
        alert('❌ Счет не может быть отрицательным');
        // Возвращаем предыдущее значение
        const input = document.querySelector(`input[onchange*="updateMatchScore('${matchId}','${side}']`);
        if (input) {
            // Находим текущий счет из БД
            try {
                const match = await supabaseRequest(`/rest/v1/matches?select=${field}&id=eq.${matchId}`);
                if (match && match[0]) {
                    input.value = match[0][field] || 0;
                }
            } catch (e) {
                console.error('Ошибка получения текущего счета:', e);
            }
        }
        return;
    }
    
    try {
        await supabaseRequest(`/rest/v1/matches?id=eq.${matchId}`, 'PATCH', { [field]: score });
        
        // Визуальная обратная связь
        const input = document.querySelector(`input[onchange*="updateMatchScore('${matchId}','${side}']`);
        if (input) {
            input.style.borderColor = '#22c55e';
            input.style.borderWidth = '3px';
            setTimeout(() => {
                input.style.borderColor = '#d1d5db';
                input.style.borderWidth = '2px';
            }, 1000);
        }
    } catch (e) { 
        console.error('Ошибка обновления счета:', e);
        alert('❌ Ошибка при обновлении счета: ' + e.message);
    }
}

async function finishMatch(matchId) {
    if (!confirm('✅ Завершить этот матч?')) return;
    
    try {
        // Проверяем, что счет введен
        const match = await supabaseRequest(`/rest/v1/matches?select=score_a,score_b&id=eq.${matchId}`);
        if (match && match[0]) {
            if (match[0].score_a === null || match[0].score_b === null || 
                match[0].score_a === undefined || match[0].score_b === undefined) {
                if (!confirm('⚠️ У матча не введен счет. Завершить матч со счетом 0:0?')) {
                    return;
                }
                // Устанавливаем счёт 0:0 если не задан
                await supabaseRequest(`/rest/v1/matches?id=eq.${matchId}`, 'PATCH', { 
                    score_a: 0, 
                    score_b: 0 
                });
            }
        }
        
        await supabaseRequest(`/rest/v1/matches?id=eq.${matchId}`, 'PATCH', { is_finished: true });
        await loadMatches();
        alert('✅ Матч завершен!');
    } catch (e) { 
        alert('❌ Ошибка: ' + e.message); 
    }
}

async function finishTournament() {
    if (!confirm('🏁 Завершить турнир? Это действие нельзя отменить!')) return;
    
    try {
        // Проверяем, все ли матчи завершены
        const matches = await supabaseRequest(`/rest/v1/matches?select=is_finished&tournament_id=eq.${currentMatchTournamentId}`);
        const unfinished = matches?.filter(m => !m.is_finished) || [];
        
        if (unfinished.length > 0) {
            if (!confirm(`⚠️ Осталось ${unfinished.length} незавершенных матчей. Завершить турнир без их завершения?`)) {
                return;
            }
        }
        
        await supabaseRequest(`/rest/v1/tournaments?id=eq.${currentMatchTournamentId}`, 'PATCH', { status: 'finished' });
        alert('🏆 Турнир завершен!');
        await loadMatches();
    } catch (e) { 
        alert('❌ Ошибка: ' + e.message); 
    }
}
