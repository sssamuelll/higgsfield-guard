# higgsfield-guard

Tu agente de IA pregunta antes de gastar créditos de Higgsfield.

[![test](https://github.com/sssamuelll/higgsfield-guard/actions/workflows/test.yml/badge.svg)](https://github.com/sssamuelll/higgsfield-guard/actions/workflows/test.yml) [English](README.md)

Nació después de que un agente gastara 801 de 1.001 créditos en 16 minutos, sin mostrar un solo precio. Higgsfield no tiene tope de gasto en la cuenta, ni en el servidor MCP, ni en el CLI, y soporte no devuelve los créditos de las generaciones que ya terminaron. higgsfield-guard pone el precio y tu aprobación delante de cada generación, en cada agente que uses.

## Lo que ves

En Claude Code y Cursor, cada generación se detiene en un aviso:

```
Higgsfield generate_video: seedance_2_5 5s 1080p: 60 credits. Balance: 200.24. Approve?
```

Codex, Gemini CLI y Kimi Code solo pueden bloquear, así que el agente recibe el precio y el comando que la permite:

```
Higgsfield generate_video: seedance_2_5 5s 1080p: 60 credits. Balance: 200.24.
Blocked by higgsfield-guard. To allow it, run this in your own terminal, then retry: higgsfield-guard approve 60
```

Si tu sistema está en español, los avisos salen en español.

## Instalación

Necesita Node.js 18 o más reciente.

### Claude Code

Dentro de Claude Code:

```
/plugin marketplace add sssamuelll/higgsfield-guard
/plugin install higgsfield-guard@higgsfield-guard
```

Después reinicia Claude Code. El plugin no necesita nada más. El comando `higgsfield-guard`, para los permisos, `status` y el registro, viene con la instalación por npm de abajo.

### Cursor, Codex CLI, Gemini CLI y Kimi Code

```
npm install -g github:sssamuelll/higgsfield-guard
higgsfield-guard install
```

`install` busca los agentes que tienes instalados, le agrega un hook a cada uno y guarda una copia de cada archivo que cambia. Si el plugin de Claude Code está activo, le deja Claude Code al plugin. Sin el plugin, protege también Claude Code. Reinicia las sesiones de agente que ya tengas abiertas.

Si ya lo tenías por npm y pasas Claude Code al plugin: activa el plugin y vuelve a correr `higgsfield-guard install`. Quita el hook viejo de Claude Code, para que no pregunte dos veces.

Para ver precios y saldo en los avisos, instala el [CLI de Higgsfield](https://github.com/higgsfield-ai/cli) y corre `higgsfield auth login`. Sin él, el guardrail igual detiene cada generación, y el aviso dice "costo sin calcular".

## Agentes

| Agente | Sin permiso | Dónde va el hook | Probado |
|---|---|---|---|
| Claude Code | te pregunta | el plugin, o `PreToolUse` en `~/.claude/settings.json` | en vivo |
| Cursor | te pregunta | `beforeMCPExecution`, `beforeShellExecution`, `preToolUse` en `~/.cursor/hooks.json` | según la documentación |
| Codex CLI | bloquea | `PreToolUse` en `~/.codex/hooks.json` | según la documentación |
| Gemini CLI | bloquea | `BeforeTool` en `~/.gemini/settings.json` | según la documentación |
| Kimi Code | bloquea | `[[hooks]]` en `~/.kimi-code/config.toml` o `~/.kimi/config.toml` | según la documentación |

Los adaptadores "según la documentación" siguen la documentación oficial de hooks de cada agente y se prueban con los payloads que ella describe. Si usas alguno, un issue con la salida de `higgsfield-guard log` nos ayuda.

## Permisos

Un permiso deja correr una tanda sin un aviso por trabajo, y es la forma de dejar pasar una llamada bloqueada en Codex, Gemini CLI y Kimi Code.

```
higgsfield-guard approve 120              # 120 créditos por los próximos 10 minutos
higgsfield-guard approve 120 --minutes 30
higgsfield-guard approve --once           # la próxima llamada, cueste lo que cueste
higgsfield-guard approve --clear
```

Cada generación que cabe en el permiso se descuenta y queda en el registro. Los agentes no pueden aprobarse a sí mismos. El guardrail bloquea cualquier comando de un agente que corra `higgsfield-guard approve` o `uninstall`, y cualquier edición de un agente dentro de `~/.higgsfield-guard`.

## Qué pasa y qué se detiene

Pasan sin preguntar: saldo, transacciones, precios (`get_cost`, `higgsfield generate cost`), listas de modelos, presets y generaciones, subidas de archivos y la espera de trabajos que ya existen.

Todo lo demás se detiene, incluidas las herramientas que Higgsfield agregue después de esta versión. Los scripts se leen antes de correr, así que `python make_video.py` también se detiene cuando el script llama a `higgsfield generate create`.

El servidor MCP de Higgsfield se reconoce por su nombre o por su URL, sin importar cómo lo hayas llamado en la configuración de tu agente.

## Comandos

| Comando | Qué hace |
|---|---|
| `higgsfield-guard install [--agents claude,codex]` | Agrega los hooks y copia el guardrail a `~/.higgsfield-guard/runtime` |
| `higgsfield-guard uninstall [--purge]` | Quita exactamente lo que agregó `install`; `--purge` también borra el registro |
| `higgsfield-guard status` | Agentes protegidos, permiso vigente, CLI y saldo |
| `higgsfield-guard approve` | Da un permiso, como arriba |
| `higgsfield-guard log [--n 20]` | Las últimas decisiones: hora, agente, herramienta, costo, saldo |

## Cómo funciona

```
agente ── llamada ──▶ hook ──▶ higgsfield-guard
                                  │
              no es Higgsfield, o es gratis ──▶ pasa
              un agente aprobándose a sí mismo ──▶ se bloquea
              una generación ──▶ precio y saldo desde el CLI de Higgsfield
                                  │
              un permiso la cubre ──▶ pasa, se descuenta, queda en el registro
              si no ──▶ te pregunta (Claude Code, Cursor)
                        la bloquea con el precio (Codex, Gemini CLI, Kimi Code)
```

Si algo falla dentro del guardrail o tarda demasiado, la llamada se pregunta o se bloquea. Nunca pasa en silencio.

## Límites

- Detiene el gasto accidental de un agente que corre sus hooks. Un programa decidido a saltárselo podría editar la configuración del agente o llamar a la API por otro lado.
- Los modos `bypassPermissions` y `dontAsk` de Claude Code se saltan los avisos de los hooks.
- Protege a los agentes de la máquina donde está instalado. La app de claude.ai y higgsfield.ai quedan fuera de su alcance.
- El guardrail necesita Node.js para arrancar. Si un agente no logra lanzarlo, ese agente decide qué pasa con la llamada, y la mayoría la deja correr.
- Los scripts se leen a un nivel: el script que nombra el comando. No se siguen imports, scripts de `npm run` ni targets de `make`.
- Una configuración de agente que no es JSON simple, por ejemplo una con comentarios, se salta, e `install` dice cuál.

## Desinstalar

El plugin de Claude Code, dentro de Claude Code:

```
/plugin uninstall higgsfield-guard@higgsfield-guard
```

La instalación por npm, en tu propia terminal:

```
higgsfield-guard uninstall
npm uninstall -g higgsfield-guard
```

## Preguntas

**¿Envía algo a algún lado?** No. Corre en tu máquina, le pide el precio al CLI de Higgsfield y escribe un registro local.

**¿Hace más lento a mi agente?** Las llamadas que no tienen que ver con Higgsfield responden en milisegundos. Una generación espera uno o dos segundos por su precio.

**Uso el conector de Higgsfield de claude.ai dentro de Claude Code.** Está cubierto. Sus herramientas se llaman `mcp__claude_ai_Higgsfield__*`.

**¿Un permiso puede durar más de 10 minutos?** Sí, con `--minutes`.

## Agregar un agente

Un adaptador es un archivo en `lib/adapters/` con `parse` (el payload del agente a una llamada neutra) y `render` (la decisión a la salida del agente), más una entrada en `lib/install/agents.js`. Sus pruebas usan los payloads de la documentación del propio agente. Windsurf, OpenCode y Goose son los próximos.

## Licencia

MIT. Sin afiliación ni respaldo de Higgsfield.
