#!/bin/bash
# =============================================================================
# scripts/fix-node-mac.sh — remet Node.js d'aplomb sur macOS, sans rien casser
# -----------------------------------------------------------------------------
# Cas d'usage : terminal en `(base)` conda sur macOS 13, et une erreur du type
#     env: node: No such file or directory
#     /opt/homebrew/opt/node@20/bin/node: No such file or directory
# → keg Homebrew incomplet + PATH mort codé dans ~/.zshrc + conda qui masque
#   node. On installe Node via nvm et on neutralise les sources de conflit.
#
# Ce script NE SUPPRIME RIEN par défaut : ni environnement conda, ni formule
# Homebrew, ni ligne de configuration (elle sont commentées, après sauvegarde).
# Les seules écritures : ~/.zshrc (bloc géré + lignes PATH mortes commentées),
# ~/.nvm, et le dossier de rapport ~/mac-dev-cleanup-<date>/.
#
# Usage :
#   bash scripts/fix-node-mac.sh --dry-run       # diagnostic seul, n'écrit rien
#   bash scripts/fix-node-mac.sh                 # répare
#   bash scripts/fix-node-mac.sh --node 22       # force la version par défaut
#   bash scripts/fix-node-mac.sh --remove-brew-node  # + désinstalle node* Homebrew
#   bash scripts/fix-node-mac.sh --help
#
# Compatible bash 3.2 (celui livré avec macOS). Testé en lecture seule.
# =============================================================================

set -Eeuo pipefail
umask 077

if [[ "$(uname -s)" != Darwin ]]; then
  echo 'Ce script est prévu pour macOS.' >&2
  exit 1
fi
if [[ "$EUID" -eq 0 ]]; then
  echo 'Lance-le avec ton compte habituel, sans sudo.' >&2
  exit 1
fi

NVM_VERSION="v0.40.8"
NODE_MAJOR=""
DRY_RUN=0
REMOVE_BREW_NODE=0

case "${1:-}" in
  --help|-h)
    sed -n '2,28p' "$0" | sed 's/^# \{0,1\}//; s/^#//'
    exit 0
    ;;
esac

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=1 ;;
    --remove-brew-node) REMOVE_BREW_NODE=1 ;;
    --node) shift; NODE_MAJOR="${1:-}" ;;
    --node=*) NODE_MAJOR="${1#*=}" ;;
    --help|-h) : ;;
    *) echo "Argument inconnu : $1 (ignoré)" >&2 ;;
  esac
  shift
done

if [[ -n "$NODE_MAJOR" ]] && [[ ! "$NODE_MAJOR" =~ ^[0-9]+$ ]]; then
  echo "Version Node invalide : « $NODE_MAJOR » (attendu : 20, 22 ou 24)." >&2
  exit 2
fi

STAMP="$(date +%Y%m%d_%H%M%S)"
BASE="$HOME/mac-dev-cleanup-$STAMP"
mkdir -p "$BASE/backups"
LOG="$BASE/run.log"
exec > >(tee -a "$LOG") 2>&1

say()  { printf '\n==> %s\n' "$*"; }
warn() { printf 'ATTENTION: %s\n' "$*" >&2; }
info() { printf '    %s\n' "$*"; }

# RUN : respecte --dry-run pour toute action qui modifie le système
RUN() {
  info "\$ $*"
  if [[ "$DRY_RUN" == 1 ]]; then
    info "(dry-run : non exécuté)"
    return 0
  fi
  "$@"
}

sedi() { sed -i '' "$@"; }   # BSD sed, macOS

say "Rapport : $BASE"
[[ "$DRY_RUN" == 1 ]] && warn 'MODE DRY-RUN : aucune modification ne sera appliquée.'

# =============================================================================
# 1. Sauvegardes + état des lieux
# =============================================================================
backup() {
  local f="$1"
  [[ -f "$f" ]] && cp -p "$f" "$BASE/backups/$(basename "$f")"
  return 0
}
for f in "$HOME/.zshrc" "$HOME/.zprofile" "$HOME/.zshenv" \
         "$HOME/.bash_profile" "$HOME/.bashrc" "$HOME/.npmrc"; do
  backup "$f"
done
say "Sauvegardes : $BASE/backups (restauration : cp -p \"$BASE/backups/.zshrc\" ~/.zshrc)"

{
  sw_vers; uname -m
  /usr/bin/which -a node npm brew 2>/dev/null || true
  for p in $(/usr/bin/which -a node 2>/dev/null); do
    printf '%s -> ' "$p"; "$p" -v 2>&1 || true
  done
} > "$BASE/before.txt" 2>&1

ARCH="$(uname -m)"
MACOS="$(sw_vers -productVersion)"
MAJOR="${MACOS%%.*}"; REST="${MACOS#*.}"; MINOR="${REST%%.*}"

# Node 24 : binaires officiels pour macOS >= 13.5 ; sinon Node 22 (macOS >= 11)
if [[ -z "$NODE_MAJOR" ]]; then
  if [[ "$MAJOR" -lt 13 ]] || { [[ "$MAJOR" -eq 13 ]] && [[ "$MINOR" -lt 5 ]]; }; then
    NODE_MAJOR=22
  else
    NODE_MAJOR=24
  fi
fi
say "macOS $MACOS ($ARCH) ; Node cible : $NODE_MAJOR"

# =============================================================================
# 2. Diagnostic des sources de conflit
# =============================================================================
say 'Diagnostic'
BROKEN_KEG=""
for d in /opt/homebrew/opt /usr/local/opt; do
  for k in node node@20 node@22 node@24; do
    if [[ -d "$d/$k" ]]; then
      if [[ -x "$d/$k/bin/node" ]]; then
        info "keg Homebrew valide : $d/$k ($("$d/$k/bin/node" -v 2>/dev/null))"
      else
        warn "keg Homebrew cassé : $d/$k (binaire absent → cause probable de l'erreur)"
        BROKEN_KEG="$d/$k"
      fi
    fi
  done
done

# conda n'est pas toujours dans le PATH d'un script non interactif
CONDA=""
if command -v conda >/dev/null 2>&1; then
  CONDA="$(command -v conda)"
else
  for c in "$HOME/miniconda3/bin/conda" "$HOME/anaconda3/bin/conda" \
           "$HOME/miniforge3/bin/conda" "/opt/miniconda3/bin/conda" \
           "/opt/homebrew/Caskroom/miniconda/base/bin/conda"; do
    [[ -x "$c" ]] && { CONDA="$c"; break; }
  done
fi
if [[ -n "$CONDA" ]]; then
  info "conda : $CONDA"
  CONDA_BASE="$("$CONDA" info --base 2>/dev/null || true)"
  if [[ -n "$CONDA_BASE" ]] && [[ -x "$CONDA_BASE/bin/node" ]]; then
    warn "conda embarque son propre node ($CONDA_BASE/bin/node) → conflit possible"
  fi
else
  info 'conda : absent'
fi

if [[ -f "$HOME/.npmrc" ]] && grep -qE '^[[:space:]]*prefix[[:space:]]*=.*(homebrew|opt)/' "$HOME/.npmrc"; then
  warn "~/.npmrc contient un « prefix » vers Homebrew (à vérifier : npm config get prefix)"
fi

# =============================================================================
# 3. Conda : ne plus activer « base » automatiquement (aucun env supprimé)
# =============================================================================
if [[ -n "$CONDA" ]]; then
  say 'Conda : désactiver l’activation automatique de l’environnement de base'
  RUN "$CONDA" config --set auto_activate_base false \
    || warn 'Réglage conda non modifié'
  info 'réversible : conda config --set auto_activate_base true'
  info 'terminal déjà ouvert : tape « conda deactivate »'
else
  say 'Conda : absent, rien à faire'
fi

# =============================================================================
# 4. Homebrew : uniquement de l’entretien (jamais de suppression implicite)
# =============================================================================
BREW=""
for candidate in /opt/homebrew/bin/brew /usr/local/bin/brew; do
  if [[ -x "$candidate" ]]; then BREW="$candidate"; break; fi
done

if [[ -n "$BREW" ]]; then
  say 'Homebrew : entretien (caches et anciennes versions uniquement)'
  RUN "$BREW" cleanup || warn 'brew cleanup a échoué'
  RUN "$BREW" doctor > "$BASE/brew-doctor.txt" 2>&1 \
    || warn "brew doctor signale des points à lire dans $BASE/brew-doctor.txt"
  if [[ "$MAJOR" -lt 14 ]]; then
    info "macOS $MAJOR est en support « Tier 3 » pour Homebrew : certains paquets"
    info 'seront compilés (lent). Cela ne concerne pas Node, fourni par nvm.'
  fi

  if [[ "$REMOVE_BREW_NODE" == 1 ]]; then
    for k in node node@20 node@22 node@24; do
      if [[ -n "$("$BREW" list --versions "$k" 2>/dev/null)" ]]; then
        say "Homebrew : désinstallation de $k (demandée par --remove-brew-node)"
        RUN "$BREW" uninstall --ignore-dependencies "$k" || warn "$k non désinstallé"
      fi
    done
  elif [[ -n "$BROKEN_KEG" ]]; then
    info "keg cassé conservé. Pour le retirer : bash $0 --remove-brew-node"
  fi
else
  warn 'Homebrew introuvable ; entretien ignoré'
fi

# =============================================================================
# 5. nvm (script officiel téléchargé localement, pas de « curl | bash »)
# =============================================================================
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [[ ! -s "$NVM_DIR/nvm.sh" ]]; then
  say 'nvm : installation'
  command -v curl >/dev/null 2>&1 || { warn 'curl indisponible'; exit 1; }
  INSTALLER="$BASE/nvm-install.sh"
  RUN curl --fail --location --show-error --silent --retry 3 \
    "https://raw.githubusercontent.com/nvm-sh/nvm/${NVM_VERSION}/install.sh" -o "$INSTALLER" \
    || { warn 'téléchargement de nvm impossible (réseau / proxy ?)'; exit 1; }
  if [[ "$DRY_RUN" == 1 ]]; then
    info '(dry-run : installateur non exécuté)'
  else
    # PROFILE=/dev/null : le bloc est ajouté plus bas, de façon idempotente
    PROFILE=/dev/null METHOD=script bash "$INSTALLER" || { warn 'installation de nvm échouée'; exit 1; }
  fi
else
  say 'nvm : déjà présent'
fi

# =============================================================================
# 6. ~/.zshrc : un seul bloc géré + neutralisation des PATH morts
# =============================================================================
ZSHRC="$HOME/.zshrc"
say '~/.zshrc : bloc nvm géré en fin de fichier'
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
    info 'bloc ajouté en fin de fichier (donc après conda → nvm gagne)'
  else
    info 'bloc déjà présent'
  fi
fi

say '~/.zshrc : chemins morts node@xx'
# couvre les deux préfixes Homebrew : /opt/homebrew (Apple Silicon), /usr/local (Intel)
DEAD_RE='^[^#].*(/opt/homebrew/opt|/usr/local/opt)/node(@[0-9]+)?/bin([:/].*)?$'
PATCHED=0
for f in "$HOME/.zshrc" "$HOME/.zprofile" "$HOME/.zshenv" "$HOME/.bash_profile" "$HOME/.profile"; do
  [[ -f "$f" ]] || continue
  if grep -qE "$DEAD_RE" "$f" 2>/dev/null; then
    if [[ "$DRY_RUN" == 1 ]]; then
      info "serait commenté dans $f :"
      grep -nE "$DEAD_RE" "$f" | sed 's/^/      /'
    else
      sedi -E "s~($DEAD_RE)~# [fix-node-mac] désactivé : \1~" "$f"
      info "lignes commentées dans $f (sauvegarde dans $BASE/backups)"
    fi
    PATCHED=1
  fi
done
[[ "$PATCHED" == 0 ]] && info 'aucun chemin mort trouvé'

# =============================================================================
# 7. Node via nvm
# =============================================================================
if [[ -s "$NVM_DIR/nvm.sh" ]]; then
  # shellcheck disable=SC1090
  . "$NVM_DIR/nvm.sh"
fi

if ! command -v nvm >/dev/null 2>&1; then
  warn 'nvm indisponible : impossible d’installer Node'
  exit 1
fi

say "Node : installation de la version $NODE_MAJOR via nvm"
if [[ "$DRY_RUN" == 1 ]]; then
  info "(dry-run : nvm install $NODE_MAJOR ; nvm alias default $NODE_MAJOR)"
else
  nvm install "$NODE_MAJOR" || { warn "nvm install $NODE_MAJOR a échoué"; exit 1; }
  nvm alias default "$NODE_MAJOR" || warn 'alias default non modifié'
  nvm use "$NODE_MAJOR" || warn "nvm use $NODE_MAJOR a échoué"
fi

if [[ "$DRY_RUN" != 1 ]]; then
  say 'npm : vérification du cache (sans suppression)'
  npm cache verify || warn 'npm cache verify a échoué'
fi

# =============================================================================
# 8. Vérification, y compris dans un shell zsh de login neuf
# =============================================================================
say 'Vérification'
if [[ "$DRY_RUN" == 1 ]]; then
  info '(dry-run : arrêt avant vérification)'
else
  hash -r
  {
    printf 'macOS: %s\nArchitecture: %s\n' "$MACOS" "$ARCH"
    printf 'Node: '; node -v
    printf 'npm: '; npm -v
    printf 'Node path: '; command -v node
    printf 'nvm default: '; nvm alias default
    printf 'Conda: %s\n' "$(command -v conda || echo absent)"
    printf 'Homebrew: %s\n' "${BREW:-absent}"
  } | tee "$BASE/after.txt"

  NODE_PATH_NOW="$(command -v node || true)"
  case "$NODE_PATH_NOW" in
    *".nvm/versions/node"*) info 'node vient bien de nvm' ;;
    *) warn "node ne vient pas de nvm : $NODE_PATH_NOW" ;;
  esac

  # Le vrai test : ce que verra la personne dans un terminal neuf
  if command -v zsh >/dev/null 2>&1; then
    set +e
    if command -v perl >/dev/null 2>&1; then
      OUT="$(perl -e 'alarm shift; exec @ARGV' 25 zsh -lic 'command -v node; node -v' 2>&1 | tr -d '\r')"
    else
      OUT="$(zsh -lic 'command -v node; node -v' 2>&1 | tr -d '\r')"
    fi
    set -e
    if printf '%s' "$OUT" | grep -qE "^v${NODE_MAJOR}\."; then
      info "shell zsh neuf : $(printf '%s' "$OUT" | grep -E '^(v[0-9]|/)' | tr '\n' ' ')"
    else
      warn "dans un shell zsh neuf, node n'est pas encore en v$NODE_MAJOR :"
      printf '%s\n' "$OUT" | grep -vE '^[[:space:]]*$' | tail -6 | sed 's/^/      /'
      info 'ouvre un NOUVEAU terminal, ou tape : exec zsh -l'
    fi
  fi
fi

say 'Terminé'
echo 'Ferme ce terminal, réouvres-en un nouveau, puis : node -v && npm -v && which node'
echo 'Changer de version pour un projet : nvm install && nvm use   (lit .nvmrc)'
echo "Sauvegardes et journaux : $BASE"
echo 'Aucun paquet, projet, environnement conda ni formule Homebrew n’a été supprimé.'
