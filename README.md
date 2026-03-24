# Onboarding App

Tracker de onboarding para agentes de voz.

## Deploy en Railway

1. Crear proyecto nuevo en Railway
2. Conectar repo de GitHub
3. Variables de entorno:
   - `PORT`: `3000`
   - `DATA_DIR`: `/data`
4. Agregar volumen:
   - Mount path: `/data`
5. Deploy

## Usuarios

| Usuario | Contraseña |
|---------|-----------|
| lu | Hyp3r1a2026! |
| ferran | Mak3da2026! |

## Estructura

```
server.js      → Express API + auth
public/        → Frontend SPA
data/          → JSON persistente (volumen Railway)
```
