export function stockTotals(stocks) {
    let gains = 0;
    let losses = 0;
    for (const stock of stocks) {
        const profit = Math.round(Number(stock.profit || 0) * 100);
        gains += Math.max(0, profit);
        losses += Math.max(0, -profit);
    }
    return { gains: gains / 100, losses: losses / 100, total: (gains - losses) / 100 };
}

// Sales are the source of truth, including edits, deletions and legacy net income.
export function withStockBudget(data, stocks) {
    if (!data) return data;
    const result = structuredClone(data);
    result.incomeCategories = [...new Set([...(data.incomeCategories || []), 'Acciones'])];
    result.expenseCategories = [...new Set([...(data.expenseCategories || []), 'Acciones'])];
    result.monthly ||= {};
    for (let month = 0; month < 12; month++) {
        const totals = stockTotals(stocks.filter(stock => Number(stock.date.slice(5, 7)) - 1 === month));
        const entry = result.monthly[month] ||= {};
        entry.incomes = { ...entry.incomes, Acciones: totals.gains };
        entry.expenses = { ...entry.expenses, Acciones: totals.losses };
    }
    return result;
}
