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
        
        if (!matches || matches.length === 0) {
            container.innerHTML = '<p class="empty">Нет матчей. Нажмите "Создать матчи"</p>';
            statusEl.textContent = 'ℹ️ Нет матчей';
            statusEl.className = 'status success';
            return;
        }
        
        const teamMap = {};
        teams.forEach(t => teamMap[t.id] = t.team_name);
        
        // Используем DocumentFragment для лучшей производительности
        const fragment = document.createDocumentFragment();
        const wrapper = document.createElement('div');
        wrapper.style.display = 'grid';
        wrapper.style.gap = '10px';
        
        matches.forEach(m => {
            const row = document.createElement('div');
            row.className = 'match-row';
            row.innerHTML = `
                <span style="font-weight:600;min-width:60px;">Матч ${m.match_number}</span>
                <span class="team-name">${teamMap[m.team_a_id] || '❌'}</span>
                <input type="number" min="0" value="${m.score_a || 0}" 
                       onchange="updateMatchScore('${m.id}','a',this.value)" 
                       ${m.is_finished ? 'disabled' : ''} 
                       style="width:60px;padding:4px;border:1px solid #d1d5db;border-radius:6px;" />
                <span>:</span>
                <input type="number" min="0" value="${m.score_b || 0}" 
                       onchange="updateMatchScore('${m.id}','b',this.value)" 
                       ${m.is_finished ? 'disabled' : ''} 
                       style="width:60px;padding:4px;border:1px solid #d1d5db;border-radius:6px;" />
                <span class="team-name">${teamMap[m.team_b_id] || '❌'}</span>
                <span class="status-text ${m.is_finished ? 'done' : 'pending'}">
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
        // Проверяем наличие завершенных матчей
        const existingMatches = await supabaseRequest(`/rest/v1/matches?select=is_finished&tournament_id=eq.${tournamentId}`);
        const hasFinished = existingMatches?.some(m => m.is_finished);
        
        if (hasFinished && !confirm('⚠️ Есть завершенные матчи. Их удаление приведет к потере данных. Продолжить?')) {
            return;
        }
        
        const teams = await supabaseRequest(`/rest/v1/tournament_teams?select=*&tournament_id=eq.${tournamentId}`);
        if (!teams || teams.length < 3) {
            return alert('❌ Нужно минимум 3 команды! Сначала создайте команды в разделе "Команды"');
        }
        
        // Удаляем старые матчи
        await supabaseRequest(`/rest/v1/matches?tournament_id=eq.${tournamentId}`, 'DELETE');
        
        // Генерируем все пары команд (круговой турнир)
        const pairs = [];
        for (let i = 0; i < teams.length; i++) {
            for (let j = 0; j < teams.length; j++) {
                if (i !== j) {
                    pairs.push([teams[i].id, teams[j].id]);
                }
            }
        }
        
        // Перемешиваем для случайного порядка (опционально)
        // pairs.sort(() => Math.random() - 0.5);
        
        let matchNum = 1;
        let created = 0;
        
        // Создаем матчи пачками для улучшения производительности
        const batchSize = 50;
        for (let i = 0; i < pairs.length; i += batchSize) {
            const batch = pairs.slice(i, i + batchSize).map(([teamA, teamB]) => ({
                tournament_id: tournamentId,
                team_a_id: teamA,
                team_b_id: teamB,
                match_number: matchNum++,
                is_finished: false
            }));
            await supabaseRequest('/rest/v1/matches', 'POST', batch);
            created += batch.length;
        }
        
        alert(`✅ Создано ${created} матчей для ${teams.length} команд!`);
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
        alert('Счет не может быть отрицательным');
        return;
    }
    
    try {
        await supabaseRequest(`/rest/v1/matches?id=eq.${matchId}`, 'PATCH', { [field]: score });
        // Показываем визуальную обратную связь
        const input = document.querySelector(`input[onchange*="updateMatchScore('${matchId}','${side}']`);
        if (input) {
            input.style.borderColor = '#22c55e';
            setTimeout(() => input.style.borderColor = '#d1d5db', 1000);
        }
    } catch (e) { 
        console.error('Ошибка обновления счета:', e);
        alert('❌ Ошибка при обновлении счета: ' + e.message);
    }
}

async function finishMatch(matchId) {
    if (!confirm('Завершить этот матч?')) return;
    
    try {
        await supabaseRequest(`/rest/v1/matches?id=eq.${matchId}`, 'PATCH', { is_finished: true });
        await loadMatches();
        alert('✅ Матч завершен!');
    } catch (e) { 
        alert('❌ ' + e.message); 
    }
}

async function finishTournament() {
    if (!confirm('🏁 Завершить турнир? Это действие нельзя отменить!')) return;
    
    try {
        await supabaseRequest(`/rest/v1/tournaments?id=eq.${currentMatchTournamentId}`, 'PATCH', { status: 'finished' });
        alert('🏆 Турнир завершен!');
        await loadMatches();
    } catch (e) { 
        alert('❌ ' + e.message); 
    }
}
