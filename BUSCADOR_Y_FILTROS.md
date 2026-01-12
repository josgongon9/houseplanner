# Buscador y Filtros en Planner - Documentación

## Funcionalidades Implementadas

### 1. 🔍 Buscador de Comidas

**Ubicación:** Modal de planificación de comidas

**Características:**
- Campo de búsqueda en tiempo real
- Filtra por nombre de comida (insensible a mayúsculas/minúsculas)
- Icono visual para identificar rápidamente el campo
- Se resetea automáticamente al cerrar el modal

**Uso:**
1. Abre un slot de planificación (almuerzo o cena)
2. Escribe en el campo "Buscar comida..."
3. La lista se filtra instantáneamente

**Ejemplo:**
- Escribes "lent" → Muestra solo "Lentejas"
- Escribes "arro" → Muestra "Arroz", "Arroz con pollo", etc.

---

### 2. 🏷️ Filtros por Tipo de Comida

**Chips disponibles:**

#### 🟢 "Todas"
- Muestra todas las comidas disponibles
- Color: Verde esmeralda cuando está activo
- Estado por defecto

#### 🟡 "🍽️ Almuerzo"
- Muestra solo comidas marcadas como "Almuerzo" o "Cualquiera"
- Color: Amarillo cuando está activo
- Útil para ver solo opciones de mediodía

#### 🟣 "🌙 Cena"
- Muestra solo comidas marcadas como "Cena" o "Cualquiera"
- Color: Índigo/morado cuando está activo
- Útil para ver solo opciones de noche

#### 🟢 "⚡ Cualquiera"
- Muestra solo comidas marcadas como "Cualquiera" (que sirven para ambos)
- Color: Verde esmeralda cuando está activo
- Útil para ver comidas versátiles

---

### 3. 🧠 Filtro Inteligente Automático

**Funcionamiento:**
El sistema automáticamente muestra solo las comidas compatibles con el slot que estás planificando.

**Ejemplos:**

**Si abres ALMUERZO:**
```
✅ Comidas de tipo "Almuerzo"
✅ Comidas de tipo "Cualquiera"
❌ Comidas de tipo "Cena" (solo cena, ocultas)
```

**Si abres CENA:**
```
❌ Comidas de tipo "Almuerzo" (solo almuerzo, ocultas)
✅ Comidas de tipo "Cualquiera"
✅ Comidas de tipo "Cena"
```

**Ventaja:** No necesitas filtrar manualmente, el sistema ya sabe qué comidas tienen sentido para ese slot.

---

### 4. 📊 Combinación de Filtros

Los filtros se aplican en cadena:

1. **Filtro inteligente** → Solo comidas compatibles con el slot
2. **Filtro de tipo** → Aplica tu selección manual (Todas, Almuerzo, Cena, Cualquiera)
3. **Búsqueda** → Filtra por texto dentro de los resultados anteriores

**Ejemplo Real:**

**Estás planificando una CENA:**
- Automáticamente oculta comidas "solo almuerzo"
- Seleccionas filtro "Cualquiera"
- Escribes "arr"
- **Resultado:** Solo ve "Arroz caldoso" si está marcado como "Cualquiera"

---

## Interacción con el Usuario

### Visual

**Buscador:**
- Input con borde gris que se vuelve verde al enfocar
- Icono de búsqueda a la izquierda
- Placeholder: "Buscar comida..."

**Filtros:**
- Pills/chips redondeados
- Cambian de color al activarse (amarillo, morado, verde)
- Emojis para identificación rápida

### Comportamiento

**Al abrir el modal:**
- Filtro = "Todas"
- Búsqueda = vacía
- Muestra todas las comidas compatibles con el slot

**Al cerrar el modal (X o Guardar):**
- Se resetean todos los filtros
- La próxima vez que abras, empieza limpio

**Al cambiar filtros:**
- Actualización instantánea de la lista
- Sin recargas ni delays

---

## Casos de Uso

### Caso 1: Tienes 50 comidas registradas

**Problema:** Difícil encontrar "Lentejas" en una lista tan larga

**Solución:**
1. Escribe "lent" en el buscador
2. Aparece solo "Lentejas" y "Lentejas con arroz"
3. Seleccionas fácilmente

### Caso 2: Solo quieres ver tus cenas rápidas

**Problema:** Muchas comidas marcadas como "Almuerzo" que no son relevantes

**Solución:**
1. Pulsa el filtro "🌙 Cena"
2. Solo ves opciones marcadas para cena
3. Navegación más rápida

### Caso 3: Buscas comidas versátiles

**Problema:** Quieres comidas que valgan para cualquier momento

**Solución:**
1. Pulsa el filtro "⚡ Cualquiera"
2. Solo aparecen comidas tipo "both"
3. Eliges entre las más flexibles

---

## Notas Técnicas

### Rendimiento
- Filtrado en el cliente (React)
- No requiere llamadas a Firebase
- Instantáneo incluso con 100+ comidas

### Estado
```javascript
const [searchQuery, setSearchQuery] = useState(''); // Texto de búsqueda
const [filterType, setFilterType] = useState('all'); // 'all', 'lunch', 'dinner', 'both'
```

### Lógica de Filtrado
```javascript
meals.filter(meal => {
    // 1. Coincide con búsqueda
    const matchesSearch = meal.name.toLowerCase().includes(searchQuery.toLowerCase());
    
    // 2. Coincide con filtro seleccionado
    let matchesType = true;
    if (filterType !== 'all') {
        matchesType = meal.type === filterType || meal.type === 'both';
    }
    
    // 3. Compatible con el slot (almuerzo/cena)
    const slotType = selectedSlot?.type;
    const compatibleWithSlot = !slotType || meal.type === 'both' || meal.type === slotType;
    
    return matchesSearch && matchesType && compatibleWithSlot;
})
```

---

## Mejoras Futuras Posibles

- [ ] Filtro por stock disponible (solo con stock > 0)
- [ ] Ordenar por nombre, stock, o uso reciente
- [ ] Historial de comidas más usadas primero
- [ ] Favoritos/estrellas para comidas frecuentes
- [ ] Tags personalizados (vegetariano, picante, rápido, etc.)
