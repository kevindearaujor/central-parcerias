# Central de Parcerias · Passo a passo

Painel no navegador que espelha o WhatsApp do número de trabalho para a equipe de corretores. Os clientes que clicam no anúncio chegam aqui na hora, com a origem do anúncio identificada, e cada corretor atende pelo próprio login.

## O que já vem pronto

- **Conversas em tempo real**, com fotos, áudios, vídeos, documentos e os tiques de entregue/lido.
- **Fila de distribuição** (só para o administrador). Ligue a distribuição automática, escolha quem recebe leads e arraste os nomes para definir a ordem do rodízio. Desligada, o lead novo fica em Não lidas e o primeiro corretor que responder assume. Com o repasse ligado, o lead que não for respondido no tempo escolhido (5 min por padrão) passa para o próximo da fila.
- **Origem do anúncio.** Quando o cliente vem de um anúncio "clique para WhatsApp", a conversa mostra qual anúncio foi.
- **Funil em colunas**: Tratativa, Agendamento, Captar documento, Aprovado e Comprou. O lead só entra no funil quando recebe a primeira resposta, já em Tratativa.
- **Perdidos e arquivados** (ícone de alerta na barra lateral). Leads encerrados saem das conversas e do funil. Se o cliente voltar a mandar mensagem, o lead é reativado sozinho.
- **Etiquetas** (Análise assessoria, Fazer follow up, IR 2027, Restrição, Perfil de comprador) e **respostas rápidas** (digite `/` na conversa).
- **Painel** com leads por dia, por anúncio, tempo da 1ª resposta e ranking dos corretores.
- **Permissões**: corretor vê a Fila e as conversas dele, e nunca vê o número de telefone do cliente; administrador vê tudo.
- Funciona no celular. No navegador do celular, use "Adicionar à tela de início" para virar um ícone.

## Do que você precisa

| Item | Sugestão | Custo aproximado |
|---|---|---|
| Número de trabalho | Chip separado com **WhatsApp Business** instalado num celular | o do chip |
| Servidor (VPS) | Ubuntu 24.04, **2 GB de RAM** no mínimo (4 GB é mais folgado) | R$ 30 a 60/mês |
| Endereço do painel | Um subdomínio, ex.: `central.seudominio.com.br` | domínio .com.br ~R$ 40/ano |

Qualquer provedor de VPS serve (Hostinger, Contabo, Hetzner, Locaweb, etc.).

## Instalação (uns 20 minutos)

**1. Contrate o VPS** com Ubuntu 24.04. Anote o **IP** e a **senha do root**.

**2. Aponte o subdomínio para o servidor.** No painel onde você comprou o domínio, crie um registro:

- Tipo `A` · Nome `central` · Valor: o IP do servidor

**3. Envie os arquivos.** No seu computador, abra o Terminal (Mac) ou o PowerShell (Windows), na pasta onde está o `central-parcerias.zip`:

```bash
scp central-parcerias.zip root@IP_DO_SERVIDOR:/root/
ssh root@IP_DO_SERVIDOR
```

**4. Rode o instalador** (já dentro do servidor):

```bash
apt update && apt install -y unzip
unzip central-parcerias.zip && cd central-parcerias
bash instalar.sh
```

Ele instala o Docker, pergunta o endereço do painel, seu nome, e-mail e senha, gera as chaves de segurança e sobe tudo. O HTTPS (cadeado) é configurado sozinho.

**5. Conecte o WhatsApp.** Acesse `https://central.seudominio.com.br`, entre com seu e-mail e senha, vá em **Configurações > Conexão do WhatsApp > Gerar QR Code** e leia com o celular do número de trabalho (WhatsApp > Dispositivos conectados > Conectar dispositivo). Se estiver só no celular, use **Conectar com código**.

**6. Cadastre os corretores** em Configurações > Equipe e mande o e-mail e a senha inicial para cada um.

## Boas práticas para não perder o número

- Use o número **só para atender** quem chama. Nada de disparo em massa ou listas.
- Responda rápido os leads novos: conversa iniciada pelo cliente é o uso mais seguro.
- Deixe o celular do número **ligado e com internet** pelo menos de vez em quando. Se ele ficar uns 14 dias offline, o WhatsApp desconecta os aparelhos vinculados.
- Não conecte o mesmo número em outra plataforma ao mesmo tempo.

## Limites que você precisa saber

- A conexão por QR Code **não é oficial** do WhatsApp. Funciona bem para atendimento normal, mas existe risco de bloqueio, principalmente com envio em massa.
- O histórico **anterior** à conexão não é importado. Só aparece o que chegar ou sair depois de conectar.
- Grupos são ignorados (o foco são os clientes).
- Às vezes o WhatsApp esconde o número de leads de anúncio (aparece "Número oculto pelo WhatsApp"). A conversa funciona normalmente; o número costuma aparecer depois.
- A versão da ponte com o WhatsApp está fixada na Evolution API 2.3.7, porque a 2.4 passou a exigir ativação de licença. Atualize só depois de testar.

## Atualizar depois (com GitHub)

Se a Central foi instalada a partir do GitHub, para aplicar uma versão nova: substitua os arquivos na pasta do repositório, faça Commit + Push no GitHub Desktop e, no terminal do navegador da Hostinger, rode:

```bash
cd ~/central-parcerias && git pull && docker compose up -d --build
```

## Comandos úteis (dentro da pasta `central-parcerias` no servidor)

```bash
docker compose ps                      # ver se está tudo rodando
docker compose logs -f app             # acompanhar o painel
docker compose logs -f evolution       # acompanhar a conexão do WhatsApp
docker compose restart                 # reiniciar tudo
docker compose up -d --build           # aplicar uma nova versão dos arquivos
```

**Backup** dos dados do painel (conversas, funil, usuários):

```bash
docker compose cp app:/app/data ./backup-$(date +%F)
```

## Se algo der errado

- **O QR Code não aparece ou fica girando:** rode `docker compose logs evolution`. Se aparecer erro de versão do WhatsApp, adicione `CONFIG_SESSION_PHONE_VERSION` com a versão atual do WhatsApp Web nas variáveis do serviço `evolution` no `docker-compose.yml` e rode `docker compose up -d`.
- **Mensagens não chegam no painel:** rode `docker compose restart app`. Ao reiniciar, o painel reconfigura o aviso de mensagens novas sem desconectar o número.
- **Site sem cadeado ou fora do ar:** confira se o registro `A` aponta para o IP certo e se as portas 80 e 443 estão liberadas no firewall do provedor.
- **Esqueceu a senha:** outro administrador troca em Configurações > Equipe. Se for o único, rode no servidor:
  `docker compose exec app node src/reset-senha.js seu@email.com NovaSenha123`
