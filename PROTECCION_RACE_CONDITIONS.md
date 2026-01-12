# Protección contra Race Conditions - Documentación Técnica

## Problema Resuelto

### ❌ Escenario Problemático (Código Anterior)

**Situación:**
- Usuario A abre la app a las 9:00:00 AM
- Usuario B abre la app a las 9:00:01 AM
- Ambos en el mismo hogar

**Flujo anterior (sin protección):**
1. Usuario A lee: "Lunes no procesado" → Resta 1.0 de lentejas
2. Usuario B lee: "Lunes no procesado" (aún no actualizado) → Resta 1.0 de lentejas
3. **Resultado**: Se restaron 2.0 porciones en lugar de 1.0 ❌

### ✅ Solución Implementada: Transacciones Atómicas

Ahora usamos **`runTransaction`** de Firestore, que garantiza operaciones atómicas.

## Cómo Funcionan las Transacciones

### Operación Atómica

Una transacción es **todo o nada**:
- Lee el estado actual
- Verifica si ya está procesado
- Si NO está procesado:
  - Marca como procesado
  - Reduce el stock
  - Commita todo de una vez
- Si YA está procesado:
  - Aborta y no hace nada

### Garantías de Firestore

Firestore garantiza que:
1. **Solo UNA transacción puede modificar un documento** a la vez
2. Si hay conflicto, una transacción se **aborta automáticamente**
3. La transacción abortada puede **reintentarse** (Firestore lo hace automáticamente)

## Nuevo Flujo Protegido

**Situación:**
- Usuario A abre la app a las 9:00:00 AM
- Usuario B abre la app a las 9:00:01 AM

**Flujo con transacciones:**

1. **Usuario A inicia transacción**:
   - Lee: "Lunes no procesado"
   - Marca como procesado
   - Reduce stock en 1.0
   - ✅ Commit exitoso

2. **Usuario B inicia transacción** (casi simultáneamente):
   - Lee: "Lunes YA procesado" (Usuario A ya hizo commit)
   - Detecta flag `processed: true`
   - ⏭️ Salta este día (return)
   - No reduce stock

3. **Resultado**: Se restó 1.0 porción correctamente ✅

## Caso de Conflicto Real

Si ambos llegan **EXACTAMENTE** al mismo tiempo:

1. Usuario A adquiere el lock del documento
2. Usuario B intenta leer pero el documento está "bloqueado"
3. Firestore aborta la transacción de B con error `aborted`
4. El código captura el error y muestra:
   ```
   Transaction aborted for DEV_2026-01-12-lunch - Already processed by another user
   ```
5. Usuario B **no duplica** la reducción de stock ✅

## Ventajas de Esta Implementación

### 1. Seguridad Total
- **Imposible** reducir el stock dos veces para el mismo día
- Protección automática contra concurrencia

### 2. Sin Locks Manuales
- No necesitamos crear documentos de "lock"
- Firestore maneja todo internamente

### 3. Transparente para el Usuario
- Si hay conflicto, simplemente no se procesa de nuevo
- El usuario ni se entera del conflicto

### 4. Log Claro
```javascript
✅ Procesados 3 días pasados y stock actualizado
```
O si hubo conflicto:
```javascript
Transaction aborted for DEV_2026-01-13-dinner - Already processed by another user
```

## Código Clave

```javascript
await runTransaction(db, async (transaction) => {
    const menuRef = doc(db, "menu", menuDoc.id);
    const freshMenuDoc = await transaction.get(menuRef);
    
    const freshMenuData = freshMenuDoc.data();
    
    // ⚠️ CRÍTICO: Lee el estado DENTRO de la transacción
    if (freshMenuData.processed) {
        return; // Ya procesado, skip
    }

    // Marca como procesado (atómico)
    transaction.update(menuRef, { processed: true });

    // Reduce stock (atómico)
    for (const { mealId, portion } of mealsToProcess) {
        const mealRef = doc(db, "meals", mealId);
        const mealDoc = await transaction.get(mealRef);
        
        const currentQuantity = mealDoc.data().quantity || 0;
        const newQuantity = Math.max(0, currentQuantity - portion);
        transaction.update(mealRef, { quantity: newQuantity });
    }
});
```

## Diferencia con el Código Anterior

### Antes (Race Condition Posible)
```javascript
// 1. Lee fuera de transacción
if (!menuData.processed) {
    // 2. Actualiza
    await updateDoc(menuRef, { processed: true });
    await updateDoc(mealRef, { quantity: newQuantity });
}
// ❌ Otro usuario puede leer entre 1 y 2
```

### Ahora (Protegido)
```javascript
await runTransaction(db, async (transaction) => {
    // 1. Lee DENTRO de transacción (con lock)
    const freshData = await transaction.get(menuRef);
    
    if (!freshData.data().processed) {
        // 2. Actualiza (atomic commit)
        transaction.update(menuRef, { processed: true });
        transaction.update(mealRef, { quantity: newQuantity });
    }
});
// ✅ Nadie más puede leer/escribir hasta que termine
```

## Rendimiento

**¿Afecta el rendimiento?**
- Mínimamente. Las transacciones son muy rápidas en Firestore
- Solo afecta si **múltiples usuarios abren EXACTAMENTE al mismo tiempo**
- En ese caso, uno procesa y los demás detectan y saltan (milisegundos)

**¿Cuándo se ejecuta?**
- Solo cuando se carga el household (al abrir la app)
- No se ejecuta en cada cambio de página

## Tests Recomendados

Para probar la protección:
1. Abre la app en 2 navegadores diferentes
2. Planifica comidas para ayer
3. Cierra ambos navegadores
4. Ábrelos simultáneamente (Ctrl+Shift+T en ambos)
5. Verifica en la consola y en Firestore que solo se procesó una vez

## Conclusión

✅ **Completamente seguro** contra race conditions  
✅ **Sin duplicación** de reducción de stock  
✅ **Múltiples usuarios** pueden usar la app simultáneamente  
✅ **Automático y transparente** para el usuario  
