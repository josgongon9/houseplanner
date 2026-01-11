# 📅 Planificador de Menú Semanal

Una aplicación web moderna para gestionar tus comidas y planificar el menú semanal, con control de stock inteligente.

## 🚀 Guía de Inicio Rápido (Local)

Para ejecutar esta aplicación en tu ordenador, necesitas una herramienta llamada **Node.js**.

### 1. Instalar Node.js
Si no lo tienes (parece que no), descárgalo e instálalo desde aquí:
👉 **[Descargar Node.js (Versión LTS)](https://nodejs.org/)**

*Instala la configuración por defecto y reinicia tu ordenador (o al menos tu terminal/VS Code) tras la instalación.*

### 2. Instalar Dependencias
Abre una terminal en esta carpeta (`weekly-menu-planner`) y ejecuta:

```bash
npm install
```
*Esto descargará todas las librerías necesarias (React, Firebase, etc.).*

### 3. Arrancar la Aplicación
Para ver la app mientras trabajas en ella:

```bash
npm run dev
```
Verás un enlace local (ej. `http://localhost:5173`). ¡Ábrelo en tu navegador!

---

## 🌐 Cómo Desplegar (Gratis)

Para que tú y tu pareja podáis acceder desde vuestros móviles sin que tu ordenador esté encendido, necesitas subir la web a internet.

### Opción A: Vercel (Recomendada)
Es gratis y muy rápido.

1. Crea una cuenta en [Vercel.com](https://vercel.com).
2. Instala la herramienta de Vercel en tu terminal (una vez tengas Node.js):
   ```bash
   npm i -g vercel
   ```
3. Ejecuta el comando de despliegue dentro de esta carpeta:
   ```bash
   vercel
   ```
   *Dale a Enter a todas las preguntas por defecto.*
4. ¡Listo! Te dará una URL (ej. `weekly-menu-planner.vercel.app`) que puedes compartir.

### Opción B: Netlify (Manual)
1. Crea una cuenta en [Netlify.com](https://www.netlify.com/).
2. En tu terminal, crea la versión de producción:
   ```bash
   npm run build
   ```
   *Esto creará una carpeta llamada `dist`.*
3. En la web de Netlify, ve a "Sites" y arrastra la carpeta `dist` que se ha creado. ¡Se subirá sola!

---

## ☁️ Configuración de Datos (Firebase)

Para que los datos se guarden en la nube y se sincronicen entre dispositivos:

1. Ve a [Firebase Console](https://console.firebase.google.com/) y crea un proyecto.
2. Añade una **Web App** (`</>`) para obtener tus credenciales (API Key, etc.).
3. Crea una base de datos **Firestore Database** en modo de prueba.
4. Pega tus credenciales en el archivo `src/lib/firebase.js` de este proyecto.

*Si no haces esto, la app usará la memoria local de cada dispositivo y los datos NO se sincronizarán.*
