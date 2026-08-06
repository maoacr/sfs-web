# SFS Web

Frontend y API del proyecto **SFS** — SaaS multi-tenant para gestión y reservas de canchas de fútbol.

## Stack

| Capa | Tecnología |
|------|-----------|
| Framework | [Next.js 16](https://nextjs.org) (App Router, Turbopack) |
| Lenguaje | TypeScript |
| Estilos | Tailwind CSS 4 |
| Auth | JWT (jose + bcryptjs) |
| Pagos | MercadoPago (Checkout Pro) |
| PWA | Serwist (Service Worker) |
| Monorepo | [maoacr/sfs](https://github.com/maoacr/sfs) (pnpm workspaces) |
| Docs | [maoacr/sfs-docs](https://github.com/maoacr/sfs-docs) |

## Arranque rápido

```bash
pnpm install
cp .env.example .env       # Configurar Supabase + JWT
pnpm dev                    # http://localhost:3000
```

### Variables de entorno (.env)

```
DATABASE_URL=               # Supabase session pooler
JWT_SECRET=                 # Clave de firma JWT
JWT_REFRESH_SECRET=
MERCADOPAGO_ACCESS_TOKEN=   # (próximamente)
NEXT_PUBLIC_APP_URL=
RESEND_API_KEY=             # API key de Resend (emails de reservas)
```

## Navegación

| Dispositivo | Patrón |
|------------|--------|
| Mobile | Bottom tab bar |
| Tablet+ | Sidebar fijo |

## Diseño

- Dark mode por defecto
- Paleta verde fútbol: `field` (#0a5c2a), `grass` (#16a34a)
- Mobile-first con safe area para iPhone
- Moneda: COP

## Documentación

Documentación técnica en [sfs-docs](https://github.com/maoacr/sfs-docs).
