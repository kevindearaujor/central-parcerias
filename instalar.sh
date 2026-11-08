#!/usr/bin/env bash
# Instalação da Central de Parcerias num servidor Ubuntu novo
set -e
cd "$(dirname "$0")"

if ! command -v docker >/dev/null 2>&1; then
  echo ">> Instalando o Docker (leva uns 2 minutos)..."
  curl -fsSL https://get.docker.com | sh
fi

if [ ! -f .env ]; then
  echo
  echo "Vamos configurar. Responda às perguntas abaixo."
  read -rp "Endereço do painel (ex: central.seudominio.com.br): " DOMAIN
  read -rp "Seu nome: " ADMIN_NAME
  read -rp "Seu e-mail (será o login de administrador): " ADMIN_EMAIL
  while true; do
    read -rsp "Crie uma senha de acesso (mínimo 8 caracteres): " ADMIN_PASSWORD; echo
    [ ${#ADMIN_PASSWORD} -ge 8 ] && break
    echo "Senha curta demais, tente de novo."
  done
  gen() { tr -dc 'A-Za-z0-9' </dev/urandom | head -c "$1"; }
  cat > .env <<CONF
DOMAIN=$DOMAIN
ADMIN_NAME=$ADMIN_NAME
ADMIN_EMAIL=$ADMIN_EMAIL
ADMIN_PASSWORD=$ADMIN_PASSWORD
EVOLUTION_KEY=$(gen 40)
WEBHOOK_SECRET=$(gen 40)
POSTGRES_PASSWORD=$(gen 32)
CONF
  chmod 600 .env
  echo ">> Configuração salva em .env"
fi

echo ">> Subindo os serviços..."
docker compose up -d --build
echo
echo "Pronto! Em 1 a 2 minutos acesse: https://$(grep ^DOMAIN= .env | cut -d= -f2)"
echo "Entre com o e-mail e a senha que você criou e vá em Configurações > Conexão do WhatsApp."
