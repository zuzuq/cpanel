const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const readline = require('readline');
    
const tokenPath = path.join(__dirname, './src/database/token.json');

async function getToken() {
    return new Promise((resolve) => {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        rl.question('🔑 Masukkan Token Bot Telegram: ', (token) => {
            rl.close();

            if (!token.trim()) {
                console.log('❌ Token tidak boleh kosong!');
                process.exit(1);
            }

            let data = { token: token.trim() };

            fs.mkdirSync(path.dirname(tokenPath), { recursive: true });
            fs.writeFileSync(tokenPath, JSON.stringify(data, null, 2));

            console.log('✅ Token berhasil disimpan!');
            resolve(token.trim());
        });
    });
}

async function getStoredToken() {
    if (fs.existsSync(tokenPath)) {
        try {
            let data = JSON.parse(fs.readFileSync(tokenPath, 'utf-8'));
            if (data.token && data.token.trim() !== '') {
                return data.token.trim();
            }
        } catch (err) {
            console.error('⚠️ Gagal membaca token.json, meminta token baru...');
        }
    }
    return await getToken();
}

async function start() {
    let token = await getStoredToken();

    let args = [path.join(__dirname, './index.js'), ...process.argv.slice(2)];
    console.log([process.argv[0], ...args].join('\n'));

    let p = spawn(process.argv[0], ['--no-deprecation', ...args], {
        stdio: ['inherit', 'inherit', 'inherit', 'ipc']
    })
    .on('message', data => {
        if (data == 'reset') {
            console.log('🔄 Restarting Bot...');
            p.kill();
            start();
            delete p;
        }
    })
    .on('exit', code => {
        console.error('🚫 Bot berhenti dengan kode:', code);
        if (code == 0 || code == 1) start();
    });
}

start();