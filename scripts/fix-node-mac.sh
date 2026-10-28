#!/bin/bash
# =============================================================================
# scripts/fix-node-mac.sh — remet l'environnement de dev macOS d'aplomb
# -----------------------------------------------------------------------------
# Trois familles de pannes traitées :
#   • Node : keg Homebrew incomplet (/opt/homebrew/opt/node@20/bin/node absent),
#     PATH mort dans ~/.zshrc, conda qui masque node, ABI des modules natifs
#     désalignée après un changement de version (better-sqlite3, sqlite3, sharp…)
#   • conda : installation incomplète (pas de « conda init », base cassée,
#     libsqlite3 dylib manquante → « sqlite incompatible »), plusieurs installs
#     concurrentes, activation automatique de « base »
#   • Homebrew : kegs cassés, dylib sqlite absente, doctor, caches
#
# Le script ne supprime rien par défaut : ni environnement conda, ni formule
# Homebrew, ni ligne de configuration (les lignes fautives sont commentées
# après sauvegarde). Tout est écrit dans un rapport daté :
#     ~/mac-dev-cleanup-<date>/
#        report.md       résumé lisible
#        problems.txt    journal des problèmes (OK / WARN / BROKEN / FIXED)
#        actions.txt     ce qui a été modifié
#        before.txt after.txt run.log brew-doctor.txt conda-*.txt
#        backups/        copies de ~/.zshrc ~/.zprofile ~/.npmrc ~/.condarc…
#
# Usage :
#   bash scripts/fix-node-mac.sh --dry-run   # diagnostic seul (écrit le rapport)
#   bash scripts/fix-node-mac.sh             # répare ce qui est sûr
#   bash scripts/fix-node-mac.sh --fix-brew  # + brew reinstall sqlite, kegs node*
#   bash scripts/fix-node-mac.sh --fix-native# + reconstruit les modules natifs
#   bash scripts/fix-node-mac.sh --node 22   # force la version Node par défaut
#   bash scripts/fix-node-mac.sh --scan ~/dev --scan ~/Documents
#   bash scripts/fix-node-mac.sh --help
#
# Compatible bash 3.2 (celui livré avec macOS).
# =============================================================================

set -uo pipefail
umask 077

NVM_VERSION="v0.40.8"
NODE_MAJOR=""
DRY_RUN=0
REMOVE_BREW_NODE=0
FIX_BREW=0
FIX_NATIVE=0
SCAN_DIRS=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)       DRY_RUN=1 ;;
    --remove-brew-node) REMOVE_BREW_NODE=1 ;;
    --fix-brew)      FIX_BREW=1 ;;
    --fix-native)    FIX_NATIVE=1 ;;
    --node)          shift; NODE_MAJOR="${1:-}" ;;
    --node=*)        NODE_MAJOR="${1#*=}" ;;
    --scan)          shift; SCAN_DIRS="$SCAN_DIRS ${1:-}" ;;
    --scan=*)        SCAN_DIRS="$SCAN_DIRS ${1#*=}" ;;
    --help|-h)
      # affiche tout l'en-tête de commentaires, quel que soit sa longueur
      awk 'NR>1 && /^#/ {sub(/^# ?/, ""); print; next} NR>1 {exit}' "$0"
      exit 0
      ;;
    *) echo "Argument inconnu : $1 (ignoré)" >&2 ;;
  esac
  shift
done

if [[ "$(uname -s)" != Darwin ]] && [[ "${FIXNODE_ALLOW_NON_MACOS:-0}" != 1 ]]; then
  echo 'Ce script est prévu pour macOS.' >&2
  exit 1
fi
if [[ "${EUID:-$(id -u)}" -eq 0 ]]; then
  echo 'Lance-le avec ton compte habituel, sans sudo.' >&2
  exit 1
fi

if [[ -n "$NODE_MAJOR" ]] && [[ ! "$NODE_MAJOR" =~ ^[0-9]+$ ]]; then
  echo "Version Node invalide : « $NODE_MAJOR » (attendu : 20, 22 ou 24)." >&2
  exit 2
fi

STAMP="$(date +%Y%m%d_%H%M%S)"
BASE="$HOME/mac-dev-cleanup-$STAMP"
mkdir -p "$BASE/backups"
LOG="$BASE/run.log"
FINDINGS="$BASE/problems.txt"
ACTIONS="$BASE/actions.txt"
: > "$FINDINGS"
: > "$ACTIONS"
exec > >(tee -a "$LOG") 2>&1
trap 'rm -f "$BASE"/.tmp.* 2>/dev/null' EXIT

OK_N=0; WARN_N=0; BAD_N=0; FIX_N=0

# ------------------------------------------------------------------ affichage
say()  { printf '\n==> %s\n' "$*"; }
warn() { printf 'ATTENTION: %s\n' "$*" >&2; }
info() { printf '    %s\n' "$*"; }

# ------------------------------------------------------- journal des problèmes
# Niveaux : OK (rien à faire) · WARN (gênant) · BROKEN (cassé) · FIXED (corrigé)
f_ok() {
  OK_N=$((OK_N+1))
  printf '[OK]     %-24s %s\n' "$1" "$2" | tee -a "$FINDINGS"
}
f_warn() {
  WARN_N=$((WARN_N+1))
  { printf '[WARN]   %-24s %s\n' "$1" "$2"
    [[ -n "${3:-}" ]] && printf '         → %s\n' "$3"
  } | tee -a "$FINDINGS"
  return 0
}
f_bad() {
  BAD_N=$((BAD_N+1))
  { printf '[BROKEN] %-24s %s\n' "$1" "$2"
    [[ -n "${3:-}" ]] && printf '         → %s\n' "$3"
  } | tee -a "$FINDINGS"
  return 0
}
f_fix() {
  FIX_N=$((FIX_N+1))
  printf '[FIXED]  %-24s %s\n' "$1" "$2" | tee -a "$FINDINGS"
  printf '%s — %s\n' "$1" "$2" >> "$ACTIONS"
  return 0
}

# RUN : toute action qui modifie le système passe par ici (--dry-run respecté)
RUN() {
  info "\$ $*"
  if [[ "$DRY_RUN" == 1 ]]; then
    info '(dry-run : non exécuté)'
    return 0
  fi
  "$@"
}

sedi() { sed -i '' "$@"; }   # BSD sed, macOS

have() { command -v "$1" >/dev/null 2>&1; }

say "Rapport : $BASE"
[[ "$DRY_RUN" == 1 ]] && warn 'MODE DRY-RUN : aucune modification du système (seul le rapport est écrit).'

# =============================================================================
# 0. Sauvegardes
# =============================================================================
backup() {
  local f="$1"
  if [[ -f "$f" ]]; then cp -p "$f" "$BASE/backups/$(basename "$f")"; fi
  return 0
}
for f in "$HOME/.zshrc" "$HOME/.zprofile" "$HOME/.zshenv" "$HOME/.bash_profile" \
         "$HOME/.bashrc" "$HOME/.npmrc" "$HOME/.condarc" "$HOME/.profile"; do
  backup "$f"
done
info "sauvegardes : $BASE/backups (ex. cp -p \"$BASE/backups/.zshrc\" ~/.zshrc)"

# =============================================================================
# 1. Système
# =============================================================================
say 'Système'
ARCH="$(uname -m)"
MACOS="$(sw_vers -productVersion 2>/dev/null || echo 0.0)"
BUILD="$(sw_vers -buildVersion 2>/dev/null || echo '?')"
MAJOR="${MACOS%%.*}"; REST="${MACOS#*.}"; MINOR="${REST%%.*}"
info "macOS $MACOS ($BUILD) · $ARCH"

if [[ "$ARCH" == "arm64" ]] && [[ "$(sysctl -n sysctl.proc_translated 2>/dev/null || echo 0)" == "1" ]]; then
  f_bad SYSTÈME-ROSETTA 'ce terminal tourne sous Rosetta (x86_64 émulé)' \
    'terminal → clic droit sur l’app → Obtenir des informations → décocher « Ouvrir avec Rosetta »'
else
  f_ok SYSTÈME-ARCH "architecture native ($ARCH)"
fi

if xcode-select -p >/dev/null 2>&1; then
  f_ok XCODE-CLT "Command Line Tools : $(xcode-select -p 2>/dev/null)"
else
  f_bad XCODE-CLT 'Command Line Tools absents (compilation npm impossible)' \
    'xcode-select --install'
fi

FREE_MB="$(df -m / | awk 'NR==2 {print $4}' 2>/dev/null || echo 0)"
if [[ "${FREE_MB:-0}" -lt 3000 ]]; then
  f_warn DISQUE "seulement ${FREE_MB} Mo libres sur /" \
    'libère de l’espace : brew cleanup, conda clean --all, ~/Library/Caches'
else
  f_ok DISQUE "${FREE_MB} Mo libres sur /"
fi

# =============================================================================
# 2. Homebrew
# =============================================================================
say 'Homebrew'
BREW=""
for candidate in /opt/homebrew/bin/brew /usr/local/bin/brew; do
  if [[ -x "$candidate" ]]; then BREW="$candidate"; break; fi
done

BREW_PREFIX=""
SQLITE_LIB=""
if [[ -z "$BREW" ]]; then
  f_warn HOMEBREW 'Homebrew introuvable' 'optionnel : https://brew.sh'
else
  BREW_PREFIX="$("$BREW" --prefix 2>/dev/null || echo '')"
  info "préfixe : $BREW_PREFIX"
  "$BREW" config > "$BASE/brew-config.txt" 2>&1 || true

  # Incohérence architecture : brew x86_64 sur Apple Silicon (ou l'inverse)
  BREW_CPU="$(grep -m1 -E '^CPU:' "$BASE/brew-config.txt" 2>/dev/null | sed 's/^CPU: *//' || true)"
  if [[ -n "$BREW_CPU" ]]; then
    if [[ "$ARCH" == "arm64" ]] && [[ "$BREW_CPU" == *x86_64* ]]; then
      f_bad HOMEBREW-ARCH "Homebrew x86_64 sous Rosetta sur Apple Silicon ($BREW_PREFIX)" \
        '/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)" puis désinstalle /usr/local/Homebrew'
    elif [[ "$ARCH" == "x86_64" ]] && [[ "$BREW_CPU" == *arm64* ]]; then
      f_bad HOMEBREW-ARCH "Homebrew arm64 sur un Mac Intel ($BREW_PREFIX)" \
        'réinstalle Homebrew pour x86_64'
    else
      f_ok HOMEBREW-ARCH "Homebrew $BREW_CPU cohérent avec $ARCH"
    fi
  fi

  # doctor : on garde la sortie brute et on compte les avertissements
  if "$BREW" doctor > "$BASE/brew-doctor.txt" 2>&1; then
    f_ok HOMEBREW-DOCTOR 'brew doctor : aucun avertissement'
  else
    DOC_N="$(grep -c '^Warning:' "$BASE/brew-doctor.txt" 2>/dev/null || echo 0)"
    f_warn HOMEBREW-DOCTOR "brew doctor signale $DOC_N avertissement(s)" \
      "détail : $BASE/brew-doctor.txt"
  fi

  # kegs cassés : dossier opt/ présent mais binaire absent
  BROKEN_KEGS=""
  for k in node node@20 node@22 node@24 sqlite python@3.11 python@3.12 python@3.13; do
    [[ -d "$BREW_PREFIX/opt/$k" ]] || continue
    bin="$BREW_PREFIX/opt/$k/bin/${k%%@*}"
    if [[ ! -x "$bin" ]]; then
      BROKEN_KEGS="$BROKEN_KEGS $k"
      f_bad "KEG-$k" "keg Homebrew cassé : $BREW_PREFIX/opt/$k (binaire absent)" \
        "brew reinstall $k   (ou suppression : --remove-brew-node pour node*)"
    else
      f_ok "KEG-$k" "keg valide : $k"
    fi
  done

  # sqlite de Homebrew : dylib réellement présente ?
  if [[ -d "$BREW_PREFIX/opt/sqlite" ]]; then
    SQLITE_LIB="$BREW_PREFIX/opt/sqlite/lib/libsqlite3.dylib"
    if [[ -f "$SQLITE_LIB" ]]; then
      f_ok HOMEBREW-SQLITE "libsqlite3.dylib présente ($SQLITE_LIB)"
    else
      f_bad HOMEBREW-SQLITE "sqlite installé mais libsqlite3.dylib absente" \
        "brew reinstall sqlite  (ou : --fix-brew)"
    fi
  fi

  # --- Réparations Homebrew : uniquement sur demande explicite ---------------
  if [[ "$REMOVE_BREW_NODE" == 1 ]]; then
    for k in node node@20 node@22 node@24; do
      if [[ -n "$("$BREW" list --versions "$k" 2>/dev/null)" ]]; then
        if RUN "$BREW" uninstall --ignore-dependencies "$k" > /dev/null 2>&1; then
          f_fix "HOMEBREW-$k" 'désinstallé (Node est désormais géré par nvm)'
        else
          f_warn "HOMEBREW-$k" "désinstallation de $k impossible" \
            "brew uninstall --ignore-dependencies $k"
        fi
      fi
    done
  elif [[ -n "$BROKEN_KEGS" ]]; then
    info "kegs cassés conservés :$BROKEN_KEGS"
    info 'pour les retirer : --remove-brew-node (node*) ou --fix-brew (autres)'
  fi

  if [[ "$FIX_BREW" == 1 ]]; then
    KEG_FIXED=0
    for k in $BROKEN_KEGS; do
      case "$k" in node|node@*) continue ;; esac
      if RUN "$BREW" reinstall "$k" > "$BASE/brew-reinstall-$(echo "$k" | tr '@' '-').log" 2>&1; then
        f_fix "HOMEBREW-$k" "brew reinstall $k : ok"
        KEG_FIXED=1
      else
        f_warn "HOMEBREW-$k" "brew reinstall $k a échoué" \
          "voir $BASE/brew-reinstall-*.log (macOS 13 : compilation possible, donc long)"
      fi
    done
    if [[ -n "$BREW_PREFIX" ]] && [[ -d "$BREW_PREFIX/opt/sqlite" ]] && [[ ! -f "$BREW_PREFIX/opt/sqlite/lib/libsqlite3.dylib" ]]; then
      if RUN "$BREW" reinstall sqlite > "$BASE/brew-reinstall-sqlite.log" 2>&1; then
        f_fix HOMEBREW-SQLITE 'sqlite réinstallé (libsqlite3.dylib restaurée)'
        SQLITE_LIB="$BREW_PREFIX/opt/sqlite/lib/libsqlite3.dylib"
      else
        f_warn HOMEBREW-SQLITE 'brew reinstall sqlite a échoué' \
          "voir $BASE/brew-reinstall-sqlite.log"
      fi
    fi
    [[ "$KEG_FIXED" -eq 0 ]] && info 'aucun autre keg cassé à réparer'
  fi

  RUN "$BREW" cleanup || warn 'brew cleanup a échoué'
fi

# =============================================================================
# 3. conda — installation, env de base, sqlite, activation
# =============================================================================
say 'conda'

CONDA=""
CONDA_BASE=""

# Un script non interactif ne source pas ~/.zshrc : conda n'est donc pas
# forcément dans le PATH alors qu'il est bien installé.
if have conda; then
  CONDA="$(command -v conda)"
else
  for c in "$HOME/miniconda3/bin/conda" "$HOME/anaconda3/bin/conda" \
           "$HOME/miniforge3/bin/conda" "/opt/miniconda3/bin/conda" \
           "/opt/anaconda3/bin/conda" \
           "/opt/homebrew/Caskroom/miniconda/base/bin/conda" \
           "/usr/local/Caskroom/miniconda/base/bin/conda"; do
    if [[ -x "$c" ]]; then CONDA="$c"; break; fi
  done
fi

if [[ -z "$CONDA" ]]; then
  f_warn CONDA 'aucune installation conda détectée' \
    'si un terminal affiche « (base) », conda est ailleurs : relance avec --scan ~/opt ou signale-le'
else
  CONDA_BASE="$("$CONDA" info --base 2>/dev/null | head -1 || true)"
  info "conda : $CONDA"
  info "base  : ${CONDA_BASE:-inconnue}"
fi

# Plusieurs installations concurrentes = sources d'erreurs silencieuses
INSTALLS=""
for d in "$HOME/miniconda3" "$HOME/anaconda3" "$HOME/miniforge3" \
         "/opt/miniconda3" "/opt/anaconda3" \
         "/opt/homebrew/Caskroom/miniconda/base" "/usr/local/Caskroom/miniconda/base"; do
  [[ -d "$d" ]] && INSTALLS="$INSTALLS $d"
done
INSTALL_N="$(printf '%s\n' $INSTALLS | grep -c . || true)"
if [[ "${INSTALL_N:-0}" -gt 1 ]]; then
  f_warn CONDA-MULTI "$INSTALL_N installations conda détectées :$INSTALLS" \
    'garde-en une seule (celle qui sert vraiment) et désinstalle les autres manuellement'
elif [[ "${INSTALL_N:-0}" -eq 1 ]]; then
  f_ok CONDA-MULTI "une seule installation conda :$INSTALLS"
fi

# Variable d'environnement pointant vers une installation supprimée
if [[ -n "${CONDA_EXE:-}" ]] && [[ ! -x "${CONDA_EXE:-}" ]]; then
  f_bad CONDA-EXE "CONDA_EXE pointe vers un binaire absent : $CONDA_EXE" \
    'ferme le terminal ; vérifie ~/.zshrc (bloc « conda initialize » obsolète)'
fi

if [[ -n "$CONDA" ]]; then
  CONDA_VER="$("$CONDA" --version 2>&1 || true)"
  if "$CONDA" --version >/dev/null 2>&1; then
    f_ok CONDA-CLI "$CONDA_VER"
  else
    f_bad CONDA-CLI "conda ne répond pas : $CONDA_VER" \
      'conda clean --all -y ; si ça persiste : réinstalle Miniconda'
  fi

  # ~/.condarc illisible : casse TOUTES les commandes conda
  if [[ -f "$HOME/.condarc" ]]; then
    if "$CONDA" config --show-sources > "$BASE/conda-sources.txt" 2>&1; then
      f_ok CONDA-CONDARC '~/.condarc lisible'
    else
      f_bad CONDA-CONDARC '~/.condarc illisible (YAML invalide ?)' \
        "mv ~/.condarc ~/.condarc.bak   (copie déjà dans $BASE/backups)"
    fi
  fi

  # Activation automatique de « base » dans chaque nouveau terminal
  AUTO="$("$CONDA" config --get auto_activate_base 2>/dev/null | tr -d '[:space:]' || true)"
  if [[ "$AUTO" == "true" ]]; then
    if RUN "$CONDA" config --set auto_activate_base false; then
      f_fix CONDA-AUTOACTIVATE 'auto_activate_base passé à false (réversible)'
    else
      f_warn CONDA-AUTOACTIVATE 'auto_activate_base reste à true' \
        'conda config --set auto_activate_base false'
    fi
  else
    f_ok CONDA-AUTOACTIVATE "auto_activate_base = ${AUTO:-false}"
  fi

  # Bloc « conda initialize » présent dans ~/.zshrc ?
  ZSHRC_TMP="$HOME/.zshrc"
  if [[ -f "$ZSHRC_TMP" ]]; then
    INIT_N="$(grep -c '# >>> conda initialize >>>' "$ZSHRC_TMP" 2>/dev/null || echo 0)"
    if [[ "${INIT_N:-0}" -eq 0 ]]; then
      if [[ "$DRY_RUN" == 1 ]]; then
        f_warn CONDA-INIT 'aucun bloc « conda initialize » dans ~/.zshrc' \
          'conda init zsh (serait exécuté)'
      elif "$CONDA" init zsh > "$BASE/conda-init.txt" 2>&1; then
        f_fix CONDA-INIT 'bloc « conda initialize » ajouté à ~/.zshrc'
      else
        f_warn CONDA-INIT 'conda init zsh a échoué' "détail : $BASE/conda-init.txt"
      fi
    elif [[ "${INIT_N:-0}" -gt 1 ]]; then
      f_warn CONDA-INIT "bloc « conda initialize » présent $INIT_N fois dans ~/.zshrc" \
        'garde un seul bloc (sinon PATH multiplié)'
    else
      f_ok CONDA-INIT 'bloc « conda initialize » présent une fois'
    fi
  fi

  # DYLD_LIBRARY_PATH : mélange conda/Homebrew → « Library not loaded »
  if [[ -n "${DYLD_LIBRARY_PATH:-}" ]] && [[ "$DYLD_LIBRARY_PATH" == *conda* || "$DYLD_LIBRARY_PATH" == *miniconda* ]]; then
    f_bad CONDA-DYLD "DYLD_LIBRARY_PATH pointe vers conda : $DYLD_LIBRARY_PATH" \
      'unset DYLD_LIBRARY_PATH (ne le définis pas dans ~/.zshrc)'
  fi

  # Le cœur du problème « sqlite incompatible » côté Python
  if [[ -n "$CONDA_BASE" ]] && [[ -d "$CONDA_BASE" ]]; then
    CPY="$CONDA_BASE/bin/python"
    SQLITE_DYLIB="$CONDA_BASE/lib/libsqlite3.dylib"
    if [[ -f "$SQLITE_DYLIB" ]]; then
      f_ok CONDA-SQLITE-DYLIB "libsqlite3.dylib présente dans la base conda"
    else
      f_bad CONDA-SQLITE-DYLIB "libsqlite3.dylib absente de $CONDA_BASE/lib" \
        'conda install -y -n base sqlite'
    fi

    if [[ -x "$CPY" ]]; then
      PY_SQLITE="$("$CPY" -c 'import sqlite3;print(sqlite3.sqlite_version)' 2>&1 | tail -3 || true)"
      if "$CPY" -c 'import sqlite3' >/dev/null 2>&1; then
        f_ok CONDA-SQLITE-PY "python de base : sqlite3 OK (SQLite $PY_SQLITE)"
      else
        f_bad CONDA-SQLITE-PY 'le python de conda ne peut pas importer sqlite3' \
          "message : $(printf '%s' "$PY_SQLITE" | tr '\n' ' ')"
        if [[ "$DRY_RUN" == 1 ]]; then
          info '(dry-run : conda install -y -n base sqlite)'
        elif RUN "$CONDA" install -y -n base sqlite > "$BASE/conda-fix-sqlite.txt" 2>&1; then
          if "$CPY" -c 'import sqlite3' >/dev/null 2>&1; then
            f_fix CONDA-SQLITE-PY 'sqlite réinstallé dans la base conda (python OK)'
          else
            f_warn CONDA-SQLITE-PY 'sqlite réinstallé mais import toujours en échec' \
              "détail : $BASE/conda-fix-sqlite.txt"
          fi
        else
          f_warn CONDA-SQLITE-PY 'conda install sqlite a échoué' \
            "détail : $BASE/conda-fix-sqlite.txt"
        fi
      fi
    else
      f_bad CONDA-PYTHON "python de base introuvable ($CPY)" \
        'conda install -y -n base python'
    fi

    # Dylibs de la base conda en conflit avec celles de Homebrew
    if [[ -n "$SQLITE_LIB" ]] && [[ -f "$SQLITE_DYLIB" ]]; then
      A="$(shasum "$SQLITE_DYLIB" 2>/dev/null | cut -d' ' -f1 || true)"
      B="$(shasum "$SQLITE_LIB" 2>/dev/null | cut -d' ' -f1 || true)"
      if [[ -n "$A" ]] && [[ "$A" != "$B" ]]; then
        f_warn CONDA-HOMEBREW-SQLITE 'deux libsqlite3.dylib différentes (conda + Homebrew)' \
          'normal, mais ne mélange pas : un terminal pour conda, un pour Homebrew'
      fi
    fi
  fi

  # Entretien : uniquement des caches, aucun environnement ni paquet
  RUN "$CONDA" clean --all -y > /dev/null 2>&1 || true
fi

# =============================================================================
# 4. Node.js — nvm, PATH morts, kegs
# =============================================================================
say 'Node.js'

export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"

# 4a. ~/.zshrc : un seul bloc géré, placé en fin de fichier (donc après conda)
ZSHRC="$HOME/.zshrc"
if [[ "$DRY_RUN" == 1 ]]; then
  info '(dry-run : ~/.zshrc non modifié)'
else
  touch "$ZSHRC"
  if ! grep -Fq '# >>> fix-node-mac nvm >>>' "$ZSHRC"; then
    cat >> "$ZSHRC" <<'BLOCK'

# >>> fix-node-mac nvm >>>
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
# <<< fix-node-mac nvm <<<
BLOCK
    info 'bloc nvm ajouté en fin de ~/.zshrc'
  fi
fi

# 4b. Lignes PATH mortes : la cause du « node@20: No such file or directory »
DEAD_RE='^[^#].*(/opt/homebrew/opt|/usr/local/opt)/node(@[0-9]+)?/bin([:/].*)?$'
DEAD_N=0
for f in "$HOME/.zshrc" "$HOME/.zprofile" "$HOME/.zshenv" "$HOME/.bash_profile" "$HOME/.profile"; do
  [[ -f "$f" ]] || continue
  if grep -qE "$DEAD_RE" "$f" 2>/dev/null; then
    DEAD_N=$((DEAD_N+1))
    if [[ "$DRY_RUN" == 1 ]]; then
      f_warn "PATH-MORT:$(basename "$f")" 'chemin node@xx mort à commenter'
      grep -nE "$DEAD_RE" "$f" | sed 's/^/         /'
    else
      sedi -E "s~($DEAD_RE)~# [fix-node-mac] désactivé : \1~" "$f"
      f_fix "PATH-MORT:$(basename "$f")" 'lignes PATH node@xx commentées (sauvegarde faite)'
    fi
  fi
done
[[ "$DEAD_N" -eq 0 ]] && f_ok PATH-MORT 'aucun chemin node@xx mort dans les configs'

# 4c. nvm
if [[ ! -s "$NVM_DIR/nvm.sh" ]]; then
  if have curl; then
    INSTALLER="$BASE/nvm-install.sh"
    if RUN curl --fail --location --show-error --silent --retry 3 \
         "https://raw.githubusercontent.com/nvm-sh/nvm/${NVM_VERSION}/install.sh" -o "$INSTALLER" \
       && [[ "$DRY_RUN" != 1 ]]; then
      # PROFILE=/dev/null : le bloc est ajouté plus haut, de façon idempotente
      if PROFILE=/dev/null METHOD=script bash "$INSTALLER" > "$BASE/nvm-install.log" 2>&1; then
        f_fix NVM "nvm $NVM_VERSION installé"
      else
        f_bad NVM 'installation de nvm échouée' "détail : $BASE/nvm-install.log"
      fi
    elif [[ "$DRY_RUN" == 1 ]]; then
      info '(dry-run : nvm serait installé)'
    else
      f_bad NVM 'téléchargement de nvm impossible (réseau / proxy)' \
        'curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.8/install.sh -o /tmp/nvm.sh && bash /tmp/nvm.sh'
    fi
  else
    f_bad NVM 'curl indisponible : nvm ne peut pas être installé'
  fi
else
  f_ok NVM "nvm présent ($NVM_DIR)"
fi

if [[ -s "$NVM_DIR/nvm.sh" ]]; then
  # shellcheck disable=SC1090
  . "$NVM_DIR/nvm.sh"
fi

# 4d. Version cible : 24 si macOS >= 13.5, sinon 22 (binaires officiels)
if [[ -z "$NODE_MAJOR" ]]; then
  if [[ "$MAJOR" -lt 13 ]] || { [[ "$MAJOR" -eq 13 ]] && [[ "$MINOR" -lt 5 ]]; }; then
    NODE_MAJOR=22
  else
    NODE_MAJOR=24
  fi
fi
info "version Node cible : $NODE_MAJOR"

if have nvm; then
  if [[ "$DRY_RUN" == 1 ]]; then
    info "(dry-run : nvm install $NODE_MAJOR ; alias default ; nvm use)"
  else
    if nvm install "$NODE_MAJOR" > "$BASE/nvm-node.log" 2>&1; then
      nvm alias default "$NODE_MAJOR" > /dev/null 2>&1 || warn 'alias default non modifié'
      nvm use "$NODE_MAJOR" > /dev/null 2>&1 || warn "nvm use $NODE_MAJOR a échoué"
      f_fix NODE "Node $NODE_MAJOR installé et par défaut ($(node -v 2>/dev/null)); npm $(npm -v 2>/dev/null)"
    else
      f_bad NODE "nvm install $NODE_MAJOR a échoué" "détail : $BASE/nvm-node.log"
    fi
  fi

  # Autres versions présentes : utile pour les projets qui ont un .nvmrc
  PREV="$(ls "$NVM_DIR/versions/node" 2>/dev/null | tr '\n' ' ' || true)"
  [[ -n "${PREV// /}" ]] && info "versions installées : $PREV"
else
  f_bad NODE-UNMANAGED 'Node ne peut pas être installé via nvm (nvm indisponible)'
fi

# =============================================================================
# 5. Modules natifs — l'autre « sqlite incompatible » (ABI Node)
# =============================================================================
say 'Modules natifs (ABI Node)'

NATIVE_MODS="better-sqlite3 sqlite3 sharp esbuild bcrypt canvas node-sass"
CUR_ABI="$(node -p 'process.versions.modules' 2>/dev/null || echo '?')"
info "ABI Node attendue : $CUR_ABI (node $(node -v 2>/dev/null))"

SEEN="$BASE/.tmp.seen"
: > "$SEEN"
FOUND_NATIVE=0

for root in $PWD $SCAN_DIRS "$HOME/dev" "$HOME/Developer" "$HOME/Projects" \
            "$HOME/Documents" "$HOME/Desktop" "$HOME/code" "$HOME/src" "$HOME/github"; do
  [[ -d "$root" ]] || continue
  root="$(cd "$root" && pwd -P)"
  grep -qxF "root:$root" "$SEEN" && continue
  echo "root:$root" >> "$SEEN"

  for mod in $NATIVE_MODS; do
    while IFS= read -r d; do
      [[ -n "$d" ]] || continue
      proj="${d%/node_modules/*}"
      [[ "$proj" == "$d" ]] && continue
      key="mod:$proj/$mod"
      grep -qxF "$key" "$SEEN" && continue
      echo "$key" >> "$SEEN"
      FOUND_NATIVE=$((FOUND_NATIVE+1))

      if ( cd "$proj" && node -e "require('$mod')" >/dev/null 2>&1 ); then
        f_ok "NATIF:$mod" "charge correctement ($proj)"
      else
        msg="$( cd "$proj" && node -e "try{require('$mod')}catch(e){process.stdout.write(String(e.message).split('\n')[0])}" 2>&1 | head -1 )"
        case "$msg" in
          *NODE_MODULE_VERSION*)
            f_bad "NATIF-ABI:$mod" "compilé pour une autre version de Node ($proj)" \
              "npm rebuild $mod   (ou --fix-native) — message : $msg"
            ;;
          *"Cannot find module"*|*"Could not locate the bindings file"*)
            f_bad "NATIF-BUILD:$mod" "binaire natif absent ou incomplet ($proj)" \
              "rm -rf node_modules && npm ci   (ou --fix-native)"
            ;;
          *)
            f_warn "NATIF:$mod" "ne se charge pas ($proj)" \
              "message : $msg"
            ;;
        esac

        if [[ "$FIX_NATIVE" == 1 ]]; then
          if [[ "$DRY_RUN" == 1 ]]; then
            info "(dry-run : reconstruction de $mod dans $proj)"
          else
            info "reconstruction : $mod dans $proj"
            (
              cd "$proj" || exit 1
              if [[ -f .nvmrc ]] && have nvm; then
                want="$(tr -d 'v[:space:]' < .nvmrc | head -1)"
                [[ -n "$want" ]] && nvm install "$want" >/dev/null 2>&1 && nvm use "$want" >/dev/null 2>&1
              fi
              if [[ -f pnpm-lock.yaml ]] && have pnpm; then pnpm install
              elif [[ -f yarn.lock ]] && have yarn; then yarn install
              elif [[ -f package-lock.json ]]; then npm ci
              else npm rebuild "$mod"
              fi
            ) > "$BASE/native-$(echo "$mod" | tr '/' '_').log" 2>&1
            if ( cd "$proj" && node -e "require('$mod')" >/dev/null 2>&1 ); then
              f_fix "NATIF-REBUILD:$mod" "reconstruit et fonctionnel ($proj)"
            else
              f_warn "NATIF-REBUILD:$mod" "reconstruction sans effet ($proj)" \
                "voir $BASE/native-*.log · installer les CLT puis : npm rebuild --build-from-source"
            fi
            # revient sur la version par défaut
            nvm use "$NODE_MAJOR" >/dev/null 2>&1 || true
          fi
        fi
      fi
    done < <(find "$root" -maxdepth 5 -type d -path "*/node_modules/$mod" -print 2>/dev/null)
  done
done

if [[ "$FOUND_NATIVE" -eq 0 ]]; then
  info 'aucun module natif trouvé dans les dossiers scannés'
  info "d'autres projets ? relance avec : --scan ~/chemin/du/projet"
fi

# =============================================================================
# 6. Vérification finale
# =============================================================================
say 'Vérification'

NODE_NOW="$(command -v node 2>/dev/null || true)"
if [[ -z "$NODE_NOW" ]]; then
  f_bad VERIF-NODE 'node introuvable dans ce shell'
else
  case "$NODE_NOW" in
    *".nvm/versions/node"*) f_ok VERIF-NODE "node vient de nvm ($NODE_NOW)" ;;
    *) f_warn VERIF-NODE "node ne vient pas de nvm : $NODE_NOW" \
         "un autre PATH passe avant — vérifie l’ordre des blocs dans ~/.zshrc" ;;
  esac
fi

if [[ "$DRY_RUN" != 1 ]] && have npm; then
  npm cache verify > /dev/null 2>&1 && f_ok NPM-CACHE 'npm cache verify : ok' \
    || f_warn NPM-CACHE 'npm cache verify a échoué'
fi

# Test dans le shell que la personne ouvrira vraiment
if have zsh; then
  if [[ "$DRY_RUN" == 1 ]]; then
    info '(dry-run : shell zsh neuf non testé)'
  else
    if have perl; then
      ZOUT="$(perl -e 'alarm shift; exec @ARGV' 25 zsh -lic 'command -v node; node -v; command -v conda' 2>&1 | tr -d '\r')"
    else
      ZOUT="$(zsh -lic 'command -v node; node -v; command -v conda' 2>&1 | tr -d '\r')"
    fi
    printf '%s\n' "$ZOUT" > "$BASE/zsh-neuf.txt"
    if printf '%s' "$ZOUT" | grep -qE "^v${NODE_MAJOR}\."; then
      f_ok VERIF-ZSH "shell zsh neuf : node v$NODE_MAJOR.x ($(printf '%s' "$ZOUT" | grep -m1 '^/') )"
    else
      f_bad VERIF-ZSH "dans un shell zsh neuf, node n’est pas en v$NODE_MAJOR" \
        "détail : $BASE/zsh-neuf.txt · ouvre un nouveau terminal (ou : exec zsh -l)"
    fi
    if [[ -n "$CONDA" ]] && ! printf '%s' "$ZOUT" | grep -q '/conda$'; then
      f_warn VERIF-ZSH-CONDA 'conda absent du PATH dans un shell zsh neuf' \
        'conda init zsh, puis nouveau terminal'
    fi
  fi
fi

# SQLite : les trois implémentations, pour lever le doute
say 'SQLite (les trois origines possibles)'
if have sqlite3; then
  info "CLI système : $(command -v sqlite3) → $(sqlite3 --version 2>/dev/null | cut -d' ' -f1)"
else
  info 'CLI système : absent (optionnel, lié à Xcode)'
fi
if [[ -n "$SQLITE_LIB" ]]; then
  info "Homebrew     : ${SQLITE_LIB} ($([[ -f "$SQLITE_LIB" ]] && echo présente || echo ABSENTE))"
fi
if [[ -n "$CONDA_BASE" ]] && [[ -x "$CONDA_BASE/bin/python" ]]; then
  info "conda python : $("$CONDA_BASE/bin/python" -c 'import sqlite3;print(sqlite3.sqlite_version)' 2>&1 | tail -1)"
fi
info "node (modules natifs) : ABI $CUR_ABI — voir section 5 du rapport"

# =============================================================================
# 7. Rapport
# =============================================================================
say 'Rapport'

{
  printf 'macOS: %s (%s)\nArchitecture: %s\n' "$MACOS" "$BUILD" "$ARCH"
  printf 'Node: %s\nnpm: %s\nNode path: %s\n' \
    "$(node -v 2>/dev/null)" "$(npm -v 2>/dev/null)" "$(command -v node 2>/dev/null)"
  printf 'nvm default: %s\n' "$(nvm alias default 2>/dev/null | tail -1)"
  printf 'conda: %s\nconda base: %s\n' "${CONDA:-absent}" "${CONDA_BASE:-inconnue}"
  printf 'Homebrew: %s\n' "${BREW:-absent}"
  printf 'Xcode CLT: %s\n' "$(xcode-select -p 2>/dev/null || echo absent)"
} > "$BASE/after.txt"

{
  echo "# Rapport d'environnement — $STAMP"
  echo
  echo "\`$(hostname)\` · macOS $MACOS ($BUILD) · $ARCH"
  echo
  echo "## Bilan"
  echo
  echo "| Statut | Nombre |"
  echo "|---|---|"
  echo "| ✅ OK | $OK_N |"
  echo "| ⚠️ gênant | $WARN_N |"
  echo "| ❌ cassé | $BAD_N |"
  echo "| 🔧 corrigé | $FIX_N |"
  echo
  echo "## Journal des problèmes"
  echo
  echo '```'
  cat "$FINDINGS"
  echo '```'
  echo
  echo "## Actions effectuées"
  echo
  if [[ -s "$ACTIONS" ]]; then
    echo '```'; cat "$ACTIONS"; echo '```'
  else
    echo "_aucune_"
  fi
  echo
  echo "## État final"
  echo
  echo '```'; cat "$BASE/after.txt"; echo '```'
  echo
  echo "## Pièces jointes"
  echo
  ls -1 "$BASE" | sed 's/^/- `/; s/$/`/'
  echo
  echo "## Sauvegardes"
  echo
  ls -1 "$BASE/backups" | sed 's/^/- `/; s/$/`/'
} > "$BASE/report.md"

# =============================================================================
# 8. Synthèse
# =============================================================================
say 'Synthèse'
printf '  OK %s · gênant %s · cassé %s · corrigé %s\n' "$OK_N" "$WARN_N" "$BAD_N" "$FIX_N"

REMAIN="$BASE/.tmp.remain"
grep -E '^\[(BROKEN|WARN)\]' "$FINDINGS" > "$REMAIN" 2>/dev/null || true
if [[ -s "$REMAIN" ]]; then
  echo
  echo '  Points restants à traiter :'
  sed 's/^/    /' "$REMAIN"
fi

echo
echo "  Rapport lisible : $BASE/report.md"
echo "  Problèmes       : $FINDINGS"
echo "  Actions         : $ACTIONS"
echo "  Sauvegardes     : $BASE/backups"
echo
echo '  Aucun paquet, projet, environnement conda ni formule Homebrew n’a été supprimé.'
echo '  Ferme ce terminal, réouvres-en un nouveau, puis : node -v && npm -v && which node'

if [[ "$BAD_N" -gt 0 ]]; then
  echo
  echo '  → Des points cassés subsistent : envoie ~/mac-dev-cleanup-*/report.md pour analyse.'
  exit 1
fi
exit 0
