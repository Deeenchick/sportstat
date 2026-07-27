// ============================================================
// ИГРОКИ
// ============================================================

let currentEditPlayerId = null;

async function loadPlayers() {
    const container = document.getElementById('page-players');
    if (!container) {
        console.error('❌ Контейнер page-players не найден');
        return;
    }
    
    container.innerHTML = `
        <div class="card">
            <h2>👥 Игроки</h2>
            <div id="playersStatus" class="status loading">⏳ Загрузка...</div>
            
            <!-- Форма добавления/редактирования -->
            <div class="flex" style="margin-bottom: 16px; flex-wrap: wrap; gap: 10px;">
                <input id="playerName" placeholder="Введите имя игрока..." 
                       style="flex:1; min-width: 200px; padding: 8px 12px; border: 2px solid #d1d5db; border-radius: 6px; font-size: 14px;" />
                <button id="playerSubmitBtn" onclick="submitPlayer()" 
                        style="padding: 8px 24px; background: #3b82f6; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">
                    ➕ Добавить
                </button>
                <button id="playerCancelBtn" onclick="cancelEditPlayer()" 
                        style="display: none; padding: 8px 24px; background: #6b7280; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">
                    ❌ Отмена
                </button>
            </div>
            
            <!-- Поиск и фильтрация -->
            <div style="margin-bottom: 12px;">
                <input id="playerSearch" placeholder="🔍 Поиск игроков..." 
                       oninput="filterPlayers()"
                       style="width: 100%; padding: 8px 12px; border: 2px solid #d1d5db; border-radius: 6px; font-size: 14px;" />
            </div>
            
            <!-- Список игроков -->
            <div id="playersListContainer">
                <ul id="playersList"><li class="empty">Загрузка...</li></ul>
            </div>
            
            <!-- Статистика -->
            <div id="playersStats" style="margin-top: 12px; font-size: 14px; color: #6b7280;"></div>
        </div>
    `;
    
    await refreshPlayersList();
}

async function refreshPlayersList() {
    const list = document.getElementById('playersList');
    const statusEl = document.getElementById('playersStatus');
    const statsEl = document.getElementById('playersStats');
    
    if (!list || !statusEl) return;
    
    list.innerHTML = '<li class="empty">⏳ Загрузка...</li>';
    
    try {
        const data = await supabaseRequest('/rest/v1/players?select=*&order=name.asc');
        
        // Сохраняем всех игроков для фильтрации
        window.allPlayers = data || [];
        
        setStatus('playersStatus', '✅ Игроков: ' + (data?.length || 0), 'success');
        
        if (!data || data.length === 0) {
            list.innerHTML = '<li class="empty">📋 Нет игроков. Добавьте первого!</li>';
            if (statsEl) statsEl.textContent = 'Всего: 0 игроков';
            return;
        }
        
        // Применяем фильтр, если есть
        filterPlayers();
        
        if (statsEl) {
            statsEl.textContent = `Всего: ${data.length} игроков`;
        }
        
    } catch (e) {
        console.error('❌ Ошибка загрузки игроков:', e);
        setStatus('playersStatus', '❌ ' + e.message, 'error');
        list.innerHTML = '<li class="empty">❌ Ошибка загрузки</li>';
    }
}

function filterPlayers() {
    const searchInput = document.getElementById('playerSearch');
    const list = document.getElementById('playersList');
    
    if (!list || !window.allPlayers) return;
    
    const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';
    
    if (!searchTerm) {
        // Показываем всех
        renderPlayersList(window.allPlayers, list);
        return;
    }
    
    // Фильтруем
    const filtered = window.allPlayers.filter(p => 
        p.name.toLowerCase().includes(searchTerm)
    );
    
    renderPlayersList(filtered, list);
    
    // Показываем количество найденных
    const statsEl = document.getElementById('playersStats');
    if (statsEl) {
        if (filtered.length === 0) {
            statsEl.textContent = `🔍 Ничего не найдено по запросу "${searchTerm}"`;
        } else {
            statsEl.textContent = `Найдено: ${filtered.length} из ${window.allPlayers.length} игроков`;
        }
    }
}

function renderPlayersList(players, listElement) {
    if (!listElement) return;
    
    if (!players || players.length === 0) {
        listElement.innerHTML = '<li class="empty">🔍 Ничего не найдено</li>';
        return;
    }
    
    listElement.innerHTML = players.map(p => `
        <li style="display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; 
                   background: #f8fafc; border-radius: 6px; margin-bottom: 6px; transition: all 0.2s;
                   border-left: 4px solid #3b82f6;">
            <span style="font-weight: 500; font-size: 15px;">${escapeHtml(p.name)}</span>
            <div style="display: flex; gap: 8px;">
                <button onclick="editPlayer('${p.id}')" 
                        style="padding: 4px 14px; background: #f59e0b; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 13px;">
                    ✏️ Редактировать
                </button>
                <button onclick="deletePlayer('${p.id}')" 
                        style="padding: 4px 14px; background: #ef4444; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 13px;">
                    ✕
                </button>
            </div>
        </li>
    `).join('');
}

// Простая защита от XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

async function submitPlayer() {
    const input = document.getElementById('playerName');
    const name = input.value.trim();
    
    if (!name) {
        alert('⚠️ Введите имя игрока!');
        input.focus();
        return;
    }
    
    // Проверка на минимальную длину
    if (name.length < 2) {
        alert('⚠️ Имя должно содержать минимум 2 символа');
        input.focus();
        return;
    }
    
    const btn = document.getElementById('playerSubmitBtn');
    const cancelBtn = document.getElementById('playerCancelBtn');
    
    try {
        // Проверка на дублирование
        const existingPlayers = await supabaseRequest(`/rest/v1/players?select=id,name&name=eq.${encodeURIComponent(name)}`);
        
        if (existingPlayers && existingPlayers.length > 0) {
            // Если редактируем того же игрока - пропускаем проверку
            if (currentEditPlayerId && existingPlayers[0].id === currentEditPlayerId) {
                // Обновляем существующего
                await updatePlayer(currentEditPlayerId, name);
                return;
            }
            
            alert(`⚠️ Игрок с именем "${name}" уже существует!`);
            input.focus();
            input.select();
            return;
        }
        
        // Если есть редактируемый игрок - обновляем
        if (currentEditPlayerId) {
            await updatePlayer(currentEditPlayerId, name);
            return;
        }
        
        // Добавляем нового игрока
        btn.disabled = true;
        btn.textContent = '⏳...';
        
        await supabaseRequest('/rest/v1/players', 'POST', [{ name }]);
        
        input.value = '';
        currentEditPlayerId = null;
        btn.textContent = '➕ Добавить';
        cancelBtn.style.display = 'none';
        
        await refreshPlayersList();
        
        // Показываем уведомление
        showTemporaryNotification('✅ Игрок добавлен!', 'success');
        
    } catch (e) {
        console.error('❌ Ошибка:', e);
        alert('❌ ' + e.message);
    } finally {
        btn.disabled = false;
        if (!currentEditPlayerId) {
            btn.textContent = '➕ Добавить';
        }
    }
}

async function updatePlayer(playerId, newName) {
    const btn = document.getElementById('playerSubmitBtn');
    const cancelBtn = document.getElementById('playerCancelBtn');
    
    try {
        btn.disabled = true;
        btn.textContent = '⏳...';
        
        await supabaseRequest(`/rest/v1/players?id=eq.${playerId}`, 'PATCH', { name: newName });
        
        const input = document.getElementById('playerName');
        input.value = '';
        currentEditPlayerId = null;
        btn.textContent = '➕ Добавить';
        cancelBtn.style.display = 'none';
        
        await refreshPlayersList();
        
        showTemporaryNotification('✅ Игрок обновлен!', 'success');
        
    } catch (e) {
        console.error('❌ Ошибка обновления:', e);
        alert('❌ ' + e.message);
    } finally {
        btn.disabled = false;
    }
}

function editPlayer(playerId) {
    if (!window.allPlayers) return;
    
    const player = window.allPlayers.find(p => p.id === playerId);
    if (!player) {
        alert('❌ Игрок не найден');
        return;
    }
    
    const input = document.getElementById('playerName');
    const btn = document.getElementById('playerSubmitBtn');
    const cancelBtn = document.getElementById('playerCancelBtn');
    
    input.value = player.name;
    input.focus();
    input.select();
    
    currentEditPlayerId = playerId;
    btn.textContent = '💾 Сохранить';
    btn.style.background = '#22c55e';
    cancelBtn.style.display = 'inline-block';
    
    // Прокручиваем к форме
    input.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function cancelEditPlayer() {
    const input = document.getElementById('playerName');
    const btn = document.getElementById('playerSubmitBtn');
    const cancelBtn = document.getElementById('playerCancelBtn');
    
    input.value = '';
    currentEditPlayerId = null;
    btn.textContent = '➕ Добавить';
    btn.style.background = '#3b82f6';
    cancelBtn.style.display = 'none';
    input.focus();
}

async function deletePlayer(id) {
    // Находим имя игрока для подтверждения
    if (!window.allPlayers) return;
    const player = window.allPlayers.find(p => p.id === id);
    const playerName = player ? player.name : 'этого игрока';
    
    if (!confirm(`❌ Удалить игрока "${playerName}"?`)) return;
    
    try {
        // Проверяем, не используется ли игрок в матчах
        const matches = await supabaseRequest(`/rest/v1/matches?select=id&or=(team_a_id.eq.${id},team_b_id.eq.${id})&limit=1`);
        
        if (matches && matches.length > 0) {
            if (!confirm(`⚠️ Игрок "${playerName}" участвует в матчах! Удалить его нельзя, так как это нарушит целостность данных.`)) {
                return;
            }
            // Если все равно пытаются удалить - показываем ошибку
            alert('❌ Невозможно удалить игрока, который участвует в матчах');
            return;
        }
        
        await supabaseRequest('/rest/v1/players?id=eq.' + id, 'DELETE');
        
        // Если удаляем редактируемого игрока - сбрасываем режим редактирования
        if (currentEditPlayerId === id) {
            cancelEditPlayer();
        }
        
        await refreshPlayersList();
        showTemporaryNotification(`🗑️ Игрок "${playerName}" удален`, 'warning');
        
    } catch (e) {
        console.error('❌ Ошибка удаления:', e);
        alert('❌ ' + e.message);
    }
}

// Вспомогательная функция для уведомлений
function showTemporaryNotification(message, type = 'success') {
    const statusEl = document.getElementById('playersStatus');
    if (!statusEl) return;
    
    const colors = {
        success: '#22c55e',
        warning: '#f59e0b',
        error: '#ef4444'
    };
    
    statusEl.textContent = message;
    statusEl.className = `status ${type}`;
    statusEl.style.borderColor = colors[type] || '#3b82f6';
    
    // Через 3 секунды возвращаем обычное состояние
    setTimeout(async () => {
        const data = window.allPlayers;
        if (data) {
            setStatus('playersStatus', '✅ Игроков: ' + (data?.length || 0), 'success');
        }
    }, 3000);
}

// Инициализация при загрузке страницы
// Если используется навигация, можно вызвать loadPlayers() при переходе
