import { db, collection, query, where, getDocs, doc, runTransaction } from './firebase';

export const recurringMonthKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

export async function generateDueRecurringExpenses(householdId, monthDate = new Date(), now = new Date()) {
    if (!householdId || Number.isNaN(monthDate.getTime())) return;
    const monthKey = recurringMonthKey(monthDate);
    // Never book a future month, even if a caller passes the month being browsed.
    if (monthKey > recurringMonthKey(now)) return;
    const rulesSnap = await getDocs(query(collection(db, 'recurringExpenses'), where('householdId', '==', householdId), where('active', '==', true)));
    const existingSnap = await getDocs(query(collection(db, 'expenses'), where('householdId', '==', householdId)));
    // Preserve compatibility with the random IDs used by older recurring entries.
    const existing = new Set(existingSnap.docs.map(d => d.data()).filter(e => e.recurringMonth === monthKey).map(e => e.recurringId));
    for (const ruleDoc of rulesSnap.docs) {
        const rule = ruleDoc.data();
        if (rule.startMonth > monthKey || (rule.endMonth && rule.endMonth < monthKey) || existing.has(ruleDoc.id)) continue;
        const ref = doc(db, 'expenses', `recurring_${householdId}_${ruleDoc.id}_${monthKey}`);
        await runTransaction(db, async transaction => {
            if ((await transaction.get(ref)).exists()) return;
            // Read the rule inside the same transaction: edits, pauses and deletions
            // during generation must invalidate this attempt and trigger a retry.
            const currentRule = await transaction.get(doc(db, 'recurringExpenses', ruleDoc.id));
            if (!currentRule.exists()) return;
            const rule = currentRule.data();
            if (rule.householdId !== householdId || rule.active !== true || rule.startMonth > monthKey || (rule.endMonth && rule.endMonth < monthKey)) return;
            transaction.set(ref, {
                title: rule.title, amount: Number(rule.amount), category: rule.category,
                date: new Date(monthDate.getFullYear(), monthDate.getMonth(), 1, 12).toISOString(),
                householdId, payerId: rule.payerId, splitAmong: rule.splitAmong,
                splitMode: rule.splitMode || 'equal', customAmounts: rule.customAmounts || {},
                recurringId: ruleDoc.id, recurringMonth: monthKey
            });
        });
    }
}
