<#
  setup-windows.ps1 — Preparación de Claude Code en consola Windows
  Proyecto: PraxisGT / Mundo Cel Diaz

  Qué hace (todo verificable, nada destructivo):
   1. Verifica/orienta la instalación de Node.js y Git.
   2. Instala Claude Code (npm global) si falta.
   3. Clona los dos repos (frontend + API) en una carpeta que elijas.
   4. Deja ambos en la rama `staging` y actualizados.
   5. Te imprime los próximos pasos (login + prompt de arranque).

  Cómo usarlo:
   - Botón Inicio → escribí "powershell" → abrilo.
   - Pegá:  Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
   - Luego corré este archivo:  .\setup-windows.ps1
   - O con carpeta destino:     .\setup-windows.ps1 -Dest "$HOME\Documents\proyectos"

  NO pide ni guarda contraseñas/tokens. El login a Claude y a GitHub se hace
  de forma interactiva (se abre el navegador). Secretos NUNCA van en archivos del repo.
#>

param(
  [string]$Dest = "$HOME\Documents\proyectos"
)

$ErrorActionPreference = "Stop"

function Section($t) { Write-Host "`n=== $t ===" -ForegroundColor Cyan }
function Ok($t)      { Write-Host "  OK  $t" -ForegroundColor Green }
function Warn($t)    { Write-Host "  !!  $t" -ForegroundColor Yellow }

$FRONT = "https://github.com/wilberchitic1996/mundo-cel-diaz.git"
$API   = "https://github.com/wilberchitic1996/mundo-cel-diaz-api.git"

# 1. Node.js
Section "1/5  Node.js"
if (Get-Command node -ErrorAction SilentlyContinue) {
  Ok ("Node " + (node --version) + " / npm " + (npm --version))
} else {
  Warn "Node.js NO está instalado."
  Write-Host "    Descargalo (versión LTS) de https://nodejs.org , instalalo y volvé a correr este script."
  Start-Process "https://nodejs.org"
  exit 1
}

# 2. Git
Section "2/5  Git"
if (Get-Command git -ErrorAction SilentlyContinue) {
  Ok (git --version)
} else {
  Warn "Git NO está instalado."
  Write-Host "    Descargalo de https://git-scm.com/download/win , instalalo y volvé a correr este script."
  Start-Process "https://git-scm.com/download/win"
  exit 1
}

# 3. Claude Code
Section "3/5  Claude Code"
if (Get-Command claude -ErrorAction SilentlyContinue) {
  Ok ("Claude Code ya instalado (" + (claude --version) + ")")
} else {
  Write-Host "  Instalando Claude Code (npm global)..."
  npm install -g @anthropic-ai/claude-code
  Ok "Claude Code instalado."
}

# 4. Clonar repos
Section "4/5  Repos en $Dest"
if (-not (Test-Path $Dest)) { New-Item -ItemType Directory -Path $Dest | Out-Null }
Set-Location $Dest

function CloneOrUpdate($url, $name) {
  $path = Join-Path $Dest $name
  if (Test-Path $path) {
    Write-Host "  $name ya existe → actualizando staging..."
    Set-Location $path
    git fetch origin
    git checkout staging
    git pull origin staging
    Set-Location $Dest
    Ok "$name actualizado en staging."
  } else {
    Write-Host "  Clonando $name ..."
    git clone $url $name
    Set-Location $path
    git checkout staging 2>$null
    Set-Location $Dest
    Ok "$name clonado (rama staging)."
  }
}

CloneOrUpdate $FRONT "mundo-cel-diaz"
CloneOrUpdate $API   "mundo-cel-diaz-api"

# 5. Próximos pasos
Section "5/5  Próximos pasos"
Write-Host @"
  Todo listo. Ahora:

  1) Entrá al repo que vas a trabajar, por ejemplo el frontend:
       cd "$Dest\mundo-cel-diaz"

  2) Abrí Claude Code (la PRIMERA vez te pide login en el navegador):
       claude

  3) Pegá el prompt de arranque (está en docs/PROMPTS.md):
       "Lee CLAUDE.md y DEFINITION_OF_DONE.md y dame un resumen corto de
        arquitectura, estado y pendientes. No hagas nada hasta que confirme."

  Guías completas dentro del repo:
    - docs/CONSOLA-WINDOWS.md  (instalación + workflow + MCP)
    - docs/PROMPTS.md          (prompts copiables)
    - CLAUDE.md                (reglas + estado = memoria del proyecto)

  Credenciales del piloto (para probar, NO van en archivos):
    URL: mundo-cel-diaz-staging.vercel.app  ·  admin@demo.com  ·  Admin2026!
"@ -ForegroundColor White

Ok "Setup completo."
