#!/usr/bin/env bash
set -euo pipefail

# Clone or update HotM repository

REPO_URL="https://git.integrolabs.net/Fortemi/HotM.git"

if [ -d "${INSTALL_DIR}/.git" ]; then
  echo "Repository already exists at ${INSTALL_DIR}, pulling latest..."
  cd "${INSTALL_DIR}"
  git fetch origin
  git checkout "${BRANCH}"
  git pull origin "${BRANCH}"
else
  echo "Cloning HotM (branch: ${BRANCH}) into ${INSTALL_DIR}..."
  git clone --branch "${BRANCH}" "${REPO_URL}" "${INSTALL_DIR}"
fi

echo "Clone complete."
