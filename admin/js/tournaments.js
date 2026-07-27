// ============================================================
// ТУРНИРЫ
// ============================================================

let currentFilterStatus = 'all';
let currentSearchTerm = '';

async function loadTournaments() {
    const container = document.getElementById('page-tournaments');
    if (!container) {
        console.error('❌ Контейнер page-tournaments не найден');
        return;
    }
    
    container.innerHTML = `
        <div class="card">
            <h2>🏆 Турниры</h2>
            <div id="tournamentsStatus" class="status loading">⏳ Загрузка...</div>
            
            <!-- Создание турнира -->
            <div style="background: #f8fafc; padding: 16px; border-radius: 10px; margin-bottom: 16px;">
                <h4 style="margin-bottom: 12px;">📝 Создать турнир</h4>
                <div style="display: flex; flex-wrap: wrap; gap: 10px;">
                    <input id="tournamentTitle" placeholder="Название турнира..." 
                           style="flex: 1; min-width: 200px; padding: 8px 12px; border: 2px solid #d1d5db; border-radius: 6px;" />
                    <input type="date" id="tournamentDate" 
                           style="padding: 8px 12px; border: 2px solid #d1d5db; border-radius: 6px;" />
                    <button onclick="createTournament()" style="padding: 8px 24px; background: #22c55e; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">
                        🚀 Создать
                    </button>
                </div>
            </div>
            
            <!-- Фильтры и поиск -->
            <div style="display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 16px; align-items: center;">
                <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                    <button onclick="setFilter('all')" id="filter-all" class="filter-btn active" 
                            style="padding: 6px 14px; background: #3b82f6; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 500; font-size: 13px;">
                        Все
                    </button>
                    <button onclick="setFilter('draft')" id="filter-draft" class="filter-btn"
                            style="padding: 6px 14px; background: #e2e8f0; color: #475569; border: none; border-radius: 6px; cursor: pointer; font-weight: 500; font-size: 13px;">
                        📝 Черновики
                    </button>
                    <button onclick="setFilter('active')" id="filter-active" class="filter-btn"
                            style="padding: 6px 14px; background: #e2e8f0; color: #475569; border: none; border-radius: 6px; cursor: pointer; font-weight: 500; font-size: 13px;">
                        🔄 Активные
                    </button>
                    <button onclick="setFilter('finished')" id="filter-finished" class="filter-btn"
                            style="padding: 6px 14px; background: #e2e8f0; color: #475569; border: none; border-radius: 6px; cursor: pointer; font-weight: 500; font-size: 13px;">
                        🏁 Завершены
                    </button>
                </div>
                <div style="flex: 1; min-width: 150px;">
                    <input id="tournamentSearch" placeholder="🔍 Поиск турниров..." 
                           oninput="filterTournaments()"
                           style="width: 100%; padding: 6px 12px; border: 2px solid #d1d5db; border-radius: 6px; font-size: 13px;" />
                </div>
            </div>
            
            <!-- Список турниров -->
            <div id="tournamentsListContainer">
                <ul id="tournamentsList"><li class="empty">Загрузка...</li></ul>
            </div>
        </div>
    `;
    
    await renderTournaments();
}

function setFilter(status) {
    currentFilterStatus = status;
    
    // Обновляем стили кнопок
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.style.background = '#e2e8f0';
        btn.style.color = '#475569';
    });
    
    const activeBtn = document.getElementById(`filter-${status}`);
    if (activeBtn) {
        activeBtn.style.background = '#3b82f6';
        activeBtn.style.color = 'white';
    }
    
    filterTournaments();
}

function filterTournaments() {
    const searchInput = document.getElementById('tournamentSearch');
    if (searchInput) {
        currentSearchTerm = searchInput.value.toLowerCase().trim();
    }
    
    renderTournaments();
}

async function renderTournaments() {
    const list = document.getElementById('tournamentsList');
    const statusEl = document.getElementById('tournamentsStatus');
    
    if (!list || !statusEl) return;
    
    list.innerHTML = '<li class="empty">⏳ Загрузка...</li>';
    
    try {
        let data = await supabaseRequest('/rest/v1/tournaments?select=*&order=created_at.desc');
        
        if (!data) {
            data = [];
        }
        
        // Фильтрация по статусу
        if (currentFilterStatus !== 'all') {
            data = data.filter(t => t.status === currentFilterStatus);
        }
        
        // Фильтрация по поиску
        if (currentSearchTerm) {
            data = data.filter(t => 
                t.title.toLowerCase().includes(currentSearchTerm) ||
                (t.tournament_date && t.tournament_date.includes(currentSearchTerm))
            );
        }
        
        setStatus('tournamentsStatus', `✅ Турниров: ${data.length}`, 'success');
        
        if (!data || data.length === 0) {
            let message = '📋 Нет турниров';
            if (currentFilterStatus !== 'all') {
                message += ` со статусом "${currentFilterStatus}"`;
            }
            if (currentSearchTerm) {
                message += ` по запросу "${currentSearchTerm}"`;
            }
            list.innerHTML = `<li class="empty">${message}</li>`;
            return;
        }
        
        // Загружаем статистику для каждого турнира
        const tournamentsWithStats = await Promise.all(data.map(async (t) => {
            const stats = await getTournamentStats(t.id);
            return { ...t, stats };
        }));
        
        list.innerHTML = tournamentsWithStats.map(t => renderTournamentCard(t)).join('');
        
    } catch (e) {
        console.error('❌ Ошибка загрузки турниров:', e);
        setStatus('tournamentsStatus', '❌ ' + e.message, 'error');
        list.innerHTML = '<li class="empty">❌ Ошибка загрузки</li>';
    }
}

async function getTournamentStats(tournamentId) {
    try {
        const [teams, matches, players] = await Promise.all([
            supabaseRequest(`/rest/v1/tournament_teams?select=id&tournament_id=eq.${tournamentId}`),
            supabaseRequest(`/rest/v1/matches?select=id,is_finished&tournament_id=eq.${tournamentId}`),
            supabaseRequest(`/rest/v1/team_players?select=team_id&team_id=in.((${
                teams ? teams.map(t => t.id).join(',') : ''
            }))`)
        ]);
        
        const finishedMatches = matches ? matches.filter(m => m.is_finished) : [];
        const totalPlayers = players ? players.length : 0;
        
        return {
            teamsCount: teams ? teams.length : 0,
            matchesCount: matches ? matches.length : 0,
            finishedMatches: finishedMatches.length,
            playersCount: totalPlayers
        };
    } catch (e) {
        console.error('Ошибка получения статистики:', e);
        return {
            teamsCount: 0,
            matchesCount: 0,
            finishedMatches: 0,
            playersCount: 0
        };
    }
}

function renderTournamentCard(t) {
    const statusColors = {
        draft: { bg: '#fef3c7', color: '#92400e', label: '📝 Черновик' },
        active: { bg: '#dbeafe', color: '#1e40af', label: '🔄 Активен' },
        finished: { bg: '#dcfce7', color: '#166534', label: '🏁 Завершен' }
    };
    
    const statusInfo = statusColors[t.status] || statusColors.draft;
    const stats = t.stats || { teamsCount: 0, matchesCount: 0, finishedMatches: 0, playersCount: 0 };
    
    const isDeletable = t.status === 'draft' || t.status === 'finished';
    const canEdit = t.status !== 'finished';
    
    return `
        <div style="background: white; border-radius: 10px; padding: 16px; margin-bottom: 12px; 
                    border-left: 4px solid ${statusInfo.color}; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
            <div style="display: flex; flex-wrap: wrap; justify-content: space-between; align-items: start; gap: 10px;">
                <div style="flex: 1; min-width: 200px;">
                    <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                        <div style="font-weight: 600; font-size: 16px; color: #1e293b;">${escapeHtml(t.title || 'Турнир')}</div>
                        <span style="background: ${statusInfo.bg}; color: ${statusInfo.color}; padding: 2px 10px; border-radius: 12px; font-size: 12px; font-weight: 600;">
                            ${statusInfo.label}
                        </span>
                    </div>
                    ${t.tournament_date ? `<div style="font-size: 13px; color: #6b7280; margin-top: 4px;">📅 ${formatDate(t.tournament_date)}</div>` : ''}
                    
                    <!-- Статистика -->
                    <div style="display: flex; flex-wrap: wrap; gap: 12px; margin-top: 8px; font-size: 13px; color: #475569;">
                        <span>👥 ${stats.playersCount} игроков</span>
                        <span>🏆 ${stats.teamsCount} команд</span>
                        <span>⚽ ${stats.matchesCount} матчей</span>
                        ${stats.matchesCount > 0 ? `<span>✅ ${stats.finishedMatches} завершено</span>` : ''}
                    </div>
                </div>
                
                <div style="display: flex; flex-wrap: wrap; gap: 6px; align-items: center;">
                    ${canEdit ? `
                        <button onclick="editTournament('${t.id}')" 
                                style="padding: 4px 14px; background: #f59e0b; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 13px;">
                            ✏️ Редактировать
                        </button>
                    ` : ''}
                    
                    ${t.status === 'draft' ? `
                        <button onclick="activateTournament('${t.id}')" 
                                style="padding: 4px 14px; background: #22c55e; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 13px;">
                            ▶️ Активировать
                        </button>
                    ` : ''}
                    
                    ${t.status === 'active' ? `
                        <button onclick="finishTournamentFromList('${t.id}')" 
                                style="padding: 4px 14px; background: #8b5cf6; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 13px;">
                            🏁 Завершить
                        </button>
                    ` : ''}
                    
                    <button onclick="openTournament('${t.id}')" 
                            style="padding: 4px 14px; background: #3b82f6; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 13px;">
                        📂 Открыть
                    </button>
                    
                    ${isDeletable ? `
                        <button onclick="deleteTournament('${t.id}', '${escapeHtml(t.title)}')" 
                                style="padding: 4px 10px; background: #ef4444; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 13px;">
                            ✕
                        </button>
                    ` : `
                        <span style="font-size: 12px; color: #94a3b8;" title="Нельзя удалить активный турнир">🔒</span>
                    `}
                </div>
            </div>
        </div>
    `;
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

async function createTournament() {
    const titleInput = document.getElementById('tournamentTitle');
    const dateInput = document.getElementById('tournamentDate');
    
    const title = titleInput.value.trim() || 'Турнир';
    const date = dateInput.value || new Date().toISOString().split('T')[0];
    
    const btn = document.querySelector('#page-tournaments .card .flex button');
    btn.disabled = true;
    btn.textContent = '⏳...';
    
    try {
        // Проверяем, нет ли турнира с таким названием
        const existing = await supabaseRequest(`/rest/v1/tournaments?select=id&title=eq.${encodeURIComponent(title)}`);
        if (existing && existing.length > 0) {
            if (!confirm(`⚠️ Турнир с названием "${title}" уже существует. Создать дубликат?`)) {
                btn.disabled = false;
                btn.textContent = '🚀 Создать';
                return;
            }
        }
        
        // 1. Создаем турнир
        const data = await supabaseRequest('/rest/v1/tournaments', 'POST', [{
            title,
            tournament_date: date,
            status: 'draft'
        }]);
        
        const tournamentId = data[0].id;
        console.log('✅ Турнир создан:', tournamentId);
        
        // 2. Создаем команды А, Б, В
        const teamNames = ['А', 'Б', 'В'];
        for (const name of teamNames) {
            await supabaseRequest('/rest/v1/tournament_teams', 'POST', [{
                tournament_id: tournamentId,
                team_name: name,
                wins: 0,
                draws: 0,
                losses: 0,
                goals_for: 0,
                goals_against: 0,
                points: 0
            }]);
            console.log('✅ Команда', name, 'создана');
        }
        
        // 3. Проверяем создание команд
        const teams = await supabaseRequest(`/rest/v1/tournament_teams?select=*&tournament_id=eq.${tournamentId}`);
        console.log('📋 Всего команд в турнире:', teams.length);
        
        titleInput.value = '';
        dateInput.value = '';
        
        await renderTournaments();
        
        alert(`✅ Турнир "${title}" создан!\n\nКоманды А, Б, В готовы.\nПерейдите в "Команды" для распределения игроков.`);
        
    } catch (e) {
        console.error('❌ Ошибка:', e);
        alert('❌ Ошибка: ' + e.message);
    }
    
    btn.disabled = false;
    btn.textContent = '🚀 Создать';
}

async function editTournament(tournamentId) {
    try {
        const data = await supabaseRequest(`/rest/v1/tournaments?select=*&id=eq.${tournamentId}`);
        if (!data || data.length === 0) {
            alert('❌ Турнир не найден');
            return;
        }
        
        const tournament = data[0];
        
        const newTitle = prompt('Введите новое название турнира:', tournament.title);
        if (newTitle === null) return; // Отмена
        
        const newDate = prompt('Введите новую дату (ГГГГ-ММ-ДД):', tournament.tournament_date || '');
        if (newDate === null) return; // Отмена
        
        const updates = {};
        if (newTitle && newTitle.trim()) {
            updates.title = newTitle.trim();
        }
        if (newDate) {
            updates.tournament_date = newDate;
        }
        
        if (Object.keys(updates).length === 0) {
            alert('Нет изменений');
            return;
        }
        
        await supabaseRequest(`/rest/v1/tournaments?id=eq.${tournamentId}`, 'PATCH', updates);
        await renderTournaments();
        alert('✅ Турнир обновлен!');
        
    } catch (e) {
        console.error('❌ Ошибка редактирования:', e);
        alert('❌ ' + e.message);
    }
}

async function activateTournament(tournamentId) {
    if (!confirm('▶️ Активировать турнир? Это позволит начать матчи.')) return;
    
    try {
        // Проверяем, есть ли команды
        const teams = await supabaseRequest(`/rest/v1/tournament_teams?select=id&tournament_id=eq.${tournamentId}`);
        if (!teams || teams.length < 3) {
            alert('❌ В турнире должно быть 3 команды (А, Б, В) для активации!');
            return;
        }
        
        await supabaseRequest(`/rest/v1/tournaments?id=eq.${tournamentId}`, 'PATCH', { status: 'active' });
        await renderTournaments();
        alert('✅ Турнир активирован! Теперь можно создавать матчи.');
        
    } catch (e) {
        console.error('❌ Ошибка активации:', e);
        alert('❌ ' + e.message);
    }
}

async function finishTournamentFromList(tournamentId) {
    if (!confirm('🏁 Завершить турнир? Это действие нельзя отменить!')) return;
    
    try {
        // Проверяем, все ли матчи завершены
        const matches = await supabaseRequest(`/rest/v1/matches?select=is_finished&tournament_id=eq.${tournamentId}`);
        const unfinished = matches?.filter(m => !m.is_finished) || [];
        
        if (unfinished.length > 0) {
            if (!confirm(`⚠️ Осталось ${unfinished.length} незавершенных матчей. Завершить турнир без их завершения?`)) {
                return;
            }
        }
        
        await supabaseRequest(`/rest/v1/tournaments?id=eq.${tournamentId}`, 'PATCH', { status: 'finished' });
        await renderTournaments();
        alert('🏆 Турнир завершен!');
        
    } catch (e) {
        console.error('❌ Ошибка завершения:', e);
        alert('❌ ' + e.message);
    }
}

async function deleteTournament(id, title) {
    const confirmMsg = title ? `Удалить турнир "${title}"?` : 'Удалить турнир?';
    if (!confirm(confirmMsg)) return;
    
    try {
        // Проверяем, есть ли завершенные матчи
        const matches = await supabaseRequest(`/rest/v1/matches?select=is_finished&tournament_id=eq.${id}`);
        const hasFinished = matches?.some(m => m.is_finished);
        
        if (hasFinished) {
            if (!confirm('⚠️ В турнире есть завершенные матчи. Удаление приведет к потере данных. Продолжить?')) {
                return;
            }
        }
        
        // Удаляем связанные данные
        // 1. Удаляем игроков команд
        const teams = await supabaseRequest(`/rest/v1/tournament_teams?select=id&tournament_id=eq.${id}`);
        if (teams && teams.length > 0) {
            for (const team of teams) {
                await supabaseRequest(`/rest/v1/team_players?team_id=eq.${team.id}`, 'DELETE');
            }
        }
        
        // 2. Удаляем команды
        await supabaseRequest(`/rest/v1/tournament_teams?tournament_id=eq.${id}`, 'DELETE');
        
        // 3. Удаляем матчи
        await supabaseRequest(`/rest/v1/matches?tournament_id=eq.${id}`, 'DELETE');
        
        // 4. Удаляем турнир
        await supabaseRequest(`/rest/v1/tournaments?id=eq.${id}`, 'DELETE');
        
        await renderTournaments();
        alert('🗑️ Турнир удален');
        
    } catch (e) {
        console.error('❌ Ошибка удаления:', e);
        alert('❌ ' + e.message);
    }
}

function openTournament(tournamentId) {
    // Сохраняем ID турнира и переключаемся на вкладку матчей
    localStorage.setItem('selectedTournament', tournamentId);
    
    // Переключаемся на вкладку матчей
    const matchesTab = document.querySelector('[data-tab="matches"]');
    if (matchesTab) {
        matchesTab.click();
    } else {
        // Если нет вкладок, просто переходим по ссылке
        window.location.href = '#matches';
    }
    
    // Обновляем select в матчах
    setTimeout(() => {
        const matchSelect = document.getElementById('matchTournamentSelect');
        if (matchSelect) {
            matchSelect.value = tournamentId;
            if (typeof loadMatches === 'function') {
                loadMatches();
            }
        }
    }, 300);
}

// Вспомогательная функция для экранирования HTML
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
