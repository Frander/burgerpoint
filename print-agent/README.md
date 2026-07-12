# 🖨 Agente de impresión — Burger Point

Servicio local que corre en la **PC de la caja (Windows)** con la impresora
térmica USB de **80mm**. Escucha los pedidos en Supabase (Realtime) y cuando un
pedido entra a cocina imprime automáticamente la **comanda** (cocina) y el
**ticket del cliente**, con el mismo formato que OlaClick (logo/nombre,
dirección, líneas con opciones, totales, estado de pago y código QR).

> La impresión manual no necesita este agente: desde el panel (PDV o Pedidos)
> el botón 🖨 abre el ticket en el navegador y usa el driver de la impresora.

## Requisitos (Windows)

1. **Node.js 18 o superior** — <https://nodejs.org>
2. **Impresora térmica 80mm instalada** con su driver (ESC/POS, Epson-compatible;
   sirven las genéricas POS-80).
3. **Compartir la impresora** (para poder mandarle bytes en crudo):
   - Configuración → Bluetooth y dispositivos → Impresoras y escáneres →
     (tu impresora) → Propiedades de impresora → pestaña **Compartir** →
     ✔ Compartir esta impresora → nombre: **POS80**.

## Instalación

```bat
cd print-agent
npm install
copy config.example.json config.json
notepad config.json
```

Rellena en `config.json`:

| Campo | Qué va |
|---|---|
| `supabaseUrl` / `supabaseAnonKey` | Los mismos de `.env.local` del sitio |
| `email` / `password` | Un usuario del staff (puedes crear uno "impresora@…" con rol cajero) |
| `printerShare` | `\\\\localhost\\POS80` (o el nombre con que compartiste la impresora) |
| `business.siteUrl` | URL pública del sitio (el QR del ticket apunta a `siteUrl` + `/menu`) |
| `printOnStatus` | Estados que disparan la impresión (default: `["en_cocina"]`) |
| `autoPrint` | Activa/desactiva cada tipo de ticket |
| `copies` | Copias por tipo (ej. 2 comandas) |

## Probar

```bat
node index.js --test        # imprime un ticket de prueba
node index.js --dry-run     # no imprime: deja .bin y .txt en out/ para revisar
node index.js --order <id>  # imprime un pedido específico (uuid de orders)
```

## Correr como servicio

```bat
node index.js
```

Déjalo corriendo en la PC de la caja. Para que arranque solo con Windows:

1. `Win + R` → `shell:startup` → Enter.
2. Crea ahí un acceso directo a `iniciar-agente.bat` (incluido), o un .bat con:
   ```bat
   @echo off
   cd /d "%~dp0"
   node index.js
   ```

## Cómo funciona

- Se autentica en Supabase con el usuario del staff (respeta RLS).
- Se suscribe a cambios en `orders`; cuando un pedido queda en un estado de
  `printOnStatus` (los del PDV nacen en `en_cocina`; los WEB entran al
  aceptarlos), imprime comanda + ticket.
- Cada 90s hace un barrido de respaldo por si Realtime perdió un evento.
- Guarda en `state.json` los pedidos ya impresos para no duplicar.
- Genera ESC/POS directo (texto, negritas, doble tamaño, QR nativo y corte)
  y lo manda en crudo con `copy /b` a la impresora compartida.
