import { useEffect, useState } from 'react';
import { db, collection, onSnapshot } from '../lib/firebase';
import { bankImportsPath } from '../lib/bankImportRepository';

const EMPTY = [];
export default function useBankImports(householdId, userId) {
    const scope = `${userId || ''}/${householdId || ''}`;
    const [state, setState] = useState({ scope: '', reports: EMPTY, error: '', loading: true });
    useEffect(() => {
        if (!householdId || !userId) return;
        let active = true;
        const unsubscribe = onSnapshot(collection(db, ...bankImportsPath(householdId)), snapshot => {
            if (active) setState({ scope, reports: snapshot.docs.map(d => ({ ...d.data(), id: d.id })).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), error: '', loading: false });
        }, () => {
            if (active) setState({ scope, reports: EMPTY, loading: false, error: 'No se pueden cargar los informes. Comprueba la conexión y los permisos de Firebase para las importaciones.' });
        });
        return () => { active = false; unsubscribe(); };
    }, [householdId, userId, scope]);
    return state.scope === scope ? state : { reports: EMPTY, error: '', loading: true };
}
