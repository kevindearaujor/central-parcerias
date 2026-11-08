// Uso: docker compose exec app node src/reset-senha.js email@exemplo.com novaSenha
'use strict';
const { db, hashPassword } = require('./db');
const [email, senha] = process.argv.slice(2);
if (!email || !senha || senha.length < 6) { console.log('Uso: node src/reset-senha.js email novaSenha (mínimo 6 caracteres)'); process.exit(1); }
const r = db.prepare('UPDATE users SET pass = ?, active = 1 WHERE email = ?').run(hashPassword(senha), email.toLowerCase().trim());
console.log(r.changes ? 'Senha alterada.' : 'Nenhum usuário com esse e-mail.');
