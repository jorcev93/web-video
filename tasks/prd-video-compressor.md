# PRD: Video Compressor Landing Page

## Overview
Landing page minimalista y elegante que permite a los usuarios comprimir videos a un tamaño objetivo específico en MB. Construida con Next.js y FFmpeg en el servidor, con tema oscuro, tipografía limpia y acentos de color. Incluye login opcional para guardar historial de compresiones.

## Goals
- Permitir a usuarios comprimir videos de cualquier formato soportado por FFmpeg a un tamaño objetivo en MB
- Ofrecer una experiencia visual minimalista, elegante y dark-mode por defecto
- Proveer login opcional para que usuarios puedan ver su historial de compresiones
- Mantener la arquitectura simple usando Next.js con API routes y FFmpeg server-side

## Quality Gates

Estos comandos deben pasar para cada user story:
- `pnpm typecheck` - Type checking
- `pnpm lint` - Linting

## User Stories

### US-001: Setup del proyecto Next.js con tema oscuro
**Description:** Como desarrollador, quiero un proyecto Next.js configurado con Tailwind CSS y un sistema de tema oscuro elegante para que sirva de base a toda la aplicación.

**Acceptance Criteria:**
- [ ] Proyecto Next.js (App Router) inicializado con TypeScript
- [ ] Tailwind CSS configurado con paleta oscura personalizada (grays, acento de color primario)
- [ ] Tipografía limpia configurada (Inter o similar sans-serif)
- [ ] Layout base con fondo oscuro (#0a0a0a o similar), texto claro y acentos de color
- [ ] Estructura de carpetas: `components/`, `app/`, `lib/`

### US-002: Hero section
**Description:** Como visitante, quiero ver una sección hero atractiva que explique qué hace la aplicación para entender su valor inmediatamente.

**Acceptance Criteria:**
- [ ] Título principal claro (ej: "Comprime tus videos al tamaño que necesitas")
- [ ] Subtítulo descriptivo breve
- [ ] CTA button que scrollea al compresor
- [ ] Diseño minimalista con buen uso de espaciado y tipografía
- [ ] Responsive en móvil y desktop

### US-003: Sección de features/beneficios
**Description:** Como visitante, quiero ver los beneficios clave del servicio para confiar en usarlo.

**Acceptance Criteria:**
- [ ] Grid de 3-4 cards con iconos minimalistas
- [ ] Features: sin límite de tamaño, todos los formatos, tamaño exacto, gratis
- [ ] Cards con estilo consistente al tema oscuro (bordes sutiles, hover effects)
- [ ] Responsive: 1 columna en móvil, 2-4 en desktop

### US-004: Componente de upload de video
**Description:** Como usuario, quiero subir un video desde mi dispositivo para poder comprimirlo.

**Acceptance Criteria:**
- [ ] Zona de drag & drop con estilo elegante (borde dashed, icono)
- [ ] También permite click para seleccionar archivo
- [ ] Muestra nombre del archivo, tamaño original y formato tras seleccionar
- [ ] Acepta todos los formatos de video comunes (mp4, webm, mov, avi, mkv, etc.)
- [ ] Feedback visual durante la carga (progress bar)
- [ ] Validación: rechaza archivos que no sean video con mensaje de error

### US-005: Input de tamaño objetivo y compresión server-side
**Description:** Como usuario, quiero especificar a cuántos MB quiero comprimir mi video y ejecutar la compresión.

**Acceptance Criteria:**
- [ ] Input numérico en MB para definir tamaño objetivo
- [ ] Validación: tamaño objetivo debe ser menor al tamaño original
- [ ] Validación: tamaño objetivo mínimo razonable (ej: 1MB)
- [ ] Botón "Comprimir" que envía el video al API route de Next.js
- [ ] API route usa FFmpeg (paquete `fluent-ffmpeg` + binario FFmpeg) para comprimir
- [ ] La compresión calcula el bitrate necesario basado en el tamaño objetivo y la duración del video
- [ ] Progress indicator visible durante la compresión (spinner o barra)
- [ ] Manejo de errores si la compresión falla

### US-006: Descarga del video comprimido
**Description:** Como usuario, quiero descargar el video comprimido después del proceso.

**Acceptance Criteria:**
- [ ] Botón de descarga visible tras completar la compresión
- [ ] El archivo descargado tiene un nombre descriptivo (ej: `video_compressed_9mb.mp4`)
- [ ] Se muestra el tamaño final del archivo comprimido
- [ ] Opción de comprimir otro video (reset del formulario)

### US-007: Sección FAQ
**Description:** Como visitante, quiero ver preguntas frecuentes para resolver dudas antes de usar el servicio.

**Acceptance Criteria:**
- [ ] Accordion/collapsible con 4-6 preguntas frecuentes
- [ ] Preguntas cubren: formatos soportados, límites, privacidad, calidad
- [ ] Animación suave al expandir/colapsar
- [ ] Estilo consistente con tema oscuro

### US-008: Footer
**Description:** Como visitante, quiero ver un footer con información básica del sitio.

**Acceptance Criteria:**
- [ ] Diseño minimalista con copyright y año
- [ ] Links opcionales (privacidad, contacto)
- [ ] Consistente con el tema oscuro

### US-009: Login opcional con NextAuth
**Description:** Como usuario, quiero poder hacer login opcionalmente para acceder a funcionalidades adicionales.

**Acceptance Criteria:**
- [ ] Botón de login/signup en el header (discreto, no intrusivo)
- [ ] Autenticación con NextAuth.js (provider: GitHub o Google)
- [ ] El compresor funciona sin login (acceso libre)
- [ ] Estado de sesión visible en header (avatar o nombre)
- [ ] Botón de logout

### US-010: Historial de compresiones para usuarios logueados
**Description:** Como usuario logueado, quiero ver mi historial de compresiones para acceder a mis videos previos.

**Acceptance Criteria:**
- [ ] Página `/history` accesible solo para usuarios logueados
- [ ] Lista de compresiones previas: nombre original, tamaño original, tamaño comprimido, fecha
- [ ] Base de datos simple (SQLite con Prisma o JSON file) para persistir el historial
- [ ] Redirect a login si usuario no autenticado intenta acceder
- [ ] Diseño consistente con tema oscuro

## Functional Requirements
- FR-1: El sistema debe aceptar videos de cualquier formato soportado por FFmpeg
- FR-2: El sistema debe permitir al usuario ingresar un tamaño objetivo en MB via input numérico
- FR-3: El sistema debe comprimir el video server-side usando FFmpeg calculando el bitrate adecuado
- FR-4: El sistema debe permitir descargar el video comprimido directamente
- FR-5: El sistema debe funcionar sin autenticación para la funcionalidad core (comprimir y descargar)
- FR-6: El sistema debe guardar historial de compresiones para usuarios autenticados
- FR-7: La interfaz debe ser responsive (móvil y desktop)
- FR-8: El tema debe ser oscuro con acentos de color y tipografía limpia

## Non-Goals
- No se implementará compresión en el navegador (WebAssembly/ffmpeg.wasm)
- No se implementará procesamiento en batch (múltiples videos a la vez)
- No se implementará edición de video (cortar, recortar, filtros)
- No se implementará almacenamiento en la nube de videos comprimidos
- No se implementará selección de resolución o codec manual
- No se implementará tema claro / toggle de tema

## Technical Considerations
- **Framework:** Next.js 14+ con App Router y TypeScript
- **Styling:** Tailwind CSS con tema oscuro personalizado
- **FFmpeg:** Binario FFmpeg en el servidor + `fluent-ffmpeg` para Node.js
- **Auth:** NextAuth.js con provider OAuth (GitHub/Google)
- **DB:** SQLite con Prisma para historial (simple, sin infraestructura extra)
- **Upload:** Considerar límites de upload en Next.js API routes (configurar `bodyParser` size limit)
- **Temp files:** Los videos se procesan en `/tmp` y se limpian después de la descarga

## Success Metrics
- El usuario puede comprimir un video de 34MB a ~9MB o menos exitosamente
- La página carga en menos de 2 segundos
- La interfaz es usable en móvil sin problemas
- Quality gates pasan sin errores (`pnpm typecheck && pnpm lint`)

## Open Questions
- ¿Qué provider OAuth preferir para login? (GitHub, Google, o ambos)
- ¿Se necesita rate limiting para evitar abuso del servidor?
- ¿Dónde se desplegará? (Vercel requiere configuración especial para FFmpeg binario)
