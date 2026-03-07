(function () {
    const MANUAL_BLOCKED_TABLES = {
        '2026-04-05': [53],
        '2026-04-06': [1, 2, 3, 4, 5, 6, 7, 8, 53, 54, 55, 56, 67, 68, 69, 70, 71, 72, 73, 74]
    };

    function getManualBlockedTablesByDate(date, totalTables = 110) {
        const items = MANUAL_BLOCKED_TABLES[String(date || '').trim()];
        if (!Array.isArray(items)) return [];

        return items
            .map((value) => Number(value))
            .filter((value) => Number.isInteger(value) && value >= 1 && value <= totalTables)
            .sort((a, b) => a - b);
    }

    window.LIDO_MANUAL_BLOCKED_TABLES = MANUAL_BLOCKED_TABLES;
    window.getLidoManualBlockedTablesByDate = getManualBlockedTablesByDate;
})();