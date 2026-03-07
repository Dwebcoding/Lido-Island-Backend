(function () {
    const MANUAL_ADMIN_BOOKINGS = {
        '2026-04-05': [
            {
                name: 'Concetta',
                phone: '3337472765',
                tableNumbers: [53]
            }
        ],
        '2026-04-06': [
            {
                name: 'Alessandra Gallone',
                phone: '3664402512',
                tableNumbers: [1, 2, 3]
            },
            {
                name: 'Pasquale Iannoniangelo',
                phone: '3889590364',
                tableNumbers: [53, 54, 55, 56]
            },
            {
                name: 'Alessia Di Gaetano',
                phone: '3342679163',
                tableNumbers: [4, 5, 6]
            },
            {
                name: 'Emilio Salgani',
                phone: '3926036546',
                tableNumbers: [7, 8]
            },
            {
                name: 'Francesco Stucchi',
                phone: '3331254641',
                tableNumbers: [67, 68, 69]
            },
            {
                name: 'Ico Sesto',
                phone: '3476115630',
                tableNumbers: [70, 71]
            },
            {
                name: 'Davide Nieli',
                phone: '',
                tableNumbers: [72, 73, 74]
            }
        ]
    };

    function normalizeTableNumbers(tableNumbers) {
        if (!Array.isArray(tableNumbers)) return [];

        return tableNumbers
            .map((value) => Number(value))
            .filter((value) => Number.isInteger(value) && value >= 1 && value <= 110);
    }

    function getManualAdminBookingRows(date) {
        const normalizedDate = String(date || '').trim();
        const items = MANUAL_ADMIN_BOOKINGS[normalizedDate];
        if (!Array.isArray(items)) return [];

        return items
            .map((item, index) => {
                const tableNumbers = normalizeTableNumbers(item.tableNumbers);
                if (!tableNumbers.length) return null;

                return {
                    id: `manual-${normalizedDate}-${index + 1}`,
                    bookingId: `MAN-${normalizedDate.replaceAll('-', '')}-${String(index + 1).padStart(2, '0')}`,
                    date: normalizedDate,
                    name: String(item.name || 'Prenotazione manuale').trim(),
                    email: '',
                    phone: String(item.phone || '').trim(),
                    notes: `Tavoli: ${tableNumbers.join(', ')}`,
                    tables: tableNumbers.length,
                    tableNumbers,
                    chairs: 0,
                    umbrellas: 0,
                    amount: 0,
                    paymentId: '',
                    paymentStatus: 'manuale',
                    status: 'active',
                    source: 'manual_admin',
                    paidAt: null,
                    createdAt: `${normalizedDate}T00:00:00.000Z`
                };
            })
            .filter(Boolean);
    }

    function getAllManualAdminBookingRows() {
        return Object.keys(MANUAL_ADMIN_BOOKINGS)
            .sort()
            .flatMap((date) => getManualAdminBookingRows(date));
    }

    window.getLidoManualAdminBookingRows = getManualAdminBookingRows;
    window.getAllLidoManualAdminBookingRows = getAllManualAdminBookingRows;
})();