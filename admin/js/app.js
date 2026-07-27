// ============================================================
// ЗАПУСК АДМИН-ПАНЕЛИ
// ============================================================

console.log('✅ Админ-панель загружается...');

// --- ПЕРЕКЛЮЧЕНИЕ СТРАНИЦ ПО КЛИКУ НА КНОПКИ ---
document.querySelectorAll('.nav-links button').forEach(btn => {
    btn.addEventListener('click', function() {
        const page = this.dataset.page;
        console.log('📄 Переход на страницу:', page);
        showPage(page);
    });
});

// --- ЗАПУСК ---
showPage('players');
