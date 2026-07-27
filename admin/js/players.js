// ============================================================
// ИГРОКИ
// ============================================================

async function loadPlayers() {
    const container = document.getElementById('page-players');
    container.innerHTML = `
        <div class="card">
            <h2>👥 Игроки</h2>
            <div id="playersStatus" class="status loading">⏳ Загрузка...</div>
            <div class="flex">
                <input id="playerName" placeholder="Введите имя игрока..." />
                <button onclick="addPlayer()">➕ Добавить</button>
            </div>
            <ul id="playersList"><li class="empty">Загрузка...</li></ul>
        </div>
    `;
    
    const list = document.getElementById('playersList');
    list.innerHTML = '<li class="empty">⏳ Загрузка...</li>';
    try {
        const data = await supabaseRequest('/rest/v1/players?select=*&order=name.asc');
        setStatus('playersStatus', '✅ Игроков: ' + (data?.length || 0), 'success');
        if (!data || data.length === 0) {
            list.innerHTML = '<li class="empty">📋 Нет игроков</li>';
            return;
        }
        list.innerHTML = data.map(p => `
            <li>
                <span>${p.name}</span>
                <button class="delete-btn" onclick="deletePlayer('${p.id}')">✕</button>
            </li>
        `).join('');
    } catch (e) {
        setStatus('playersStatus', '❌ ' + e.message, 'error');
        list.innerHTML = '<li class="empty">❌ Ошибка</li>';
    }
}

async function addPlayer() {
    const input = document.getElementById('playerName');
    const name = input.value.trim();
    if (!name) return alert('Введите имя!');
    const btn = document.querySelector('#page-players .card .flex button');
    btn.disabled = true; btn.textContent = '⏳...';
    try {
        await supabaseRequest('/rest/v1/players', 'POST', [{ name }]);
        input.value = '';
        loadPlayers();
    } catch (e) { alert('❌ ' + e.message); }
    btn.disabled = false; btn.textContent = '➕ Добавить';
}

async function deletePlayer(id) {
    if (!confirm('Удалить?')) return;
    try {
        await supabaseRequest('/rest/v1/players?id=eq.' + id, 'DELETE');
        loadPlayers();
    } catch (e) { alert('❌ ' + e.message); }
}
