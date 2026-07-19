// ===== 可拖曳共用倉庫視窗（資料操作沿用 js/12-npc-quests.js）=====
(function () {
    let drag = null;
    function el(id) { return document.getElementById(id); }

    window.warehouseWindowIsOpen = function () {
        const win = el('warehouse-window');
        return !!win && !win.classList.contains('hidden');
    };

    window.openWarehouseWindow = function () {
        const win = el('warehouse-window');
        const content = el('warehouse-window-content');
        if (!win || !content) return;
        win.classList.remove('hidden');
        win.setAttribute('aria-hidden', 'false');
        if (typeof renderWarehouseNPC === 'function') renderWarehouseNPC(content);
    };

    window.closeWarehouseWindow = function () {
        const win = el('warehouse-window');
        if (!win) return;
        win.classList.add('hidden');
        win.setAttribute('aria-hidden', 'true');
    };

    function init() {
        const frame = el('warehouse-window-frame');
        const handle = el('warehouse-window-drag');
        const close = el('warehouse-window-close');
        if (!frame || !handle || !close) return;
        close.onclick = closeWarehouseWindow;

        handle.addEventListener('pointerdown', function (event) {
            if (event.target.closest('button, input, select')) return;
            const rect = frame.getBoundingClientRect();
            drag = { id: event.pointerId, dx: event.clientX - rect.left, dy: event.clientY - rect.top };
            handle.setPointerCapture(event.pointerId);
            frame.classList.add('is-dragging');
            event.preventDefault();
        });
        handle.addEventListener('pointermove', function (event) {
            if (!drag || drag.id !== event.pointerId) return;
            const maxX = Math.max(0, innerWidth - frame.offsetWidth);
            const maxY = Math.max(0, innerHeight - frame.offsetHeight);
            frame.style.left = Math.max(0, Math.min(maxX, event.clientX - drag.dx)) + 'px';
            frame.style.top = Math.max(0, Math.min(maxY, event.clientY - drag.dy)) + 'px';
            frame.style.transform = 'none';
        });
        function stop(event) {
            if (!drag || drag.id !== event.pointerId) return;
            drag = null;
            frame.classList.remove('is-dragging');
        }
        handle.addEventListener('pointerup', stop);
        handle.addEventListener('pointercancel', stop);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
