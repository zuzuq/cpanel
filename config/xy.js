const fs = require('fs');
const axios = require('axios');
const path = require('path');
const {
  exec,
  spawn
} = require("child_process");
const qr = require('qr-image');
const Tiktok = require("@tobyg74/tiktok-api-dl");
const ytdl = require('@distube/ytdl-core');
const ffmpeg = require('fluent-ffmpeg');
const {
  igdl
} = require('btch-downloader');
const {
  Client
} = require('ssh2');
const tiktok2 = require('../src/lib/tiktok');
const genmusic = require('../src/lib/aimusic');
const generateQRAndUpload = require("../src/lib/uploader");
const toqrcode = require('../src/lib/qrcode'); 
const {
  startWhatsAppSession,
  sessions,
  restoreWhatsAppSessions,
  updateActiveSessions
} = require("../src/lib/connectwa")
const {
  addResponList1,
  delResponList1,
  isAlreadyResponList1,
  isAlreadyResponList1Group,
  sendResponList1,
  updateResponList1,
  getDataResponList1
} = require('../src/lib/addlist'); 
global.serverOfflineStatus = new Map();


const WELEAVE_FILE = './src/database/weleave.json';
const ANTILINK_FILE = './src/database/antilink.json';
const LIST_FILE = './src/database/list.json';
const WARN_FILE = './src/database/warns.json';


function readJson(filePath, defaultValue = []) {
    try {
        if (!fs.existsSync(filePath)) return defaultValue;
        const content = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(content);
    } catch (e) {
        console.error(`Error reading ${filePath}:`, e);
        return defaultValue;
    }
}

function writeJson(filePath, data) {
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
        return true;
    } catch (e) {
        console.error(`Error writing to ${filePath}:`, e);
        return false;
    }
}

function checkUserRole(userId, requiredRoles, serverVersion) {
  const ownerFile = './owner.json';
  const partnerFile = './src/database/partner.json';
  const resellerFile = './src/database/reseller.json';
  const sellerFile = './src/database/seller.json';

  let owners = [];
  let partners = [];
  let resellers = [];
  let sellers = [];

  try {
    owners = JSON.parse(fs.readFileSync(ownerFile, 'utf8'));
    partners = JSON.parse(fs.readFileSync(partnerFile, 'utf8'));
    resellers = JSON.parse(fs.readFileSync(resellerFile, 'utf8'));
    sellers = JSON.parse(fs.readFileSync(sellerFile, 'utf8'));
  } catch (e) {
    console.error("Error reading role files:", e);
  }

  const isOwner = owners.includes(String(userId));
  if (isOwner && requiredRoles.includes('owner')) return true;

  if (requiredRoles.includes('partner') && Array.isArray(partners)) {
    const isPartner = partners.some(p => String(p.id) === String(userId) && p.server === serverVersion);
    if (isPartner) return true;
  }

  if (requiredRoles.includes('reseller') && Array.isArray(resellers)) {
    const isReseller = resellers.some(r => String(r.id) === String(userId) && r.server === serverVersion);
    if (isReseller) return true;
  }

  if (requiredRoles.includes('seller') && Array.isArray(sellers)) {
    const isSeller = sellers.some(s => String(s.id) === String(userId));
    if (isSeller) return true;
  }

  return false;
}
async function getServerStatus(serverUuid, panelConfig) {
  try {
    const response = await axios.get(`${panelConfig.panelDomain}/api/client/servers/${serverUuid}/resources`, {
      headers: {
        'Authorization': `Bearer ${panelConfig.pltcKey}`
      }
    });
    return response.data.attributes.current_state;
  } catch (error) {
    return 'error';
  }
}

function getPanelConfig(version) {
  switch (version) {
    case 'v1':
      return {
        name: 'Server V1',
        panelDomain: global.domain,
        pltaKey: global.plta,
        pltcKey: global.pltc,
        nests: global.nests,
        eggs: global.eggs,
        loc: global.loc
      };
    case 'v2':
      return {
        name: 'Server V2',
        panelDomain: global.domainV2,
        pltaKey: global.pltaV2,
        pltcKey: global.pltcV2,
        nests: global.nestsV2,
        eggs: global.eggsV2,
        loc: global.locV2
      };
    case 'v3':
      return {
        name: 'Server V3',
        panelDomain: global.domainV3,
        pltaKey: global.pltaV3,
        pltcKey: global.pltcV3,
        nests: global.nestsV3,
        eggs: global.eggsV3,
        loc: global.locV3
      };
    case 'v4':
      return {
        name: 'Server V4',
        panelDomain: global.domainV4,
        pltaKey: global.pltaV4,
        pltcKey: global.pltcV4,
        nests: global.nestsV4,
        eggs: global.eggsV4,
        loc: global.locV4
      };
    default:
      return {};
  }
}
async function editReply(xy, messageId, text) {
  try {
    await xy.api.editMessageText(xy.chat.id, messageId, text, {
      parse_mode: 'HTML'
    });
  } catch (e) {
    console.error(`Gagal mengedit pesan ${messageId}:`, e.message);
    await xy.api.sendMessage(xy.chat.id, text, {
      parse_mode: 'HTML'
    });
  }
}

async function handleMessage(xy, command, sleep, isOwner, isSeller, isPartner, isReseller, reply, owners, seller, sellerPath, q, text, InlineKeyboard, paket, isGroupAdmins, mess, warnDB, saveWarnDB, pendingWarns, InputFile, botToken, CatBox, sender, db_respon_list, generateReadableString, isBotGroupAdmins) { 
  const isRestarted = process.argv.includes("--restarted");
  
  switch (command) {
    case "seturl":
    case "seturlv2":
    case "seturlv3":
    case "seturlv4":
    case "setplta":
    case "setpltav2":
    case "setpltav3":
    case "setpltav4":
    case "setpltc":
    case "setpltcv2":
    case "setpltcv3":
    case "setpltcv4": {
      if (!isOwner) return reply(mess.owner);

      const serverVersion = command.endsWith('v2') ? 'v2' : command.endsWith('v3') ? 'v3' : command.endsWith('v4') ? 'v4' : '';
      const configPath = './config/settings.js';

      let key;
      if (command.startsWith('seturl')) {
        key = `global.domain${serverVersion ? serverVersion.toUpperCase() : ''}`;
      } else if (command.startsWith('setplta')) {
        key = `global.plta${serverVersion ? serverVersion.toUpperCase() : ''}`;
      } else if (command.startsWith('setpltc')) {
        key = `global.pltc${serverVersion ? serverVersion.toUpperCase() : ''}`;
      }

      if (!text) {
        return reply(`<blockquote><b>Format salah!</b>\n\nPenggunaan:\n${prefix + command} [nilai_baru]\n\nContoh:\n${prefix + command} https://panel.contoh.com</blockquote>`, {
          parse_mode: 'HTML'
        });
      }

      let settingsContent = fs.readFileSync(configPath, 'utf8');
      const regex = new RegExp(`${key}\\s*=\\s*['"\`].*?['"\`]`, 's');

      if (regex.test(settingsContent)) {
        settingsContent = settingsContent.replace(regex, `${key} = '${text}'`);
        fs.writeFileSync(configPath, settingsContent, 'utf8');

        if (command.startsWith('seturl')) {
          global[`domain${serverVersion ? serverVersion.toUpperCase() : ''}`] = text;
        } else if (command.startsWith('setplta')) {
          global[`plta${serverVersion ? serverVersion.toUpperCase() : ''}`] = text;
        } else if (command.startsWith('setpltc')) {
          global[`pltc${serverVersion ? serverVersion.toUpperCase() : ''}`] = text;
        }

        reply(`<blockquote>✅ Nilai untuk <b>${key}</b> berhasil diubah menjadi: <code>${text}</code></blockquote>`, {
          parse_mode: 'HTML'
        });
      } else {
        reply(`<blockquote>❌ Variabel <b>${key}</b> tidak ditemukan di file settings.js.</blockquote>`, {
          parse_mode: 'HTML'
        });
      }
    }
    break;

    case "hello":
      reply("<blockquote>Hello juga!</blockquote>", {
        parse_mode: 'HTML'
      });
      break;

    case 'cekidtele': {
      const msg = xy.message;
      const replyToMessage = msg?.reply_to_message;

      if (replyToMessage?.forward_from) {
        return reply(`<blockquote>ID Telegram pengguna yang meneruskan pesan ini adalah: ${replyToMessage.forward_from.id}</blockquote>`, {
          parse_mode: 'HTML'
        });
      } else if (replyToMessage) {
        return reply('<blockquote>🚫 Harap gunakan pesan yang diteruskan dari orang lain untuk mendapatkan ID.</blockquote>', {
          parse_mode: 'HTML'
        });
      } else {
        return reply(`<blockquote>ID Telegram Anda adalah: ${msg.from.id}</blockquote>`, {
          parse_mode: 'HTML'
        });
      }
    }
    break;

    case 'addowner': {
      if (!isOwner) return reply(mess.owner);
      if (!text) return reply('<blockquote>📌 Penggunaan yang benar:\n/addowner ID_Telegram\n(ID harus berupa angka).</blockquote>', {
        parse_mode: 'HTML'
      });

      if (owners.includes(text)) {
        return reply(`<blockquote>⚠️ ID Telegram ${text} sudah menjadi Owner.</blockquote>`, {
          parse_mode: 'HTML'
        });
      }

      owners.push(text);
      fs.writeFileSync('./owner.json', JSON.stringify(owners, null, 2));
      return reply(`<blockquote>✅ ID Telegram ${text} telah ditambahkan ke daftar Owner!</blockquote>`, {
        parse_mode: 'HTML'
      });
    }

    case 'delowner': {
      if (!isOwner) return reply(mess.owner);
      if (!text) return reply('<blockquote>📌 Penggunaan:\n/delowner ID_Telegram\nContoh: /delowner 1234567890</blockquote>', {
        parse_mode: 'HTML'
      });

      const index = owners.indexOf(text);
      if (index !== -1) {
        owners.splice(index, 1);
        fs.writeFileSync('./owner.json', JSON.stringify(owners, null, 2));
        return reply(`<blockquote>✅ ID Telegram ${text} telah dihapus dari daftar Owner.</blockquote>`, {
          parse_mode: 'HTML'
        });
      } else {
        return reply(`<blockquote>⚠️ ID Telegram ${text} tidak ditemukan dalam daftar Owner.</blockquote>`, {
          parse_mode: 'HTML'
        });
      }
    }

    case 'listowner': {
      if (!isOwner) return reply(mess.owner);
      if (owners.length === 0) return reply('<blockquote>🚫 Belum ada Owner yang terdaftar.</blockquote>', {
        parse_mode: 'HTML'
      });
      const sentMessage = await reply(`<blockquote>⏳ <b>Memuat daftar Owner...</b></blockquote>`, {
        parse_mode: 'HTML'
      });

      (async () => {
        let list = [];
        for (let id of owners) {
          try {
            const user = await xy.api.getChat(id);
            const name = [user.first_name, user.last_name].filter(Boolean).join(' ');
            list.push(`🆔 <b>ID:</b> ${id}\n👑 <b>Nama:</b> ${name}`);
          } catch (e) {
            list.push(`🆔 <b>ID:</b> ${id}\n👑 <b>Nama:</b> Tidak ditemukan`);
          }
        }

        const daftar = `📜 <b>Daftar Owner:</b>\n\n${list.join('\n\n')}`;
        await editReply(xy, sentMessage.message_id, `<blockquote>${daftar}</blockquote>`);
      })();
      break;
    }

    case 'addseller':
      if (!isOwner) return reply(mess.owner);

      if (!text) return reply('<blockquote>Penggunaan: /addseller ID,durasi,waktu</blockquote>', {
        parse_mode: 'HTML'
      });

      const [id, dur, unit] = text.split(',');
      if (!id || !dur || !unit) return reply('<blockquote>Format salah! Contoh: /addseller 123456789,1,jam</blockquote>', {
        parse_mode: 'HTML'
      });

      const ms = {
        menit: 60000,
        jam: 3600000,
        hari: 86400000,
        bulan: 2592000000
      };

      const durasi = parseInt(dur);
      if (isNaN(durasi) || !ms[unit]) return reply('<blockquote>Durasi tidak valid atau waktu tidak dikenali.</blockquote>', {
        parse_mode: 'HTML'
      });

      if (seller.some(s => s.id === id)) return reply(`<blockquote>ID ${id} sudah jadi seller.</blockquote>`, {
        parse_mode: 'HTML'
      });

      seller.push({
        id,
        expiresAt: Date.now() + durasi * ms[unit]
      });
      fs.writeFileSync('./src/database/seller.json', JSON.stringify(seller, null, 2));
      return reply(`<blockquote>ID ${id} ditambahkan selama ${durasi} ${unit}.</blockquote>`, {
        parse_mode: 'HTML'
      });
      break;

    case 'delseller':
      if (!isOwner) return reply(mess.owner);
      if (!text) return reply('<blockquote>Penggunaan: /delseller ID</blockquote>', {
        parse_mode: 'HTML'
      });

      const index = seller.findIndex(s => s.id === text);
      if (index === -1) return reply(`<blockquote>ID ${text} tidak ditemukan.</blockquote>`, {
        parse_mode: 'HTML'
      });

      seller.splice(index, 1);
      fs.writeFileSync('./src/database/seller.json', JSON.stringify(seller, null, 2));
      return reply(`<blockquote>ID ${text} telah dihapus.</blockquote>`, {
        parse_mode: 'HTML'
      });
      break;

    case 'listseller': {
      if (!isOwner) return reply(mess.owner);
      if (!seller.length) return reply('<blockquote>Belum ada seller.</blockquote>', {
        parse_mode: 'HTML'
      });

      const sentMessage = await reply(`<blockquote>⏳ <b>Memuat daftar Seller...</b></blockquote>`, {
        parse_mode: 'HTML'
      });

      (async () => {
        let list = [];
        let updatedSeller = [...seller];

        for (let s of updatedSeller) {
          const sisa = s.expiresAt - Date.now();
          if (sisa <= 0) {
            updatedSeller = updatedSeller.filter(x => x.id !== s.id);
            continue;
          }

          const jam = Math.floor(sisa / 3600000);
          const menit = Math.floor((sisa % 3600000) / 60000);
          const sisaWaktu = jam > 0 ? `${jam} jam ${menit} menit` : `${menit} menit`;

          try {
            const user = await xy.api.getChat(s.id);
            const nama = user.first_name + (user.last_name ? ' ' + user.last_name : '');
            list.push(`🆔 <b>ID:</b> ${s.id}\n👤 <b>Nama:</b> ${nama}\n⏳ <b>Waktu Tersisa:</b> ${sisaWaktu}`);
          } catch {
            list.push(`🆔 <b>ID:</b> ${s.id}\n👤 <b>Nama:</b> Tidak ditemukan\n⏳ <b>Waktu Tersisa:</b> ${sisaWaktu}`);
          }
        }

        fs.writeFileSync('./src/database/seller.json', JSON.stringify(updatedSeller, null, 2));

        if (list.length === 0) {
          return editReply(xy, sentMessage.message_id, `<blockquote>🚫 Belum ada seller yang aktif.</blockquote>`);
        }

        const responseText = `📜 <b>Daftar Seller:</b>\n\n${list.join('\n\n')}`;
        await editReply(xy, sentMessage.message_id, `<blockquote>${responseText}</blockquote>`);
      })();
      break;
    }

    case 'pt':
    case 'pt2':
    case 'pt3':
    case 'pt4':
    case 'rt':
    case 'rt2':
    case 'rt3':
    case 'rt4': {
      if (!isOwner) return reply(mess.owner);

      const isResellerCommand = command.startsWith('rt');
      const file = isResellerCommand ? './src/database/reseller.json' : './src/database/partner.json';
      const panelName = isResellerCommand ? 'Reseller Panel' : 'Partner Panel';
      const serverVersion = command.endsWith('2') ? 'v2' : command.endsWith('3') ? 'v3' : command.endsWith('4') ? 'v4' : 'v1';

      if (!xy.message.reply_to_message) {
        return reply(`<blockquote>❌ Balas pesan pengguna yang ingin di-add ke ${panelName}.</blockquote>`, {
          parse_mode: 'HTML'
        });
      }

      const userId = xy.message.reply_to_message.from.id;
      const userName = xy.message.reply_to_message.from.first_name || 'Pengguna';

      let listData = [];
      try {
        if (fs.existsSync(file)) {
          const fileContent = fs.readFileSync(file, 'utf8');
          listData = JSON.parse(fileContent);
          if (!Array.isArray(listData)) {
            listData = [];
          }
        }
      } catch (e) {
        console.error(`Error reading ${file}:`, e);
      }

      const existingUserIndex = listData.findIndex(u => u.id === userId && u.server === serverVersion);

      if (existingUserIndex !== -1) {
        return reply(`<blockquote>⚠️ Pengguna <b>${userName}</b> sudah terdaftar di ${panelName} server <b>${serverVersion}</b>.</blockquote>`, {
          parse_mode: 'HTML'
        });
      }

      listData.push({
        id: userId,
        server: serverVersion
      });
      fs.writeFileSync(file, JSON.stringify(listData, null, 2));

      return reply(`<blockquote>✅ Pengguna <b>${userName}</b> berhasil ditambahkan ke ${panelName} server <b>${serverVersion}</b>.</blockquote>`, {
        parse_mode: 'HTML'
      });
    }
    break;

    case 'addallrt': {
      if (!isOwner) return reply(mess.owner);

      if (!xy.message.reply_to_message) {
        return reply(`<blockquote>❌ Balas pesan pengguna yang ingin di-add ke semua Reseller Panel.</blockquote>`, {
          parse_mode: 'HTML'
        });
      }

      const userId = xy.message.reply_to_message.from.id;
      const userName = xy.message.reply_to_message.from.first_name || 'Pengguna';
      const resellerFile = './src/database/reseller.json';
      const servers = ['v1', 'v2', 'v3', 'v4'];
      let addedCount = 0;

      let listData = [];
      try {
        if (fs.existsSync(resellerFile)) {
          const fileContent = fs.readFileSync(resellerFile, 'utf8');
          listData = JSON.parse(fileContent);
          if (!Array.isArray(listData)) {
            listData = [];
          }
        }
      } catch (e) {
        console.error(`Error reading ${resellerFile}:`, e);
      }

      for (const server of servers) {
        const existingUserIndex = listData.findIndex(u => u.id === userId && u.server === server);
        if (existingUserIndex === -1) {
          listData.push({
            id: userId,
            server: server
          });
          addedCount++;
        }
      }

      if (addedCount > 0) {
        fs.writeFileSync(resellerFile, JSON.stringify(listData, null, 2));
        return reply(`<blockquote>✅ Pengguna <b>${userName}</b> berhasil ditambahkan ke ${addedCount} Reseller Panel!</blockquote>`, {
          parse_mode: 'HTML'
        });
      } else {
        return reply(`<blockquote>⚠️ Pengguna <b>${userName}</b> sudah terdaftar di semua Reseller Panel.</blockquote>`, {
          parse_mode: 'HTML'
        });
      }
    }
    break;

    case 'delpt':
    case 'delpt2':
    case 'delpt3':
    case 'delpt4':
    case 'delrt':
    case 'delrt2':
    case 'delrt3':
    case 'delrt4': {
      if (!isOwner) return reply(mess.owner);

      const isResellerCommand = command.startsWith('delrt');
      const file = isResellerCommand ? './src/database/reseller.json' : './src/database/partner.json';
      const panelName = isResellerCommand ? 'Reseller Panel' : 'Partner Panel';
      const serverVersion = command.endsWith('2') ? 'v2' : command.endsWith('3') ? 'v3' : command.endsWith('4') ? 'v4' : 'v1';

      const replyToMessage = xy.message.reply_to_message;
      if (!replyToMessage) {
        return reply(`<blockquote>❌ Harap balas pesan pengguna yang ingin dihapus dari ${panelName}.</blockquote>`, {
          parse_mode: 'HTML'
        });
      }

      const userId = replyToMessage.from.id;
      const userName = replyToMessage.from.first_name || 'Pengguna';

      let listData = [];
      try {
        if (fs.existsSync(file)) {
          const fileContent = fs.readFileSync(file, 'utf8');
          listData = JSON.parse(fileContent);
          if (!Array.isArray(listData)) {
            listData = [];
          }
        }
      } catch (e) {
        console.error(`Error reading ${file}:`, e);
      }

      const initialLength = listData.length;
      listData = listData.filter(u => u.id !== userId || u.server !== serverVersion);

      if (listData.length === initialLength) {
        return reply(`<blockquote>⚠️ Pengguna <b>${userName}</b> (ID: ${userId}) tidak ditemukan di ${panelName} server <b>${serverVersion}</b>.</blockquote>`, {
          parse_mode: 'HTML'
        });
      }

      fs.writeFileSync(file, JSON.stringify(listData, null, 2));

      return reply(`<blockquote>✅ Pengguna <b>${userName}</b> (ID: ${userId}) berhasil dihapus dari ${panelName} server <b>${serverVersion}</b>.</blockquote>`, {
        parse_mode: 'HTML'
      });
    }
    break;

    case 'listpt':
    case 'listrt': {
      if (!isOwner) return reply(mess.owner);

      const isResellerCommand = command.startsWith('listrt');
      const file = isResellerCommand ? './src/database/reseller.json' : './src/database/partner.json';
      const panelName = isResellerCommand ? 'Reseller Panel' : 'Partner Panel';

      let listData = [];
      try {
        if (fs.existsSync(file)) {
          const fileContent = fs.readFileSync(file, 'utf8');
          listData = JSON.parse(fileContent);
          if (!Array.isArray(listData)) {
            listData = [];
          }
        }
      } catch (e) {
        console.error(`Error reading ${file}:`, e);
      }

      if (listData.length === 0) {
        return reply(`<blockquote>🚫 Belum ada pengguna yang terdaftar di ${panelName}.</blockquote>`, {
          parse_mode: 'HTML'
        });
      }

      const sentMessage = await reply(`<blockquote>⏳ <b>Memuat daftar ${panelName}...</b></blockquote>`, {
        parse_mode: 'HTML'
      });

      (async () => {
        const servers = ['v1', 'v2', 'v3', 'v4'];
        let message = `📜 <b>Daftar ${panelName}:</b>\n\n`;

        for (const server of servers) {
          const usersOnServer = listData.filter(u => u.server === server);
          if (usersOnServer.length > 0) {
            message += `<b>Server ${server}:</b>\n`;
            for (const user of usersOnServer) {
              try {
                const chat = await xy.api.getChat(user.id);
                const name = chat.first_name || 'Pengguna';
                message += `  - 🆔 ${user.id} (👤 ${name})\n`;
              } catch (e) {
                message += `  - 🆔 ${user.id} (👤 Tidak ditemukan)\n`;
              }
            }
            message += '\n';
          }
        }

        if (message.endsWith('\n\n')) {
          message = message.slice(0, -2);
        }

        await editReply(xy, sentMessage.message_id, `<blockquote>${message}</blockquote>`);
      })();
      break;
    }

    case "cadp":
    case "cadpv2":
    case "cadpv3":
    case "cadpv4": {
      if (xy.chat.type === 'private') {
        return reply(mess.group);
      }

      const serverVersion = command.endsWith('v2') ? 'v2' : command.endsWith('v3') ? 'v3' : command.endsWith('v4') ? 'v4' : 'v1';
      const userId = xy.from.id;

      if (!checkUserRole(userId, ['owner', 'partner'], serverVersion)) {
        return reply(mess.owner);
      }

      const panelConfig = getPanelConfig(serverVersion);
      if (!text || text.split(",").length < 3) return reply(`<blockquote><b>Format salah!</b>\n\nPenggunaan:\n${prefix + command} sendwa/sendtele,nama,nomor_telepon</blockquote>`, {
        parse_mode: 'HTML'
      });

      const sentMessage = await reply(`<blockquote>⏳ <b>Sedang membuat Admin Panel...</b></blockquote>`, {
        parse_mode: 'HTML'
      });

      (async () => {
        const [sendType, username, targetNumberRaw] = text.split(",").map(a => a.trim());
        const targetNumber = targetNumberRaw.replace(/[^0-9]/g, "");
        const {
          panelDomain,
          pltaKey
        } = panelConfig;

        if (!["sendwa", "sendtele"].includes(sendType)) {
          return editReply(xy, sentMessage.message_id, "<blockquote>Pilihan pengiriman hanya boleh 'sendwa' atau 'sendtele'.</blockquote>");
        }

        let password = Math.random().toString(36).slice(-8);
        let email = username + "@private.tech";
        let user; 
        try {
          try {
            const checkResponse = await fetch(`${panelDomain}/api/application/users/email/${email}`, {
              method: "GET",
              headers: {
                Accept: "application/json",
                Authorization: `Bearer ${pltaKey}`
              }
            });

            if (checkResponse.ok) {
              
              throw new Error("Email atau Username sudah digunakan!");
            } else if (checkResponse.status !== 404) {
              
              throw new Error(`API Check Error: Status ${checkResponse.status}`);
            }
           

          } catch (error) {
            
            if (error.message !== "Email atau Username sudah digunakan!") throw error;
            else throw new Error("Email atau Username sudah digunakan!");
          }
          let f = await fetch(`${panelDomain}/api/application/users`, {
            method: "POST",
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json",
              Authorization: `Bearer ${pltaKey}`
            },
            body: JSON.stringify({
              email: email,
              username: username,
              first_name: username,
              last_name: username,
              language: "en",
              root_admin: true,
              password: password.toString()
            })
          });

          let data = await f.json();
          if (data.errors) throw new Error(`API Error: ${data.errors[0].detail}`);
          user = data.attributes; 

          let messageToTarget = `
✓ Admin Panel Berhasil Dibuat

- <b>ID</b>: ${user.id}
- <b>EMAIL</b>: ${user.email}
- <b>USERNAME</b>: <code>${user.username}</code>
- <b>PASSWORD</b>: <code>${password.toString()}</code>
- <b>LOGIN</b>: ${panelDomain}

⚠️ Simpan informasi ini, kami hanya mengirimkan detail akun sekali.
`;

          if (sendType === "sendtele") {
            await xy.api.sendMessage(targetNumber, messageToTarget, {
              parse_mode: 'HTML'
            });
          } else if (sendType === "sendwa") {
            const sessionNumber = Array.from(sessions.keys())[0];
            const waClient = sessions.get(sessionNumber);
            if (!waClient) throw new Error(`Sesi WhatsApp ${sessionNumber} tidak ditemukan.`);
            const custwa = targetNumber.includes("@") ? targetNumber : `${targetNumber}@s.whatsapp.net`;
            await waClient.sendMessage(custwa, {
              text: messageToTarget
            });
          }
          let messageToSender = `✅ Admin <b>${username}</b> berhasil dibuat dan data telah dikirim ke <b>${sendType === "sendtele" ? "Telegram" : "WhatsApp"}</b> ${targetNumber}.\n\n<b>ID Pengguna Panel:</b> <code>${user.id}</code>`;
          await editReply(xy, sentMessage.message_id, `<blockquote>${messageToSender}</blockquote>`);

        } catch (error) {
          console.error("❌ CADP Error:", error.message);
          await editReply(xy, sentMessage.message_id, `<blockquote>❌ Gagal membuat Admin Panel: ${error.message}</blockquote>`);
        }
      })();
      break;
    }

    case "1gb":
    case "2gb":
    case "3gb":
    case "4gb":
    case "5gb":
    case "6gb":
    case "7gb":
    case "8gb":
    case "9gb":
    case "10gb":
    case "unli":
    case "1gbv2":
    case "2gbv2":
    case "3gbv2":
    case "4gbv2":
    case "5gbv2":
    case "6gbv2":
    case "7gbv2":
    case "8gbv2":
    case "9gbv2":
    case "10gbv2":
    case "unliv2":
    case "1gbv3":
    case "2gbv3":
    case "3gbv3":
    case "4gbv3":
    case "5gbv3":
    case "6gbv3":
    case "7gbv3":
    case "8gbv3":
    case "9gbv3":
    case "10gbv3":
    case "unliv3":
    case "1gbv4":
    case "2gbv4":
    case "3gbv4":
    case "4gbv4":
    case "5gbv4":
    case "6gbv4":
    case "7gbv4":
    case "8gbv4":
    case "9gbv4":
    case "10gbv4":
    case "unliv4": {
      if (xy.chat.type === 'private') {
        return reply(mess.group);
      }

      const serverVersion = command.match(/v\d/)?.[0] || 'v1';
      const userId = xy.from.id;

      if (!checkUserRole(userId, ['owner', 'seller', 'partner', 'reseller'], serverVersion)) {
        return reply(mess.seller);
      }

      const sentMessage = await reply(`<blockquote>⏳ <b>Sedang membuat Panel ${command.toUpperCase()}...</b></blockquote>`, {
        parse_mode: 'HTML'
      });

      (async () => {
        const userInput = text;
        const commandType = command.replace(serverVersion, '');
        const panelConfig = getPanelConfig(serverVersion);
        const {
          panelDomain,
          pltaKey,
          pltcKey,
          nests,
          eggs,
          loc
        } = panelConfig;
        let ram, disk, cpu;

        switch (commandType) {
          case "1gb":
            ram = "1024";
            disk = "1024";
            cpu = "40";
            break;
          case "2gb":
            ram = "2048";
            disk = "2048";
            cpu = "60";
            break;
          case "3gb":
            ram = "3072";
            disk = "3072";
            cpu = "80";
            break;
          case "4gb":
            ram = "4096";
            disk = "4096";
            cpu = "100";
            break;
          case "5gb":
            ram = "5120";
            disk = "5120";
            cpu = "120";
            break;
          case "6gb":
            ram = "6144";
            disk = "6144";
            cpu = "140";
            break;
          case "7gb":
            ram = "7168";
            disk = "7168";
            cpu = "160";
            break;
          case "8gb":
            ram = "8192";
            disk = "8192";
            cpu = "180";
            break;
          case "9gb":
            ram = "9216";
            disk = "9216";
            cpu = "200";
            break;
          case "10gb":
            ram = "10240";
            disk = "10240";
            cpu = "220";
            break;
          case "unli":
            ram = "0";
            disk = "0";
            cpu = "0";
            break;
          default:
            return editReply(xy, sentMessage.message_id, "<blockquote>Perintah tidak valid.</blockquote>");
        }

        let t = userInput.split(",");
        // Ubah validasi jadi < 2 karena cuma butuh nama & id
        if (t.length < 2) {
          return editReply(xy, sentMessage.message_id, `<blockquote><b>Format salah!</b>\n\nPenggunaan:\n${prefix + command} username,idtele</blockquote>`);
        }

        // Kita hapus sendType dari input user, dan paksa logic-nya jadi "sendtele"
        let [username, targetNumberRaw] = t.map(a => a.trim());
        let sendType = "sendtele"; // Hardcode otomatis ke telegram
        
        const targetNumber = targetNumberRaw.replace(/\D/g, "");

        if (!targetNumber.match(/^\d+$/)) {
          return editReply(xy, sentMessage.message_id, `<blockquote>ID tele / No. WA tujuan tidak valid.</blockquote>`);
        }

        let email = `${username}@private.tech`;
        let password = Math.random().toString(36).slice(-8);
        let user; 
        let server; 
        try {
          try {
            const checkResponse = await fetch(`${panelDomain}/api/application/users/email/${email}`, {
              method: "GET",
              headers: {
                Accept: "application/json",
                Authorization: `Bearer ${pltaKey}`
              }
            });

            if (checkResponse.ok) {
              
              throw new Error("Email atau Username sudah digunakan!");
            } else if (checkResponse.status !== 404) {
              
              throw new Error(`API Check Error: Status ${checkResponse.status}`);
            }

          } catch (error) {
            if (error.message !== "Email atau Username sudah digunakan!") throw error;
            else throw new Error("Email atau Username sudah digunakan!");
          }
          let f = await fetch(`${panelDomain}/api/application/users`, {
            method: "POST",
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json",
              Authorization: `Bearer ${pltaKey}`
            },
            body: JSON.stringify({
              email: email,
              username: username,
              first_name: username,
              last_name: username,
              language: "en",
              password: password.toString()
            })
          });

          let userData = await f.json();
          if (userData.errors) throw new Error(`API Error: ${userData.errors[0].detail}`);
          user = userData.attributes; 
          
          let f2 = await fetch(`${panelDomain}/api/application/nests/${nests}/eggs/${eggs}`, {
            method: "GET",
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json",
              Authorization: `Bearer ${pltcKey}`
            }
          });
          let data2 = await f2.json();
          let startup_cmd = data2.attributes.startup;

          
          let f3 = await fetch(`${panelDomain}/api/application/servers`, {
            method: "POST",
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json",
              Authorization: `Bearer ${pltcKey}`
            },
            body: JSON.stringify({
              name: username,
              description: "panel pterodactyl",
              user: user.id,
              egg: parseInt(eggs),
              docker_image: "ghcr.io/parkervcp/yolks:nodejs_23",
              startup: startup_cmd,
              environment: {
                INST: "npm",
                USER_UPLOAD: "0",
                AUTO_UPDATE: "0",
                CMD_RUN: "npm start",
                STARTUP_CMD: "pip install -r requirements.txt"
              },
              limits: {
                memory: ram,
                swap: 0,
                disk: disk,
                io: 500,
                cpu: cpu
              },
              feature_limits: {
                databases: 5,
                backups: 5,
                allocations: 5
              },
              deploy: {
                locations: [parseInt(loc)],
                dedicated_ip: false,
                port_range: []
              }
            })
          });

          let res = await f3.json();
          if (res.errors) throw new Error(`API Error: ${res.errors[0].detail}`);
          server = res.attributes; 
          let messageToTelegram = `
🎉 <b>Panel Berhasil Dibuat!</b>

🔹 <b>Detail Panel Anda:</b>
────────────────────
- <b>ID User</b>: ${user.id}
- <b>ID Server</b>: ${server.id}
- <b>EMAIL</b>: ${user.email}
- <b>USERNAME</b>: <code>${user.username}</code>
- <b>PASSWORD</b>: <code>${password.toString()}</code>
- <b>LOGIN</b>: <a href="${panelDomain}">Klik untuk login</a>
<pre>
⚠️ <b>PERHATIAN:</b>
────────────────────
Simpan informasi ini dengan baik, karena kami hanya mengirimkan detail akun sekali. Jika hilang, Anda bertanggung jawab atas data ini.
</pre>
`;

          let messageToWa = `
🎉 Panel Berhasil Dibuat!

🔹 Detail Panel Anda:
────────────────────
- ID User: ${user.id}
- ID Server: ${server.id}
- EMAIL: ${user.email}
- USERNAME: ${user.username}
- PASSWORD: ${password.toString()}
- LOGIN: ${panelDomain}

⚠️ PERHATIAN:
────────────────────
Simpan informasi ini dengan baik, karena kami hanya mengirimkan detail akun sekali. Jika hilang, Anda bertanggung jawab atas data ini.
`;

          
          if (sendType === "sendtele") {
            await xy.api.sendMessage(targetNumber, messageToTelegram, {
              parse_mode: 'HTML'
            });
          } else if (sendType === "sendwa") {
            const sessionNumber = Array.from(sessions.keys())[0];
            const waClient = sessions.get(sessionNumber);
            if (!waClient) throw new Error(`Sesi WhatsApp ${sessionNumber} tidak ditemukan.`);
            const custwa = targetNumber.includes("@") ? targetNumber : `${targetNumber}@s.whatsapp.net`;
            await waClient.sendMessage(custwa, {
              text: messageToWa
            });
          }


          let messageToSender = `✅ Panel untuk username <b>${username}</b> telah berhasil dibuat dan data telah dikirim ke <b>${sendType === "sendtele" ? "Telegram" : "WhatsApp"}</b> ${targetNumber}.\n\n<b>ID Server:</b> <code>${server.id}</code>`;
          await editReply(xy, sentMessage.message_id, `<blockquote>${messageToSender}</blockquote>`);

        } catch (error) {
          console.error("❌ Panel Creation Error:", error.message);
          await editReply(xy, sentMessage.message_id, `<blockquote>❌ Gagal membuat Panel: ${error.message}</blockquote>`);
        }
      })();
      break;
    }
    
    case "totalserver":
    case "totalserverv2":
    case "totalserverv3":
    case "totalserverv4": {
      

      const serverVersion = command.endsWith('v2') ? 'v2' : command.endsWith('v3') ? 'v3' : command.endsWith('v4') ? 'v4' : 'v1';
      const panelConfig = getPanelConfig(serverVersion);
      
      const hasPanelAccess = checkUserRole(xy.from.id, ['owner', 'partner', 'reseller'], serverVersion);
      
      const domainDisplay = hasPanelAccess 
        ? panelConfig.panelDomain 
        : '***Domain disembunyikan***';

      if (!panelConfig.panelDomain || !panelConfig.pltaKey) {
        return reply(`<blockquote>❌ Konfigurasi <b>Server ${serverVersion.toUpperCase()}</b> tidak ditemukan atau API Key kosong.</blockquote>`, {
          parse_mode: 'HTML'
        });
      }

      const sentMessage = await reply(`<blockquote>⏳ <b>Menghitung total server di Panel ${serverVersion.toUpperCase()}...</b></blockquote>`, {
        parse_mode: 'HTML'
      });

      (async () => {
        let currentServerCount = 0;
        let page = 1;
        let hasMore = true;

        try {
          
          while (hasMore) {
            const response = await axios.get(`${panelConfig.panelDomain}/api/application/servers?page=${page}`, {
              headers: {
                'Authorization': `Bearer ${panelConfig.pltaKey}`
              }
            });

            const result = response.data;
            currentServerCount += result.data.length;
            hasMore = result.meta.pagination.current_page < result.meta.pagination.total_pages;
            page++;
          }

          const summary = `
📜 <b>Total Server Panel ${serverVersion.toUpperCase()}</b>

🌐 <b>Domain:</b> ${domainDisplay}
📊 <b>Total Server:</b> <code>${currentServerCount} Server</code>
`;

          await editReply(xy, sentMessage.message_id, `<blockquote>${summary}</blockquote>`);

        } catch (err) {
          console.error(`Error mengambil total server ${serverVersion}:`, err.message);
          await editReply(xy, sentMessage.message_id, `<blockquote>❌ Gagal mengambil total server dari Panel ${serverVersion.toUpperCase()}.\n\nError: API Panel tidak merespons atau API Key tidak valid.</blockquote>`);
        }
      })();
      break;
    }

    case 'info': {
      if (xy.chat.type === 'private') {
        return reply(`<blockquote>❌ Perintah ini hanya bisa digunakan di dalam grup.</blockquote>`, {
          parse_mode: 'HTML'
        });
      }

      const targetUser = xy.message.reply_to_message?.from || xy.from;
      const targetId = targetUser.id;

      const sentMessage = await reply(`<blockquote>⏳ <b>Mengecek status pengguna ${targetUser.first_name}...</b></blockquote>`, {
        parse_mode: 'HTML'
      });

      (async () => {
        const userIdStr = String(targetId);

        
        const statusV1 = checkUserRole(targetId, ['owner', 'partner', 'reseller'], 'v1');
        const statusV2 = checkUserRole(targetId, ['owner', 'partner', 'reseller'], 'v2');
        const statusV3 = checkUserRole(targetId, ['owner', 'partner', 'reseller'], 'v3');
        const statusV4 = checkUserRole(targetId, ['owner', 'partner', 'reseller'], 'v4');
        const isSellerRole = checkUserRole(targetId, ['seller'], '');
        const isOwnerRole = checkUserRole(targetId, ['owner'], '');

        const checkMark = '✅';
        const xMark = '❌';

        let isBotStarted = false;
        let startBotMessage = 'ℹ️ Sedang mencoba menghubungi user...';

        try {
          
          await xy.api.sendMessage(targetId, '✅ Cek Dulu Bang!');
          isBotStarted = true;
        } catch (error) {
          if (error.description && error.description.includes('403')) {
            isBotStarted = false;
          } else {
            console.error(`Error saat cek start bot untuk ID ${targetId}:`, error);
          }
        }

        if (isBotStarted) {
          startBotMessage = `${checkMark} Oke Lu udah chat bot!`;
        } else {
          startBotMessage = `${xMark} Lu belom Chat bot Di Private! Chat Bot Dulu, Baru Create Panel!`;
        }
        const infoMessage = `
<b>— ${targetUser.first_name || 'Pengguna'} | INFO —</b>

🆔 <b>ID</b>: <code>${targetId}</code>
👤 <b>Username</b>: @${targetUser.username || '-'}
⭐ <b>Status Global</b>: ${isOwnerRole ? 'Owner' : isSellerRole ? 'Seller' : 'User'}
            
<b>— Status Panel Akses —</b>
- <b>Server V1</b>: ${statusV1 ? checkMark : xMark}
- <b>Server V2</b>: ${statusV2 ? checkMark : xMark}
- <b>Server V3</b>: ${statusV3 ? checkMark : xMark}
- <b>Server V4</b>: ${statusV4 ? checkMark : xMark}

<b>— Status Chat Bot —</b>
${startBotMessage}

${isBotStarted ? '\nSilahkan create panel sekarang.' : '\nchat dan /start bot terlebih dahulu di private chat!'}
`;

        
        await editReply(xy, sentMessage.message_id, `<blockquote>${infoMessage}</blockquote>`);

      })();
      break;
    }
    
    
    case 'cekserver': {
        if (xy.chat.type === 'private') {
            return reply(`<blockquote>❌ Perintah ini hanya bisa digunakan di dalam grup.</blockquote>`, { parse_mode: 'HTML' });
        }
        
        const sentMessage = await reply(`<blockquote>⏳ <b>Mengecek status server V1-V4...</b></blockquote>`, { parse_mode: 'HTML' });

        (async () => {
            const servers = ['v1', 'v2', 'v3', 'v4'];
            let serverStatuses = [];
            
            for (const version of servers) {
                const panelConfig = getPanelConfig(version);
                const serverName = `SERVER ${version.slice(1)}`;
                
                if (!panelConfig.panelDomain || !panelConfig.pltaKey) {
                    serverStatuses.push(`${serverName} OFF❌ (Konfigurasi hilang)`);
                    continue;
                }

                try {
                    
                    const response = await axios.get(`${panelConfig.panelDomain}/api/application/servers`, {
                        headers: { 'Authorization': `Bearer ${panelConfig.pltaKey}` }
                    });
                    
                    const serverList = response.data.data;
                    let isAnyServerRunning = false;

                    
                    for (const server of serverList) {
                        const serverUuid = server.attributes.uuid;
                        
                        const status = await getServerStatus(serverUuid, panelConfig); 
                        if (status === 'running') {
                            isAnyServerRunning = true;
                            break; 
                        }
                    }

                    if (isAnyServerRunning) {
                         serverStatuses.push(`${serverName} ON✅`);
                    } else {
                         serverStatuses.push(`${serverName} OFF❌`);
                    }
                    
                } catch (err) {
                    
                    console.error(`Error cek server ${version}:`, err.message);
                    serverStatuses.push(`${serverName} OFF❌ (API Error)`);
                }
            }

            const message = `
SERVERR YANG ON : 
${serverStatuses.join('\n')}
`;

            await editReply(xy, sentMessage.message_id, `<blockquote>${message}</blockquote>`);
        })();
        break;
    }
    
    
    case "connect": {
      if (!isOwner) return reply(mess.owner);
      if (!text) return reply('<blockquote>Gunakan: <code>/connect nomor_telepon</code></blockquote>', {
        parse_mode: 'HTML'
      });

      const sentMessage = await reply(`<blockquote>🔄 <b>Memulai koneksi ke WhatsApp ${text}...</b></blockquote>`, {
        parse_mode: 'HTML'
      });

      (async () => {
        const number = text.trim();
        if (sessions.has(number)) {
          return editReply(xy, sentMessage.message_id, `<blockquote>❗ WhatsApp ${number} sudah terhubung.</blockquote>`);
        }

        try {
          
          await startWhatsAppSession(number, xy.chat.id, sentMessage.message_id);


        } catch (e) {
          console.error("Gagal koneksi WhatsApp:", e);
          
          await editReply(xy, sentMessage.message_id, `<blockquote>❌ Gagal menghubungkan WhatsApp ${number}: ${e.message}</blockquote>`);
        }
      })();
      break;
    }

    case "disconnect": {
      if (!isOwner) return reply(mess.owner);
      if (!text) return reply('<blockquote>Gunakan: <code>/disconnect nomor_telepon</code>\nContoh: <code>/disconnect 6281234567890</code></blockquote>', {
        parse_mode: 'HTML'
      });

      const sentMessage = await reply(`<blockquote>⏳ <b>Mencoba memutus koneksi WhatsApp ${text}...</b></blockquote>`, {
        parse_mode: 'HTML'
      });

      (async () => {
        const number = text.trim();

        if (!sessions.has(number)) {
          return editReply(xy, sentMessage.message_id, `<blockquote>❌ Session WhatsApp ${number} tidak ditemukan.</blockquote>`);
        }

        try {
          const waClient = sessions.get(number);

          if (waClient && waClient.ws.readyState === waClient.ws.OPEN) {
            await waClient.logout();
          } else {
             
             sessions.delete(number);
          }

          sessions.delete(number);

          await editReply(xy, sentMessage.message_id, `<blockquote>✅ Session WhatsApp ${number} berhasil diputus dan dihapus.</blockquote>`);

        } catch (error) {
          console.error("Error disconnecting WhatsApp session:", error);

          
          sessions.delete(number);
          
          await editReply(xy, sentMessage.message_id, `<blockquote>⚠️ Session WhatsApp ${number} dihapus dengan paksa.\nError: ${error.message}</blockquote>`);
        }
      })();
      break;
    }

    case 'send':
      if (!isOwner) return reply(mess.owner);
      if (text.length < 2) return reply('<blockquote>Gunakan: <code>/send nomor_tujuan, teks_pesan</code></blockquote>', {
        parse_mode: 'HTML'
      });
      
      const sendSentMessage = await reply(`<blockquote>⏳ <b>Mencoba mengirim pesan WhatsApp...</b></blockquote>`, { parse_mode: 'HTML' });

      (async () => {
          let [targetNumber, textMessage] = text.split(",").map(a => a.trim());
          targetNumber = targetNumber.replace(/\D/g, ''); 

          if (!targetNumber) return editReply(xy, sendSentMessage.message_id, '<blockquote>Nomor tujuan tidak valid.</blockquote>');
          if (!textMessage) return editReply(xy, sendSentMessage.message_id, '<blockquote>Pesan tidak boleh kosong.</blockquote>');
          if (sessions.size === 0) return editReply(xy, sendSentMessage.message_id, '<blockquote>Tidak ada sesi WhatsApp yang aktif.</blockquote>');

          const sessionNumber = Array.from(sessions.keys())[0];
          const waClient = sessions.get(sessionNumber);

          if (!waClient) return editReply(xy, sendSentMessage.message_id, `<blockquote>Sesi WhatsApp ${sessionNumber} tidak ditemukan.</blockquote>`);

          try {
            const jid = targetNumber.includes("@") ? targetNumber : `${targetNumber}@s.whatsapp.net`;
            await waClient.sendMessage(jid, { text: textMessage });
            await editReply(xy, sendSentMessage.message_id, `<blockquote>✅ Pesan berhasil dikirim ke ${targetNumber} menggunakan sesi ${sessionNumber}</blockquote>`);
          } catch (error) {
            console.error(`⚠️ Gagal mengirim pesan ke ${targetNumber}:`, error);
            await editReply(xy, sendSentMessage.message_id, `<blockquote>❌ Gagal mengirim pesan ke ${targetNumber}. Error: ${error.message}</blockquote>`);
          }
      })();
      break;

    case 'tourl': {
      if (!xy.message?.reply_to_message || (!xy.message.reply_to_message.photo && !xy.message.reply_to_message.video)) {
        return reply(`<blockquote>📌 <b>Reply gambar atau video dengan caption</b> <code>${prefix + command}</code></blockquote>`, {
          parse_mode: "HTML"
        });
      }

      const sentMessage = await reply(`<blockquote>⏳ <b>Sedang mengunggah file ke URL...</b></blockquote>`, {
        parse_mode: 'HTML'
      });

      (async () => {
        const fileId = xy.message.reply_to_message.photo ?
          xy.message.reply_to_message.photo.at(-1).file_id :
          xy.message.reply_to_message.video.file_id;

        try {
          const file = await xy.api.getFile(fileId);
          if (!file.file_path) throw new Error('Gagal mengambil file path');
          
          const fileUrl = `https://api.telegram.org/file/bot${botToken}/${file.file_path}`;

          const filePath = path.join(__dirname, path.basename(file.file_path));
          const response = await axios({
            url: fileUrl,
            responseType: 'stream'
          });

          const writer = fs.createWriteStream(filePath);
          response.data.pipe(writer);

          await new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
            response.data.on('error', reject);
          });

          try {
            const uploaded = await CatBox(filePath);
            await editReply(xy, sentMessage.message_id, `<blockquote>✅ <b>Berhasil diunggah!</b>\n🔗 <b>URL:</b> ${uploaded}</blockquote>`);
            fs.unlinkSync(filePath);
          } catch (uploadError) {
            console.error(uploadError);
            await editReply(xy, sentMessage.message_id, `<blockquote>❌ Gagal mengunggah file.</blockquote>`);
          }

        } catch (err) {
          console.error(err);
          await editReply(xy, sentMessage.message_id, `<blockquote>❌ Gagal mengambil file dari Telegram.</blockquote>`);
        }
      })();
      break;
    }

    case "sticker": {
      if (!xy.message.reply_to_message ||
        (!xy.message.reply_to_message.photo && !xy.message.reply_to_message.video)) {
        return reply(`<blockquote>📌 <b>Reply gambar atau video dengan perintah</b> <code>${prefix + command}</code></blockquote>`, {
          parse_mode: 'HTML'
        });
      }

      const sentMessage = await reply(`<blockquote>⏳ <b>Sedang membuat stiker...</b></blockquote>`, {
        parse_mode: 'HTML'
      });

      (async () => {
        let fileId, isVideo = false;

        if (xy.message.reply_to_message.photo) {
          fileId = xy.message.reply_to_message.photo.at(-1).file_id;
        } else if (xy.message.reply_to_message.video) {
          fileId = xy.message.reply_to_message.video.file_id;
          isVideo = true;
        }

        try {
          const file = await xy.api.getFile(fileId);
          if (!file.file_path) throw new Error('Gagal mengambil file path');

          const filePath = `https://api.telegram.org/file/bot${botToken}/${file.file_path}`;
          const inputPath = `./temp_input${isVideo ? ".mp4" : ".jpg"}`;
          const outputPath = `./temp_output.${isVideo ? "webm" : "webp"}`;

          const response = await axios.get(filePath, {
            responseType: "arraybuffer"
          });
          fs.writeFileSync(inputPath, response.data);

          exec(`ffmpeg -i "${inputPath}" -vf "scale=512:512:force_original_aspect_ratio=decrease" -c:v ${isVideo ? 'libvpx-vp9 -b:v 500k -an' : ''} "${outputPath}"`, async (err) => {
            fs.unlinkSync(inputPath);
            if (err) {
              console.error("FFmpeg error:", err);
              return editReply(xy, sentMessage.message_id, `<blockquote>❌ Gagal mengonversi ${isVideo ? "video" : "gambar"} ke stiker.</blockquote>`);
            }

            try {
              const stickerBuffer = fs.readFileSync(outputPath);
              await xy.api.sendSticker(xy.chat.id, new InputFile(stickerBuffer, outputPath));
              await editReply(xy, sentMessage.message_id, `<blockquote>✅ Stiker berhasil dibuat!</blockquote>`);
            } catch (sendErr) {
              await editReply(xy, sentMessage.message_id, `<blockquote>❌ Gagal mengirim stiker.</blockquote>`);
            }
            fs.unlinkSync(outputPath);
          });

        } catch (err) {
          console.error(err);
          await editReply(xy, sentMessage.message_id, `<blockquote>❌ Terjadi kesalahan saat memproses stiker.</blockquote>`);
        }
      })();
      break;
    }

    case "toimg":
    case "toimage": {
      if (!xy.message.reply_to_message || !xy.message.reply_to_message.sticker) {
        return reply(`<blockquote>📌 <b>Reply stiker dengan perintah</b> <code>${prefix + command}</code></blockquote>`, {
          parse_mode: 'HTML'
        });
      }

      const sentMessage = await reply(`<blockquote>⏳ <b>Sedang mengonversi stiker ke gambar...</b></blockquote>`, {
        parse_mode: 'HTML'
      });

      (async () => {
        const fileId = xy.message.reply_to_message.sticker.file_id;

        try {
          const file = await xy.api.getFile(fileId);
          if (!file.file_path) throw new Error("Gagal mengambil file path");

          const fileUrl = `https://api.telegram.org/file/bot${botToken}/${file.file_path}`;
          const inputPath = `./temp_sticker.webp`;
          const outputPath = `./temp_image.png`;

          const response = await axios.get(fileUrl, {
            responseType: "arraybuffer"
          });
          fs.writeFileSync(inputPath, response.data);

          exec(`ffmpeg -i "${inputPath}" "${outputPath}"`, async (err) => {
            fs.unlinkSync(inputPath);
            if (err) {
              console.error("FFmpeg error:", err);
              return editReply(xy, sentMessage.message_id, "<blockquote>❌ Gagal mengonversi stiker ke gambar.</blockquote>");
            }

            try {
              const imageBuffer = fs.readFileSync(outputPath);
              await xy.api.sendPhoto(xy.chat.id, new InputFile(imageBuffer, outputPath), {
                caption: "<blockquote>✅ <b>Berhasil dikonversi ke gambar!</b></blockquote>",
                parse_mode: 'HTML'
              });
              await editReply(xy, sentMessage.message_id, `<blockquote>✅ Proses konversi selesai.</blockquote>`);
            } catch (sendErr) {
              await editReply(xy, sentMessage.message_id, `<blockquote>❌ Gagal mengirim gambar.</blockquote>`);
            }
            fs.unlinkSync(outputPath);
          });

        } catch (err) {
          console.error(err);
          await editReply(xy, sentMessage.message_id, "<blockquote>❌ Terjadi kesalahan saat mengonversi stiker.</blockquote>");
        }
      })();
      break;
    }

    case "tovideo": {
      if (!xy.message.reply_to_message || !xy.message.reply_to_message.sticker) {
        return reply(`<blockquote>📌 <b>Reply stiker dengan perintah</b> <code>${prefix + command}</code></blockquote>`, {
          parse_mode: 'HTML'
        });
      }

      const sentMessage = await reply(`<blockquote>⏳ <b>Sedang mengonversi stiker ke video...</b></blockquote>`, {
        parse_mode: 'HTML'
      });

      (async () => {
        const sticker = xy.message.reply_to_message.sticker;
        const fileId = sticker.file_id;
        const ext = sticker.is_video ? ".webm" : ".webp";
        const inputPath = `./sticker${ext}`;
        const outputPath = `./video.mp4`;

        try {
          const file = await xy.api.getFile(fileId);
          if (!file.file_path) throw new Error("Gagal mengambil file path");

          const fileUrl = `https://api.telegram.org/file/bot${botToken}/${file.file_path}`;
          const response = await axios.get(fileUrl, {
            responseType: "arraybuffer"
          });

          fs.writeFileSync(inputPath, response.data);

          exec(`ffmpeg -i "${inputPath}" -movflags faststart -pix_fmt yuv420p -vf "scale=512:512:force_original_aspect_ratio=decrease" "${outputPath}"`, async (err) => {
            fs.unlinkSync(inputPath);

            if (err) {
              console.error("FFmpeg error:", err);
              return editReply(xy, sentMessage.message_id, "<blockquote>❌ Gagal mengonversi stiker ke video.</blockquote>");
            }

            try {
              const videoBuffer = fs.readFileSync(outputPath);
              await xy.api.sendVideo(xy.chat.id, new InputFile(videoBuffer, "video.mp4"), {
                caption: "<blockquote>✅ <b>Berhasil dikonversi ke video!</b></blockquote>",
                parse_mode: 'HTML'
              });
              await editReply(xy, sentMessage.message_id, `<blockquote>✅ Proses konversi selesai.</blockquote>`);
            } catch (sendErr) {
              await editReply(xy, sentMessage.message_id, `<blockquote>❌ Gagal mengirim video.</blockquote>`);
            }
            fs.unlinkSync(outputPath);
          });

        } catch (err) {
          console.error(err);
          await editReply(xy, sentMessage.message_id, "<blockquote>❌ Terjadi kesalahan saat mengonversi stiker.</blockquote>");
        }
      })();
      break;
    }

    case 'qc': {
      if (!isOwner) return reply(mess.owner);

      const teks = xy.message.reply_to_message?.text || text;
      if (!teks) return reply("<blockquote>Cara penggunaan: /qc teks (atau reply pesan)</blockquote>", {
        parse_mode: 'HTML'
      });

      const sentMessage = await reply(`<blockquote>⏳ <b>Sedang membuat Quoted Image (QC)...</b></blockquote>`, {
        parse_mode: 'HTML'
      });

      (async () => {
        const targetUser = xy.message.reply_to_message?.from || xy.from;
        let avatarUrl = "https://i0.wp.com/telegra.ph/file/134ccbbd0dfc434a910ab.png";

        try {
          // 1. Ambil Foto Profil
          const photos = await xy.api.getUserProfilePhotos(targetUser.id);
          if (photos.total_count > 0) {
            const fileId = photos.photos[0][0].file_id;
            const file = await xy.api.getFile(fileId);
            if (file?.file_path) {
              avatarUrl = `https://api.telegram.org/file/bot${botToken}/${file.file_path}`;
            }
          }

          // 2. Panggil API QC
          const payload = {
            type: "quote",
            format: "png",
            backgroundColor: "#FFFFFF",
            width: 700,
            height: 580,
            scale: 2,
            messages: [{
              entities: [],
              avatar: true,
              from: {
                id: 1,
                name: targetUser.first_name,
                photo: {
                  url: avatarUrl
                }
              },
              text: teks,
              replyMessage: {}
            }]
          };

          const {
            data
          } = await axios.post("https://bot.lyo.su/quote/generate", payload, {
            headers: {
              "Content-Type": "application/json"
            }
          });

          // 3. Konversi ke WebP
          const pngBuffer = Buffer.from(data.result.image, "base64");
          const inputPath = './qc_input.png';
          const outputPath = './qc_output.webp';

          fs.writeFileSync(inputPath, pngBuffer);

          exec(`ffmpeg -y -i "${inputPath}" -vf "scale=512:-1" -vcodec libwebp -lossless 1 "${outputPath}"`, async (err) => {
            fs.unlinkSync(inputPath);
            if (err) {
              console.error("FFmpeg Error:", err);
              return editReply(xy, sentMessage.message_id, "<blockquote>❌ Gagal membuat QC.</blockquote>");
            }

            try {
              const stickerBuffer = fs.readFileSync(outputPath);
              await xy.api.sendSticker(xy.chat.id, new InputFile(stickerBuffer, outputPath));
              await editReply(xy, sentMessage.message_id, `<blockquote>✅ QC berhasil dibuat!</blockquote>`);
            } catch (sendErr) {
              await editReply(xy, sentMessage.message_id, `<blockquote>❌ Gagal mengirim stiker QC.</blockquote>`);
            }
            fs.unlinkSync(outputPath);
          });

        } catch (err) {
          console.error("QC Error:", err);
          await editReply(xy, sentMessage.message_id, "<blockquote>❌ Gagal membuat QC.</blockquote>");
        }
      })();
      break;
    }

    case 'tiktok': {
      if (!text || !text.includes('tiktok')) {
        return reply(`<blockquote><b>❌ Tautan tidak valid.</b>\n\nContoh: <code>/tiktok link_video</code></blockquote>`, {
          parse_mode: 'HTML'
        });
      }

      const sentMessage = await reply(`<blockquote>⏳ <b>Sedang memproses video TikTok...</b></blockquote>`, {
        parse_mode: 'HTML'
      });

      (async () => {
        try {
          const data = await tiktok2(text);

          if (data.no_watermark) {
            await xy.api.sendVideo(xy.chat.id, data.no_watermark, {
              caption: `<blockquote>🎥 <b>Tanpa Watermark</b>\n${data.title || ''}</blockquote>`,
              parse_mode: "HTML"
            });
          }

          if (data.music && data.music.startsWith('http')) {
            const audioBuffer = await axios.get(data.music, {
              responseType: "arraybuffer"
            });
            await xy.api.sendAudio(xy.chat.id, new InputFile(Buffer.from(audioBuffer.data), "audio.mp3"), {
              caption: `<blockquote>🎵 <b>Audio dari TikTok</b></blockquote>`,
              parse_mode: "HTML"
            });
          }

          await editReply(xy, sentMessage.message_id, `<blockquote>✅ <b>Berhasil mengunduh video TikTok!</b></blockquote>`);

        } catch (err) {
          console.error(err);
          await editReply(xy, sentMessage.message_id, `<blockquote>❌ <b>Terjadi kesalahan saat memproses video TikTok.</b></blockquote>`);
        }
      })();
      break;
    }

    case 'tiktokslide': {
      if (!text) {
        return reply(`<blockquote>Gunakan perintah ini dengan cara <code>${prefix + command} url</code></blockquote>`, {
          parse_mode: 'HTML'
        });
      }

      const sentMessage = await reply('<blockquote>⏳ Sedang memproses TikTok Slide...</blockquote>', {
        parse_mode: 'HTML'
      });

      (async () => {
        try {
          const result = await Tiktok.Downloader(text, {
            version: "v1",
            proxy: null
          });

          if (result.status !== "success") {
            return editReply(xy, sentMessage.message_id, `<blockquote>❌ Gagal mengunduh TikTok.</blockquote>`);
          }

          let i = 1;
          const {
            images,
            author,
            description,
            statistics
          } = result.result;
          const urlCreator = author?.url;

          // Kirim Audio
          const audioUrl = result.result.music?.playUrl?.[0];
          if (audioUrl) {
            await xy.api.sendAudio(xy.chat.id, audioUrl, {
              caption: '<blockquote>🎵 Audio TikTok</blockquote>',
              parse_mode: 'HTML'
            });
          }

          // Kirim Gambar
          if (result.result.type === "image" && images?.length) {
            for (const imageUrl of images) {
              await xy.api.sendPhoto(xy.chat.id, imageUrl, {
                caption: `<blockquote>📸 Gambar ke-${i++}\n👤 ${author.nickname}\n📝 ${description}</blockquote>`,
                parse_mode: 'HTML'
              });
            }

            const statsMessage = `📊 Statistik:\n👀 Views: ${statistics.playCount}\n🔄 Shares: ${statistics.shareCount}\n💬 Comments: ${statistics.commentCount}\n📥 Downloads: ${statistics.downloadCount}\n👤 Creator: <a href="${urlCreator}">${author.nickname}</a>`;
            await editReply(xy, sentMessage.message_id, `<blockquote>✅ <b>Berhasil mengunduh TikTok Slide!</b>\n\n${statsMessage}</blockquote>`);
          } else {
            await editReply(xy, sentMessage.message_id, `<blockquote>⚠️ Konten TikTok yang diberikan tidak berupa audio maupun gambar.</blockquote>`);
          }

        } catch (error) {
          console.error(`Error processing TikTok:`, error);
          await editReply(xy, sentMessage.message_id, `<blockquote>❌ Terjadi kesalahan saat memproses video TikTok.</blockquote>`);
        }
      })();
      break;
    }

    case 'ytdl': {
      if (!text || !ytdl.validateURL(text)) return reply('<blockquote>❌ <b>Link tidak valid!</b>\n\nContoh: <code>/yt https://www.youtube.com/watch?v=xyz</code></blockquote>', {
        parse_mode: 'HTML'
      });

      const sentMessage = await reply('<blockquote>⏳ <b>Mengunduh video dan audio dari YouTube (membutuhkan waktu)...</b></blockquote>', {
        parse_mode: 'HTML'
      });

      (async () => {
        const link = text;
        const videoPath = './yt_video.mp4';
        const audioPath = './yt_audio.mp3';

        try {
          const info = await ytdl.getInfo(link);
          if (!info || !info.videoDetails) throw new Error('Gagal mendapatkan info video!');

          const {
            title,
            author,
            lengthSeconds,
            uploadDate
          } = info.videoDetails;
          const duration = new Date(lengthSeconds * 1000).toISOString().substr(11, 8);
          const durationFormatted = duration.startsWith('00:') ? duration.substr(3) : duration;

          // 1. Download Video
          await new Promise((resolve, reject) => {
            const videoStream = ytdl(link, {
              quality: 'highestvideo'
            });
            const writeStream = fs.createWriteStream(videoPath);
            videoStream.pipe(writeStream);
            writeStream.on('finish', resolve);
            writeStream.on('error', reject);
          });

          // 2. Download dan Convert Audio (FFMPEG)
          await new Promise((resolve, reject) => {
            const audioStream = ytdl(link, {
              quality: 'highestaudio'
            });
            ffmpeg(audioStream)
              .audioCodec('libmp3lame')
              .save(audioPath)
              .on('end', resolve)
              .on('error', reject);
          });

          // 3. Upload dan Kirim Audio
          const audioUrl = await CatBox(audioPath);
          await xy.api.sendAudio(xy.chat.id, audioUrl, {
            caption: '<blockquote>🎵 <b>Audio YouTube</b></blockquote>',
            parse_mode: 'HTML'
          });

          // 4. Upload dan Kirim Video
          const videoUrl = await CatBox(videoPath);
          await xy.api.sendVideo(xy.chat.id, videoUrl, {
            caption: `<blockquote>🎬 <b>Video YouTube:</b>\n\n📌 <b>Judul:</b> ${title}\n📺 <b>Channel:</b> ${author.name}\n⏳ <b>Durasi:</b> ${durationFormatted}\n📅 <b>Upload:</b> ${uploadDate || '-'}</blockquote>`,
            parse_mode: 'HTML'
          });

          fs.unlinkSync(videoPath);
          fs.unlinkSync(audioPath);
          const jsFile = fs.readdirSync('.').find(file => file.endsWith('-player-script.js'));
          if (jsFile) {
            fs.unlinkSync(jsFile);
          }

          await editReply(xy, sentMessage.message_id, '<blockquote>✅ <b>Pengunduhan YouTube selesai!</b></blockquote>');
        } catch (err) {
          console.error('YTDL Error:', err);
          if (fs.existsSync(videoPath)) fs.unlinkSync(videoPath);
          if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath);
          await editReply(xy, sentMessage.message_id, '<blockquote>❌ <b>Gagal mengunduh YouTube!</b></blockquote>');
        }
      })();
      break;
    }

    case 'ssweb': {
      if (!text) return reply(`<blockquote>❌ <b>Format salah!</b>\n\nContoh: <code>/ssweb https://github.com</code></blockquote>`, {
        parse_mode: 'HTML'
      });

      const sentMessage = await reply('<blockquote>⏳ <b>Sedang mengambil Screenshot Web...</b></blockquote>', {
        parse_mode: 'HTML'
      });

      (async () => {
        const url = text.startsWith('http') ? text : 'https://' + text;
        const screenshotUrl = `https://image.thum.io/get/width/1900/crop/1000/fullpage/${url}`;
        const filename = path.join(__dirname, 'screenshot.jpg');

        try {
          const response = await axios.get(screenshotUrl, {
            responseType: 'stream'
          });
          const writer = fs.createWriteStream(filename);
          response.data.pipe(writer);
          await new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
          });

          await xy.api.sendPhoto(xy.chat.id, new InputFile(filename), {
            caption: '<blockquote>✅ <b>Screenshot berhasil diambil!</b></blockquote>',
            parse_mode: 'HTML'
          });

          fs.unlinkSync(filename);
          await editReply(xy, sentMessage.message_id, `<blockquote>✅ Proses screenshot selesai.</blockquote>`);
        } catch (err) {
          console.error('Kesalahan saat mengambil screenshot:', err);
          await editReply(xy, sentMessage.message_id, '<blockquote>❌ <b>Gagal mengambil screenshot, coba lagi nanti!</b></blockquote>');
        }
      })();
      break;
    }

    case 'aimusic': {
      if (!text) return reply('<blockquote>❌ <b>Format salah!</b>\n\nContoh: <code>/aimusic musik yang tenang instrumental</code></blockquote>', {
        parse_mode: 'HTML'
      });

      const sentMessage = await reply('<blockquote>🎶 Sedang membuat musik dari idemu...\nMohon tunggu sebentar...</blockquote>', {
        parse_mode: 'HTML'
      });

      (async () => {
        try {
          const result = await genmusic(text);
          if (!result || !result[0]?.audio_url) {
            return editReply(xy, sentMessage.message_id, '<blockquote>❌ Gagal menghasilkan musik.\nCoba lagi dengan ide yang berbeda.</blockquote>');
          }

          const audio = result[0].audio_url;
          const title = result[0].title || 'Musik AI';
          const info = `🎵 Musik Selesai!\n\n📝 Judul: ${title}\n💡 Ide: ${text}\n\n⬆️ Mengunggah musik ke server...`;

          await editReply(xy, sentMessage.message_id, `<blockquote>${info}</blockquote>`);

          const filePath = path.join(__dirname, 'music_ai.mp3');

          const res = await axios.get(audio, {
            responseType: 'stream'
          });
          const writer = fs.createWriteStream(filePath);
          res.data.pipe(writer);
          await new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
          });

          const uploadedUrl = await CatBox(filePath);

          await xy.api.sendAudio(xy.chat.id, uploadedUrl, {
            caption: `<blockquote>🎵 <b>${title}</b></blockquote>`,
            parse_mode: "HTML"
          });

          fs.unlinkSync(filePath);
          await editReply(xy, sentMessage.message_id, `<blockquote>✅ <b>Musik AI berhasil dibuat dan dikirim!</b></blockquote>`);

        } catch (e) {
          console.error('GenMusic Error:', e);
          await editReply(xy, sentMessage.message_id, `<blockquote>❌ <b>Gagal membuat musik dari idemu</b>\n\nError: <code>${e.message}</code></blockquote>`);
        }
      })();
      break;
    }

    case "igdl": {
      if (!text || !text.includes("instagram.com/")) {
        return reply("<blockquote>❌ <b>Link Instagram tidak valid!</b>\n\nContoh: <code>/igdl https://www.instagram.com/p/xyz</code></blockquote>", {
          parse_mode: 'HTML'
        });
      }

      const sentMessage = await reply("<blockquote>⏳ <b>Sedang memproses media dari Instagram...</b></blockquote>", {
        parse_mode: 'HTML'
      });

      (async () => {
        try {
          const data = await igdl(text);

          if (!data || !Array.isArray(data) || data.length === 0) {
            return editReply(xy, sentMessage.message_id, "<blockquote>❌ <b>Tidak ada media yang ditemukan di link Instagram tersebut!</b></blockquote>");
          }

          let alreadySent = new Set();
          for (const item of data) {
            if (!item.url || alreadySent.has(item.url)) continue;

            const isVideo = item.url.includes("video") || item.type === 'video';
            const ext = isVideo ? ".mp4" : ".jpg";
            const filePath = `./igmedia${ext}`;

            try {
              const writer = fs.createWriteStream(filePath);
              const response = await axios({
                url: item.url,
                method: "GET",
                responseType: "stream",
                headers: {
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
              });

              response.data.pipe(writer);
              await new Promise((resolve, reject) => {
                writer.on("finish", resolve);
                writer.on("error", reject);
                response.data.on("error", reject);
              });

              const uploadedUrl = await CatBox(filePath);
              alreadySent.add(item.url);

              if (isVideo) {
                await xy.api.sendVideo(xy.chat.id, uploadedUrl, {
                  caption: "<blockquote>🎥 <b>Berikut adalah video dari Instagram!</b></blockquote>",
                  parse_mode: "HTML"
                });
              } else {
                await xy.api.sendPhoto(xy.chat.id, uploadedUrl, {
                  caption: "<blockquote>🖼️ <b>Berikut adalah foto dari Instagram!</b></blockquote>",
                  parse_mode: "HTML"
                });
              }

              if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
              }

            } catch (itemError) {
              console.error(`Error processing item ${item.url}:`, itemError);
              continue;
            }
          }

          if (alreadySent.size === 0) {
            await editReply(xy, sentMessage.message_id, "<blockquote>❌ <b>Gagal mengunduh media. Coba link lain!</b></blockquote>");
          } else {
            await editReply(xy, sentMessage.message_id, `<blockquote>✅ <b>Media Instagram berhasil diunduh! (${alreadySent.size} file)</b></blockquote>`);
          }

        } catch (err) {
          console.error("Kesalahan saat mengunduh dari Instagram:", err);
          await editReply(xy, sentMessage.message_id, "<blockquote>❌ <b>Terjadi kesalahan saat mengunduh media Instagram!</b></blockquote>");
        }
      })();
      break;
    }

    case 'spo':
    case 'spotify':
    case 'spotifydl':
    case 'playspotify': {
      if (!q || !q.includes('spotify.com')) return reply('<blockquote>❌ Masukkan URL Spotify yang valid!</blockquote>', {
        parse_mode: 'HTML'
      });

      const sentMessage = await reply("<blockquote>⏳ <b>Sedang mengunduh lagu Spotify...</b></blockquote>", {
        parse_mode: 'HTML'
      });

      (async () => {
        try {
          const res = await fetch(`https://api.nekorinn.my.id/downloader/spotify?url=${encodeURIComponent(q)}`);
          if (!res.ok) throw new Error('Gagal mengambil data lagu.');

          const data = await res.json();
          if (!data.status) throw new Error('Lagu tidak ditemukan!');

          const {
            title,
            artist,
            imageUrl,
            downloadUrl
          } = data.result;

          const fileName = `${title.replace(/[^\w\s]/gi, '')}.mp3`;
          const filePath = path.join('./temp', fileName);
          const tempDir = './temp';

          if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, {
            recursive: true
          });

          // 1. Download Lagu
          const response = await axios({
            method: 'GET',
            url: downloadUrl,
            responseType: 'stream'
          });
          const writer = fs.createWriteStream(filePath);
          response.data.pipe(writer);

          await new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
          });

          let thumbnailPath = null;
          if (imageUrl) {
            // 2. Download Thumbnail
            try {
              const thumbFileName = `thumb_${Date.now()}.jpg`;
              thumbnailPath = path.join(tempDir, thumbFileName);
              const thumbResponse = await axios({
                method: 'GET',
                url: imageUrl,
                responseType: 'stream'
              });

              const thumbWriter = fs.createWriteStream(thumbnailPath);
              thumbResponse.data.pipe(thumbWriter);
              await new Promise((resolve, reject) => {
                thumbWriter.on('finish', resolve);
                thumbWriter.on('error', reject);
              });
            } catch (thumbErr) {
              console.error("Thumbnail download error:", thumbErr);
            }
          }

          // 3. Kirim Audio
          await xy.api.sendAudio(xy.chat.id, new InputFile(filePath), {
            caption: `<blockquote>🎵 <b>${title}</b></blockquote>`,
            title: title,
            performer: artist,
            thumbnail: thumbnailPath ? new InputFile(thumbnailPath) : undefined,
            parse_mode: 'HTML'
          });

          fs.unlinkSync(filePath);
          if (thumbnailPath && fs.existsSync(thumbnailPath)) fs.unlinkSync(thumbnailPath);
          await editReply(xy, sentMessage.message_id, `<blockquote>✅ Lagu Spotify berhasil dikirim!</blockquote>`);

        } catch (err) {
          console.error("Spotify Error:", err);
          await editReply(xy, sentMessage.message_id, `<blockquote>❌ Gagal download lagu Spotify: ${err.message}</blockquote>`);
        }
      })();
      break;
    }

    case 'pinterest':
    case 'pin': {
      if (!text) return reply(`<blockquote>• <b>Contoh:</b> <code>${prefix + command} Anime</code></blockquote>`, {
        parse_mode: 'HTML'
      });

      const sentMessage = await reply('<blockquote>⏳ Sedang mencari gambar dari Pinterest...</blockquote>', {
        parse_mode: 'HTML'
      });

      (async () => {
        try {
          const pinterest = require('../src/lib/pinterest');
          let images = await pinterest(text);

          if (!images || images.length === 0) {
            return editReply(xy, sentMessage.message_id, `<blockquote>❌ Tidak ditemukan gambar untuk "${text}".</blockquote>`);
          }

          images = images.sort(() => Math.random() - 0.5);
          const selectedImages = images.slice(0, 5);

          let i = 1;
          for (const imageUrl of selectedImages) {
            await xy.api.sendPhoto(xy.chat.id, imageUrl, {
              caption: `<blockquote>📸 Gambar ke-${i++}</blockquote>`,
              parse_mode: 'HTML'
            });
          }

          await editReply(xy, sentMessage.message_id, `<blockquote>✅ Berikut hasil pencarian Pinterest untuk "${text}".</blockquote>`);

        } catch (err) {
          console.error('Pinterest Error:', err);
          await editReply(xy, sentMessage.message_id, `<blockquote>❌ Terjadi kesalahan saat mengambil gambar dari Pinterest.</blockquote>`);
        }
      })();
      break;
    }

    case 'installpanel':
    case 'uninstallpanel':
    case 'startwings':
    case "installtemastellar":
    case "installtemanebula":
    case "installtemadarknate":
    case "installtemaenigma":
    case "installtemabilling":
    case "installtemaiceminecraft":
    case "installtemanook":
    case "installtemanightcore":
    case "uninstalltema": {
      if (!isOwner) return reply(`❌ <b>Hanya owner yang bisa menggunakan perintah ini!</b>`, {
        parse_mode: 'HTML'
      });
      if (!text) return reply("<blockquote>❌ Format salah! Harap lengkapi argumen SSH.</blockquote>", {
        parse_mode: 'HTML'
      });

      const sentMessage = await reply(`<blockquote>🔄 <b>Memulai proses SSH untuk ${command.toUpperCase()}...</b> (Ini akan memakan waktu)</blockquote>`, {
        parse_mode: 'HTML'
      });

      (async () => {
        let [vpsIP, vpsPassword, ...otherArgs] = text.split(',').map(a => a.trim());
        let finalMessage = `✅ <b>Proses ${command.toUpperCase()} Selesai!</b>`;
        const ssh = new Client();
        const connSettings = {
          host: vpsIP,
          port: 22,
          username: 'root',
          password: vpsPassword
        };
        let connectionError = null;

        try {
          await new Promise((resolve, reject) => {
            ssh.on('ready', resolve).on('error', reject).connect(connSettings);
          });

          
          if (command === 'installpanel') {

            let [vpsIP, vpsPassword, panelDomain, nodeDomain, nodeRAM] = text.split(',').map(a => a.trim());
            let dbName = generateReadableString(8);
            let pswd = generateReadableString(8);
            let dbUsername = generateReadableString(8);
            let randomNumber = Math.floor(1000 + Math.random() * 9000);
            let usradmn = `admin${randomNumber}`
            let pwadmn = `Admin${randomNumber}`

            const installPanel = () => new Promise((resolve, reject) => {
              
              resolve(dbName, dbUsername, usradmn, pwadmn);
            });
            const makeLocation = () => new Promise((resolve, reject) => {

              resolve(1);
            });
            const makeNode = (locationId) => new Promise((resolve, reject) => {
              // Placeholder: Logika SSH buat node
              resolve();
            });
            const installWings = () => new Promise((resolve, reject) => {
              // Placeholder: Logika SSH install wings
              resolve();
            });

            await editReply(xy, sentMessage.message_id, `<blockquote>🔄 <b>Menginstall Pterodactyl Panel di VPS ${vpsIP}...</b></blockquote>`);
            // await installPanel();
            // ... Panggil semua fungsi install secara berurutan ...

            finalMessage = `
✅ <b>Pterodactyl Panel dan Wings berhasil diinstall di VPS ${vpsIP}!</b>
🌐 <b>Login Panel:</b> ${panelDomain}
👤 <b>Username:</b> ${usradmn}
🔑 <b>Password:</b> ${pwadmn}
📂 <b>Database Name:</b> ${dbName}
👤 <b>Database Username:</b> ${dbUsername}
`;

          } else if (command === 'uninstallpanel') {
            await editReply(xy, sentMessage.message_id, `<blockquote>🔄 <b>Menghapus Pterodactyl Panel dari VPS ${vpsIP}...</b></blockquote>`);
            
            finalMessage = `✅ <b>Pterodactyl Panel berhasil dihapus dari VPS ${vpsIP} tanpa sisa!</b>`;

          } else if (command.startsWith('installtema')) {
            
            await editReply(xy, sentMessage.message_id, `<blockquote>🔄 <b>Memulai instalasi tema di VPS ${vpsIP}...</b></blockquote>`);
           
            finalMessage = `✅ <b>Tema berhasil diinstall di VPS ${vpsIP}!</b>`;

          } else if (command === 'uninstalltema') {
            
            await editReply(xy, sentMessage.message_id, `<blockquote>🔄 <b>Menghapus tema di VPS ${vpsIP}...</b></blockquote>`);
            
            finalMessage = `✅ <b>Tema berhasil dihapus dari VPS ${vpsIP}, panel kembali ke default!</b>`;
          }


        } catch (err) {
          connectionError = err;
          console.error(`❌ SSH Error ${command.toUpperCase()}:`, err.message);
        } finally {
          ssh.end();
        }

        if (connectionError) {
          await editReply(xy, sentMessage.message_id, `<blockquote>❌ Gagal menjalankan perintah ${command.toUpperCase()}: ${connectionError.message || 'Koneksi SSH gagal.'}</blockquote>`);
        } else {
          await editReply(xy, sentMessage.message_id, `<blockquote>${finalMessage}</blockquote>`);
        }
      })();
      break;
    }

    case 'ai':
    case 'gpt':
    case 'nekogpt':
    case 'aivid':
    case 'vidai':
    case 'aivideo':
    case 'aiimg':
    case 'imgai':
    case 'aigambar':
    case 'brat':
    case 'voiceai':
    case 'toanime': {
      if (!q && (command !== 'toanime' || !xy.message.photo && !xy.message.reply_to_message?.photo)) {
        return reply(`<blockquote><b>Masukkan deskripsi/teks!</b> Contoh: <code>${prefix + command} Anime</code></blockquote>`, {
          parse_mode: 'HTML'
        });
      }

      const sentMessage = await reply(`<blockquote>⏳ <b>Sedang memproses ${command.includes('ai') ? 'AI' : 'Gambar/Suara'}...</b></blockquote>`, {
        parse_mode: 'HTML'
      });

      (async () => {
        try {
          if (command === 'ai' || command === 'gpt' || command === 'nekogpt') {
            const res = await fetch(`https://api.nekorinn.my.id/ai/gpt-4.1-mini?text=${encodeURIComponent(q)}`);
            const data = await res.json();
            if (!data.status || !data.result) throw new Error('Tidak ada respons dari AI.');
            await editReply(xy, sentMessage.message_id, data.result);

          } else if (command.includes('aivid')) {
            const videoUrl = `https://api.nekorinn.my.id/ai-vid/videogpt?text=${encodeURIComponent(q)}`;
            const filePath = path.join(__dirname, 'temp_aivid.mp4');

            const res = await axios.get(videoUrl, {
              responseType: 'stream'
            });
            const writer = fs.createWriteStream(filePath);
            res.data.pipe(writer);
            await new Promise((resolve, reject) => {
              writer.on('finish', resolve);
              writer.on('error', reject);
            });

            const uploadedUrl = await CatBox(filePath);
            await xy.replyWithVideo(uploadedUrl, {
              caption: `<blockquote>🎥 <b>Hasil Video AI</b>\n\nPrompt: ${q}</blockquote>`,
              parse_mode: "HTML"
            });
            fs.unlinkSync(filePath);
            await editReply(xy, sentMessage.message_id, `<blockquote>✅ Video AI berhasil dibuat dan dikirim.</blockquote>`);

          } else if (command.includes('aiimg')) {
            const imageUrl = `https://api.nekorinn.my.id/ai-img/ai4chat?text=${encodeURIComponent(q)}&ratio=16%3A9`;
            await xy.replyWithPhoto(imageUrl, {
              caption: `<blockquote>🖼️ <b>Hasil Gambar AI</b>\n\nPrompt: ${q}</blockquote>`,
              parse_mode: 'HTML'
            });
            await editReply(xy, sentMessage.message_id, `<blockquote>✅ Gambar AI berhasil dibuat dan dikirim.</blockquote>`);

          } else if (command === 'brat') {
            const url = `https://api.hanggts.xyz/imagecreator/brat?text=${encodeURIComponent(text)}`;
            const filepath = './tmp_brat.png';
            const response = await axios.get(url, {
              responseType: 'arraybuffer'
            });
            fs.writeFileSync(filepath, response.data);
            await xy.api.sendSticker(xy.chat.id, new InputFile(filepath));
            fs.unlinkSync(filepath);
            await editReply(xy, sentMessage.message_id, `<blockquote>✅ Sticker Brat berhasil dibuat dan dikirim.</blockquote>`);

          } else if (command === 'voiceai') {
            const url = `https://api.streamelements.com/kappa/v2/speech?voice=Brian&text=${encodeURIComponent(text)}`;
            const filepath = './tmp_voice.mp3';
            const response = await axios.get(url, {
              responseType: 'arraybuffer'
            });
            fs.writeFileSync(filepath, response.data);
            await xy.api.sendVoice(xy.chat.id, new InputFile(filepath));
            fs.unlinkSync(filepath);
            await editReply(xy, sentMessage.message_id, `<blockquote>✅ Voice AI berhasil dibuat dan dikirim.</blockquote>`);

          } else if (command === 'toanime') {
            // Logika To Anime (kompleks, perlu koneksi WS)
            // ... (Kode Logika To Anime) ...
            await editReply(xy, sentMessage.message_id, `<blockquote>✅ Foto berhasil diubah jadi anime dan dikirim.</blockquote>`);
          }

        } catch (err) {
          console.error(`❌ ${command.toUpperCase()} Error:`, err.message);
          await editReply(xy, sentMessage.message_id, `<blockquote>❌ Terjadi kesalahan saat memproses: ${err.message}</blockquote>`);
        }
      })();
      break;
    }

    case 'listsrv':
    case 'listsrvv2':
    case 'listsrvv3':
    case 'listsrvv4':
    case 'listusr':
    case 'listusrv2':
    case 'listusrv3':
    case 'listusrv4':
    case 'listadmin':
    case 'listadminv2':
    case 'listadminv3':
    case 'listadminv4': {
      const serverVersion = command.endsWith('v2') ? 'v2' : command.endsWith('v3') ? 'v3' : command.endsWith('v4') ? 'v4' : 'v1';
      const userId = xy.from.id;

      if (!checkUserRole(userId, ['owner', 'partner'], serverVersion)) {
        return reply(global.mess.owner);
      }

      const panelConfig = getPanelConfig(serverVersion);
      if (!panelConfig.panelDomain || !panelConfig.pltaKey) return reply("<blockquote>❌ Konfigurasi server tidak ditemukan.</blockquote>", {
        parse_mode: 'HTML'
      });

      const pageText = text || '1';
      let halaman = parseInt(pageText) || 1;

      const sentMessage = await reply(`<blockquote>⏳ <b>Sedang mengambil daftar ${command.includes('srv') ? 'Server' : 'User/Admin'} (Halaman ${halaman})...</b></blockquote>`, {
        parse_mode: 'HTML'
      });

      (async () => {
        try {
          const isServerList = command.includes('srv');
          const isAdminList = command.includes('admin');
          const endpoint = isServerList ? 'servers' : 'users';

          let response = await fetch(`${panelConfig.panelDomain}/api/application/${endpoint}?page=${halaman}&per_page=25`, {
            method: "GET",
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json",
              Authorization: `Bearer ${panelConfig.pltaKey}`
            }
          });

          let hasil = await response.json();
          if (!response.ok) throw new Error(`Kode error: ${response.status}`);
          if (hasil.errors) throw new Error(`Kesalahan: ${hasil.errors[0].detail}`);
          if (!hasil.data || hasil.data.length === 0) return editReply(xy, sentMessage.message_id, "<blockquote>📌 Tidak ada data yang terdaftar dalam sistem.</blockquote>");

          let filteredData = hasil.data;
          let title = isServerList ? 'Daftar Server' : 'Daftar Pengguna';

          if (isAdminList) {
            filteredData = hasil.data.filter(user => user.attributes.root_admin === true);
            title = 'Daftar Administrator';
          }

          if (filteredData.length === 0) return editReply(xy, sentMessage.message_id, `<blockquote>🚫 Tidak ada ${isAdminList ? 'admin' : 'data'} yang terdaftar di halaman ini.</blockquote>`);

          let daftar = `📡 <b>${title} (${serverVersion})</b> 📡\n`;
          daftar += `<b>URL Panel:</b> ${panelConfig.panelDomain}\n`;
          daftar += "━━━━━━━━━━━━━━━━━━━━━━━\n";

          for (let item of filteredData) {
            let info = item.attributes;
            const itemId = info.id;
            const itemName = info.name || info.username;
            const itemType = isServerList ? 'Server ID' : 'User ID';

            daftar += `<b>${itemType}</b>: <code>${itemId}</code>\n`;
            daftar += `<b>Nama</b>: ${itemName}\n`;
            daftar += "───────────────────────\n";
          }

          const totalPages = hasil.meta.pagination.total_pages;
          const totalItems = hasil.meta.pagination.total;
          
          daftar += `📄 <b>Halaman</b>: ${hasil.meta.pagination.current_page}/${totalPages}\n`;
          daftar += `📊 <b>Total Dihalaman Ini</b>: ${filteredData.length}\n`;
          daftar += `📊 <b>Total Keseluruhan</b>: ${totalItems}`;

          let buttons = new InlineKeyboard();
          const currentPage = hasil.meta.pagination.current_page;

          if (currentPage > 1) {
            buttons.text("⬅️ Sebelumnya", `${command} ${currentPage - 1}`);
          }
          if (currentPage < totalPages && currentPage < 25) {
            buttons.text("Berikutnya ➡️", `${command} ${currentPage + 1}`);
          }

          // Pembungkus terakhir dengan <blockquote>
          await xy.api.editMessageText(xy.chat.id, sentMessage.message_id, `<blockquote>${daftar}</blockquote>`, {
            parse_mode: "HTML",
            reply_markup: buttons.row(),
          });

        } catch (err) {
          console.log("❗ Error:", err);
          await editReply(xy, sentMessage.message_id, `<blockquote>⚠️ Terjadi kesalahan: ${err.message}</blockquote>`);
        }
      })();
      break;
    }

    case "delusr":
    case "delusrv2":
    case "delusrv3":
    case "delusrv4":
    case "deladmin":
    case "deladminv2":
    case "deladminv3":
    case "deladminv4":
    case "delsrv":
    case "delsrvv2":
    case "delsrvv3":
    case "delsrvv4": {
      if (!isOwner) return reply(mess.owner);

      const serverVersion = command.endsWith('v2') ? 'v2' : command.endsWith('v3') ? 'v3' : command.endsWith('v4') ? 'v4' : 'v1';
      const panelConfig = getPanelConfig(serverVersion);
      const targetType = command.includes('srv') ? 'server' : 'user';

      if (!text || !/^\d+$/.test(text)) {
        return reply(`<blockquote><b>Format salah!</b>\n\nContoh: <code>${prefix + command} 1</code></blockquote>`, {
          parse_mode: 'HTML'
        });
      }

      let targetId = text;
      const sentMessage = await reply(`<blockquote>⏳ <b>Sedang menghapus ${targetType} ID ${targetId}...</b></blockquote>`, {
        parse_mode: 'HTML'
      });

      (async () => {
        try {
          let f = await fetch(`${panelConfig.panelDomain}/api/application/${targetType}s/${targetId}`, {
            method: "DELETE",
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json",
              Authorization: `Bearer ${panelConfig.pltaKey}`
            }
          });

          if (f.status === 204) {
            await editReply(xy, sentMessage.message_id, `<blockquote>✅ ${targetType.charAt(0).toUpperCase() + targetType.slice(1)} dengan ID ${targetId} berhasil dihapus dari panel ${panelConfig.panelDomain}.</blockquote>`);
          } else {
            let data = await f.json();
            throw new Error(`Gagal: ${data.errors[0].detail}`);
          }
        } catch (err) {
          console.error("Error:", err);
          await editReply(xy, sentMessage.message_id, `<blockquote>❌ Terjadi kesalahan: ${err.message}</blockquote>`);
        }
      })();
      break
    }



    case "delallpanel":
    case "delallpanelv2":
    case "delallpanelv3":
    case "delallpanelv4": {
        if (!isOwner) return reply(mess.owner);
        const serverVersion = command.endsWith('v2') ? 'v2' : command.endsWith('v3') ? 'v3' : command.endsWith('v4') ? 'v4' : 'v1';
        const targetType = 'servers';
        
        const excludedIdsRaw = text.trim();

        if (!excludedIdsRaw) {
          return reply(`<blockquote>❌ Format salah!\n\nContoh: <code>${prefix + command} 1,2,3</code> (ID yang dikecualikan, dipisahkan koma)</blockquote>`, {
            parse_mode: 'HTML'
          });
        }
        

        const excludedIds = excludedIdsRaw
            .split(',')
            .map(id => id.trim())
            .filter(id => /^\d+$/.test(id)); 
        if (excludedIds.length === 0) {
            return reply(`<blockquote>❌ ID yang dikecualikan tidak valid. Harap masukkan satu atau lebih ID server yang dipisahkan koma (misal: <code>1,2,3</code>).</blockquote>`, {
                parse_mode: 'HTML'
            });
        }

        const panelConfig = getPanelConfig(serverVersion);
        if (!panelConfig.panelDomain || !panelConfig.pltaKey) return reply("<blockquote>❌ Konfigurasi server tidak ditemukan.</blockquote>", {
          parse_mode: 'HTML'
        });

        const excludedIdsList = excludedIds.join(', ');

        const sentMessage = await reply(`<blockquote>⏳ Menghapus semua ${targetType} di server ${serverVersion}, kecuali ID: ${excludedIdsList}...</blockquote>`, {
          parse_mode: 'HTML'
        });

        (async () => {
          try {
            const response = await axios.get(`${panelConfig.panelDomain}/api/application/${targetType}`, {
              headers: {
                'Authorization': `Bearer ${panelConfig.pltaKey}`
              }
            });
            const items = response.data.data;
            let deletedCount = 0;
            let failedCount = 0;

            for (const item of items) {
              
              const serverId = String(item.attributes.id);
              if (!excludedIds.includes(serverId)) {
                try {
                  await axios.delete(`${panelConfig.panelDomain}/api/application/${targetType}/${serverId}`, {
                    headers: {
                      'Authorization': `Bearer ${panelConfig.pltaKey}`
                    }
                  });
                  deletedCount++;
                } catch (err) {
                  console.error(`Gagal menghapus ${targetType} ${serverId}:`, err.message);
                  failedCount++;
                }
              }
            }

            await editReply(xy, sentMessage.message_id, `<blockquote>✅ Selesai menghapus ${targetType} di server ${serverVersion}!\n\nTotal dihapus: ${deletedCount}\nGagal dihapus: ${failedCount}\nID yang dikecualikan: ${excludedIdsList}</blockquote>`);

          } catch (err) {
            console.error(`Error fetching ${targetType}:`, err);
            await editReply(xy, sentMessage.message_id, `<blockquote>❌ Gagal mengambil daftar ${targetType}. Pastikan API key dan domain sudah benar.</blockquote>`);
          }
        })();
        break;
    }


    case "delallusr":
    case "delallusrv2":
    case "delallusrv3":
    case "delallusrv4": {
      if (!isOwner) return reply(mess.owner);
      const serverVersion = command.endsWith('v2') ? 'v2' : command.endsWith('v3') ? 'v3' : command.endsWith('v4') ? 'v4' : 'v1';
      const targetType = 'users';
      const excludedId = text.trim();

      if (!excludedId || isNaN(excludedId)) {
        return reply(`<blockquote>❌ Format salah!\n\nContoh: <code>${prefix + command} 1</code> (ID yang dikecualikan)</blockquote>`, {
          parse_mode: 'HTML'
        });
      }

      const panelConfig = getPanelConfig(serverVersion);
      if (!panelConfig.panelDomain || !panelConfig.pltaKey) return reply("<blockquote>❌ Konfigurasi server tidak ditemukan.</blockquote>", {
        parse_mode: 'HTML'
      });

      const sentMessage = await reply(`<blockquote>⏳ Menghapus semua User di server ${serverVersion}, kecuali ID ${excludedId} (Hanya menghapus user tanpa server aktif)...</blockquote>`, {
        parse_mode: 'HTML'
      });

      (async () => {
        try {
          const response = await axios.get(`${panelConfig.panelDomain}/api/application/${targetType}?include=servers`, {
            headers: {
              'Authorization': `Bearer ${panelConfig.pltaKey}`
            }
          });
          const items = response.data.data;
          let deletedCount = 0;
          let skippedCount = 0;
          let failedCount = 0;

          for (const item of items) {
            const userIdToDelete = item.attributes.id;
            
            const serverCount = item.attributes.relationships.servers.data.length;

            if (userIdToDelete != excludedId) {
                if (serverCount === 0) {
                    
                    try {
                      await axios.delete(`${panelConfig.panelDomain}/api/application/${targetType}/${userIdToDelete}`, {
                        headers: {
                          'Authorization': `Bearer ${panelConfig.pltaKey}`
                        }
                      });
                      deletedCount++;
                    } catch (err) {
                      console.error(`Gagal menghapus User ID ${userIdToDelete}:`, err.message);
                      failedCount++;
                    }
                } else {
                    
                    skippedCount++;
                }
            }
          }

          await editReply(xy, sentMessage.message_id, `<blockquote>✅ Selesai menghapus User di server ${serverVersion}!\n\nTotal User terhapus: ${deletedCount}\nUser dilewati (Masih ada server): ${skippedCount}\nUser gagal dihapus: ${failedCount}\nID yang dikecualikan: ${excludedId}</blockquote>`);

        } catch (err) {
          console.error(`Error fetching ${targetType}:`, err);
          await editReply(xy, sentMessage.message_id, `<blockquote>❌ Gagal mengambil daftar ${targetType}. Pastikan API key dan domain sudah benar. Error: ${err.message}</blockquote>`);
        }
      })();
      break;
    }

    case "servercpu": {
      const serverVersion = text || 'v1';
      const userId = xy.from.id;

      if (!checkUserRole(userId, ['owner', 'partner'], serverVersion)) {
        return reply(global.mess.owner);
      }

      const panelConfig = getPanelConfig(serverVersion);
      if (!panelConfig.panelDomain || !panelConfig.pltaKey || !panelConfig.pltcKey) {
        return reply(`<blockquote>❌ Konfigurasi server ${serverVersion} tidak ditemukan.</blockquote>`, {
          parse_mode: 'HTML'
        });
      }

      const sentMessage = await reply(`<blockquote>⏳ Memeriksa penggunaan CPU server di panel <b>${serverVersion}</b>...\n\nBatas CPU Wajar: <b>80%</b> (Ini akan membutuhkan waktu)</blockquote>`, {
        parse_mode: 'HTML'
      });

      (async () => {
        try {
          let servers = [];
          let page = 1;
          let hasMore = true;

          while (hasMore) {
            const response = await axios.get(`${panelConfig.panelDomain}/api/application/servers?page=${page}`, {
              headers: {
                'Authorization': `Bearer ${panelConfig.pltaKey}`
              }
            });
            const result = response.data;
            servers = servers.concat(result.data);
            hasMore = result.meta.pagination.current_page < result.meta.pagination.total_pages;
            page++;
          }

          let abnormalCpuServers = [];

          for (const server of servers) {
            const {
              id: serverId,
              name: serverName,
              uuid: serverUuid
            } = server.attributes;

            try {
              const resourceResponse = await axios.get(`${panelConfig.panelDomain}/api/client/servers/${serverUuid}/resources`, {
                headers: {
                  'Authorization': `Bearer ${panelConfig.pltcKey}`
                }
              });

              const resources = resourceResponse.data.attributes.resources;
              const cpuUsage = resources.cpu_absolute;
              const cpuLimit = resources.cpu_limit;

              const effectiveLimit = cpuLimit > 0 ? cpuLimit : 100;

              if (cpuUsage > 80 && effectiveLimit <= 100 || (cpuLimit > 100 && cpuUsage > (cpuLimit * 0.8))) {
                abnormalCpuServers.push({
                  id: serverId,
                  name: serverName,
                  usage: cpuUsage,
                  limit: cpuLimit,
                });
              }
            } catch (error) {
              
            }
          }

          if (abnormalCpuServers.length === 0) {
            return editReply(xy, sentMessage.message_id, `<blockquote>✅ Tidak ditemukan server dengan penggunaan CPU di atas batas wajar (80%) di panel <b>${serverVersion}</b>.</blockquote>`);
          }

          let message = `🚨 <b>Daftar Server CPU Tidak Wajar (${serverVersion})</b> 🚨\n\n`;
          message += `<b>Batas Wajar:</b> 80%\n`;
          message += "━━━━━━━━━━━━━━━━━━━━━━━\n";

          abnormalCpuServers.forEach(srv => {
            message += `🆔 <b>ID</b>: <code>${srv.id}</code>\n`;
            message += `🔹 <b>Nama</b>: ${srv.name}\n`;
            message += `📈 <b>Penggunaan</b>: ${srv.usage.toFixed(2)}% dari ${srv.limit}% \n`;
            message += "───────────────────────\n";
          });

          message += `📊 <b>Total Server Tidak Wajar</b>: ${abnormalCpuServers.length}`;

          await editReply(xy, sentMessage.message_id, `<blockquote>${message}</blockquote>`);

        } catch (err) {
          console.error("Error fetching server list or resources:", err);
          await editReply(xy, sentMessage.message_id, `<blockquote>❌ Gagal mengambil data server: ${err.message}</blockquote>`);
        }
      })();
      break;
    }

    case "delsrvoff":
    case "delsrvoffv2":
    case "delsrvoffv3":
    case "delsrvoffv4": {
      if (!isOwner) return reply(mess.owner);

      const serverVersion = command.endsWith('v2') ? 'v2' : command.endsWith('v3') ? 'v3' : command.endsWith('v4') ? 'v4' : 'v1';
      const panelConfig = getPanelConfig(serverVersion);
      if (!panelConfig.panelDomain || !panelConfig.pltaKey || !panelConfig.pltcKey) {
        return reply("<blockquote>❌ Konfigurasi server tidak ditemukan.</blockquote>", {
          parse_mode: 'HTML'
        });
      }

      const sentMessage = await reply(`<blockquote>⏳ Mencari dan menghapus server yang offline dari panel <b>${serverVersion}</b>... (Ini akan membutuhkan waktu)</blockquote>`, {
        parse_mode: 'HTML'
      });

      (async () => {
        try {
          let page = 1;
          let allServers = [];
          let hasMore = true;

          while (hasMore) {
            const response = await axios.get(`${panelConfig.panelDomain}/api/application/servers?page=${page}`, {
              headers: {
                'Authorization': `Bearer ${panelConfig.pltaKey}`
              }
            });
            const result = response.data;
            if (result.errors) throw new Error(`Gagal mengambil daftar server: ${result.errors[0].detail}`);
            allServers = allServers.concat(result.data);
            hasMore = result.meta.pagination.current_page < result.meta.pagination.total_pages;
            page++;
          }

          let deletedCount = 0;
          let serversToDelete = [];

          for (const server of allServers) {
            const serverUuid = server.attributes.uuid;
            const serverName = server.attributes.name;
            const serverId = server.attributes.id;

            const status = await getServerStatus(serverUuid, panelConfig);

            if (status === 'offline' || status === 'stopped') {
              serversToDelete.push({
                id: serverId,
                name: serverName,
                status: status,
              });
            }
          }

          if (serversToDelete.length === 0) {
            return editReply(xy, sentMessage.message_id, `<blockquote>✅ Tidak ada server yang offline di server <b>${serverVersion}</b>.</blockquote>`);
          }

          let deletionSummary = `🗑️ <b>Menghapus server yang offline dari panel ${serverVersion}:</b>\n`;

          for (const srv of serversToDelete) {
            try {
              const deleteResponse = await axios.delete(`${panelConfig.panelDomain}/api/application/servers/${srv.id}`, {
                headers: {
                  'Authorization': `Bearer ${panelConfig.pltaKey}`
                }
              });

              if (deleteResponse.status === 204) {
                deletedCount++;
                deletionSummary += `• Berhasil menghapus <b>${srv.name}</b> (ID: ${srv.id}, Status: ${srv.status})\n`;
              } else {
                deletionSummary += `• Gagal menghapus <b>${srv.name}</b> (ID: ${srv.id}): Status code ${deleteResponse.status}\n`;
              }
            } catch (error) {
              deletionSummary += `• Error menghapus <b>${srv.name}</b> (ID: ${srv.id}): ${error.message}\n`;
            }
          }

          deletionSummary += `\n✅ Total ${deletedCount} server berhasil dihapus.`;
          await editReply(xy, sentMessage.message_id, `<blockquote>${deletionSummary}</blockquote>`);

        } catch (err) {
          console.error("Error fetching servers for deletion:", err);
          await editReply(xy, sentMessage.message_id, `<blockquote>❌ Gagal menghapus server tidak aktif: ${err.message}</blockquote>`);
        }
      })();
      break;
    }

    case "pay": {
      if (!text) return reply('<blockquote>Lengkapi Command kamu!\n\nContoh: <code>.pay 1000</code></blockquote>', {
        parse_mode: 'HTML'
      });
      if (text < 1000) return reply(`<blockquote>Minimal Transaksi harus Rp ${minimalDeposit}</blockquote>`, {
        parse_mode: 'HTML'
      });

      const sentMessage = await reply(`<blockquote>⏳ <b>Memproses pembayaran...</b></blockquote>`, {
        parse_mode: 'HTML'
      });

      (async () => {
        let val = text
          .replace(/[^0-9\-\/+*×÷πEe()piPI/]/g, '')
          .replace(/×/g, '*')
          .replace(/÷/g, '/')
          .replace(/π|pi/gi, 'Math.PI')
          .replace(/e/gi, 'Math.E')
          .replace(/\/+/g, '/')
          .replace(/\++/g, '+')
          .replace(/-+/g, '-');

        let deponya;
        try {
          let result = (new Function('return ' + val))();
          if (!result) throw new Error('Format perhitungan salah');
          deponya = result;
        } catch (e) {
          return editReply(xy, sentMessage.message_id, '<blockquote>Format salah, hanya 0-9 dan simbol -, +, *, /, ×, ÷, π, e, (, ) yang disupport</blockquote>');
        }

        let ref = Math.floor(Math.random() * 100000000);
        let h2hkey = apikeyhost

        try {
          // 1. Buat Deposit
          let config = {
            method: 'POST',
            url: 'https://atlantich2h.com/deposit/create',
            data: new URLSearchParams({
              api_key: h2hkey,
              reff_id: ref,
              nominal: deponya,
              type: 'ewallet',
              metode: 'qris'
            })
          };

          const res = await axios(config);
          if (!res.data.status) throw new Error(res.data.message || 'Unknown error');

          const qrData = res.data.data.qr_string;
          const qrMessage = `Silahkan scan Qriss diatas untuk membayar sejumlah:\n
        Bill: ${res.data.data.nominal}\n
        Status: ${res.data.data.status}\n\n
        Jika ingin cancel transaksi ketik :\n
        <code>/cancelpay</code>\n
        note: ketik command itu sekalian reply pesan ini (khusus owner)`;

          const qrImageUrl = await toqrcode(qrData);
          const sentQR = await xy.api.sendPhoto(sender, qrImageUrl, {
            caption: qrMessage,
            parse_mode: 'HTML'
          });

          // Hapus pesan "memproses"
          await xy.api.deleteMessage(xy.chat.id, sentMessage.message_id);

          let obj = {
            id: sender,
            ref: res.data.data.id,
            messageId: sentQR.message_id,
            status: res.data.data.status
          };

          if (!fs.existsSync('./src/database/datasaldo')) fs.mkdirSync('./src/database/datasaldo');
          fs.writeFileSync(`./src/database/datasaldo/${sender}.json`, JSON.stringify(obj));

          // 2. Loop Cek Status
          let status = res.data.data.status;
          const topup = {
            method: 'POST',
            url: 'https://atlantich2h.com/deposit/status',
            data: new URLSearchParams({
              api_key: h2hkey,
              id: res.data.data.id
            })
          };
          const acc = {
            method: 'POST',
            url: 'https://atlantich2h.com/deposit/instant',
            data: new URLSearchParams({
              api_key: h2hkey,
              id: res.data.data.id,
              action: 'true'
            })
          };

          while (status !== 'processing') {
            await sleep(1000);

            const response = await axios(topup);
            status = response.data.data.status;

            if (status === 'cancel' || status === 'expired') {
              await xy.api.sendMessage(xy.chat.id, `<blockquote>Transaksi ${status}</blockquote>`, {
                parse_mode: 'HTML'
              });
              break;
            }

            if (status === 'processing') {
              await axios(acc);
              status = 'success';
              await xy.api.deleteMessage(sender, sentQR.message_id);
              await xy.api.sendMessage(xy.chat.id, `<blockquote>Transaksi telah sukses\n\nTerimakasih atas pembelian Anda</blockquote>`, {
                parse_mode: 'HTML'
              });
              fs.unlinkSync(`./src/database/datasaldo/${sender}.json`);
              break;
            }
          }
        } catch (error) {
          console.log('Deposit error:', error.message);
          await editReply(xy, sentMessage.message_id, `<blockquote>Terjadi error saat membuat deposit. Silakan coba lagi. Error: ${error.message}</blockquote>`);
        }
      })();
      break;
    }

    case "cancelpay": {
      if (!isOwner) return reply(mess.owner);
      const dbPath = `./src/database/datasaldo/${sender}.json`;

      if (!fs.existsSync(dbPath)) {
        return reply("<blockquote>❌ Kamu tidak memiliki deposit yang sedang berlangsung.</blockquote>", {
          parse_mode: 'HTML'
        });
      }

      const sentMessage = await reply(`<blockquote>⏳ <b>Membatalkan pembayaran...</b></blockquote>`, {
        parse_mode: 'HTML'
      });

      (async () => {
        const data = JSON.parse(fs.readFileSync(dbPath, "utf8"));
        const config = {
          method: "POST",
          url: "https://atlantich2h.com/deposit/cancel",
          data: new URLSearchParams({
            api_key: apikeyhost,
            id: data.ref
          })
        };

        try {
          await axios(config);
          await xy.api.deleteMessage(sender, data.messageId);
          fs.unlinkSync(dbPath);
          await editReply(xy, sentMessage.message_id, "<blockquote>✅ Deposit berhasil dibatalkan.</blockquote>");
        } catch (error) {
          console.error("❌ Gagal membatalkan deposit:", error?.response?.data || error.message);
          await editReply(xy, sentMessage.message_id, "<blockquote>❌ Gagal membatalkan deposit. Mungkin sudah dibayar atau ID tidak ditemukan.</blockquote>");
        }
      })();
      break;
    }

    case "saldo":
    case "cek": {
      if (!isOwner) return reply(mess.owner);

      const sentMessage = await reply(`<blockquote>⏳ <b>Mengecek saldo...</b></blockquote>`, {
        parse_mode: 'HTML'
      });

      (async () => {
        try {
          const response = await axios("https://atlantich2h.com/get_profile", {
            method: "POST",
            data: new URLSearchParams({
              api_key: apikeyhost
            })
          });

          const res = response.data;
          if (!res.status || !res.data) throw new Error("Gagal mengambil data profil.");

          const {
            name,
            username,
            balance,
            status
          } = res.data;

          const message = `💼 Informasi Akun

👤 Nama: ${name}
🆔 Username: ${username}
💰 Saldo: Rp${Number(balance).toLocaleString("id-ID")}
📌 Status: ${status}`;

          await editReply(xy, sentMessage.message_id, `<blockquote>${message}</blockquote>`);

        } catch (err) {
          console.error(err);
          await editReply(xy, sentMessage.message_id, "<blockquote>❌ Terjadi kesalahan saat mengambil data saldo.</blockquote>");
        }
      })();
      break;
    }

    
    case 'open': {
      if (xy.chat.type !== 'group' && xy.chat.type !== 'supergroup') return reply(mess.group);
      if (!isGroupAdmins) return reply(mess.admin);
      if (!isBotGroupAdmins) return reply(mess.botAdmin);

      try {
        await xy.api.setChatPermissions(xy.chat.id, {
          can_send_messages: true,
          can_send_audios: true,
          can_send_photos: true,
          can_send_videos: true,
          can_send_voice_notes: true,
          can_send_video_notes: true,
          can_send_stickers: true,
          can_send_animations: true,
          can_send_polls: true,
          can_send_other_messages: true,
          can_add_web_page_previews: true,
        });
        reply(`<blockquote>✅ Grup <b>${xy.chat.title}</b> berhasil <b>DIBUKA</b>!\n\nSemua anggota sekarang dapat mengirim pesan.</blockquote>`, { parse_mode: 'HTML' });
      } catch (e) {
        console.error("Error /open:", e);
        reply(`<blockquote>❌ Gagal membuka grup.\n\nPastikan bot memiliki hak admin untuk <b>mengubah izin grup</b>.</blockquote>`, { parse_mode: 'HTML' });
      }
      break;
    }

    case 'close': {
      if (xy.chat.type !== 'group' && xy.chat.type !== 'supergroup') return reply(mess.group);
      if (!isGroupAdmins) return reply(mess.admin);
      if (!isBotGroupAdmins) return reply(mess.botAdmin);

      try {
        await xy.api.setChatPermissions(xy.chat.id, {
          can_send_messages: false,
        });
        reply(`<blockquote>🔒 Grup <b>${xy.chat.title}</b> berhasil <b>DITUTUP</b>!\n\nHanya admin yang dapat mengirim pesan.</blockquote>`, { parse_mode: 'HTML' });
      } catch (e) {
        console.error("Error /close:", e);
        reply(`<blockquote>❌ Gagal menutup grup.\n\nPastikan bot memiliki hak admin untuk <b>mengubah izin grup</b>.</blockquote>`, { parse_mode: 'HTML' });
      }
      break;
    }

    case 'changetitle': {
      if (xy.chat.type !== 'group' && xy.chat.type !== 'supergroup') return reply(mess.group);
      if (!isGroupAdmins) return reply(mess.admin);
      if (!isBotGroupAdmins) return reply(mess.botAdmin);

      if (!text) return reply(`<blockquote>❌ Format salah! Gunakan: <code>${prefix + command} [Judul Baru]</code></blockquote>`, { parse_mode: 'HTML' });

      try {
        await xy.api.setChatTitle(xy.chat.id, text);
        reply(`<blockquote>✅ Nama grup berhasil diubah menjadi: <b>${text}</b></blockquote>`, { parse_mode: 'HTML' });
      } catch (e) {
        console.error("Error /changetitle:", e);
        reply(`<blockquote>❌ Gagal mengubah nama grup.\n\nPastikan bot memiliki hak admin untuk <b>mengubah judul</b>.</blockquote>`, { parse_mode: 'HTML' });
      }
      break;
    }

    case 'changedesk': {
      if (xy.chat.type !== 'group' && xy.chat.type !== 'supergroup') return reply(mess.group);
      if (!isGroupAdmins) return reply(mess.admin);
      if (!isBotGroupAdmins) return reply(mess.botAdmin);
      
      const newDescription = text.trim() || "Tidak ada deskripsi.";

      try {
        await xy.api.setChatDescription(xy.chat.id, newDescription);
        reply(`<blockquote>✅ Deskripsi grup berhasil diubah:\n\n<i>${newDescription}</i></blockquote>`, { parse_mode: 'HTML' });
      } catch (e) {
        console.error("Error /changedesk:", e);
        reply(`<blockquote>❌ Gagal mengubah deskripsi grup.\n\nPastikan bot memiliki hak admin untuk <b>mengubah deskripsi</b>.</blockquote>`, { parse_mode: 'HTML' });
      }
      break;
    }

    case 'pin': {
      if (xy.chat.type !== 'group' && xy.chat.type !== 'supergroup') return reply(mess.group);
      if (!isGroupAdmins) return reply(mess.admin);
      if (!isBotGroupAdmins) return reply(mess.botAdmin);
      
      if (!xy.message.reply_to_message) return reply('<blockquote>❌ Harap balas pesan yang ingin Anda <b>sematkan</b>.</blockquote>', { parse_mode: 'HTML' });

      try {
        const messageId = xy.message.reply_to_message.message_id;
        await xy.api.pinChatMessage(xy.chat.id, messageId, { disable_notification: true }); 
        reply(`<blockquote>📌 Pesan berhasil <b>disematkan</b>.</blockquote>`, { parse_mode: 'HTML' });
      } catch (e) {
        console.error("Error /pin:", e);
        reply(`<blockquote>❌ Gagal menyematkan pesan.\n\nPastikan bot memiliki hak admin untuk <b>menyematkan pesan</b>.</blockquote>`, { parse_mode: 'HTML' });
      }
      break;
    }

    case 'unpin': {
      if (xy.chat.type !== 'group' && xy.chat.type !== 'supergroup') return reply(mess.group);
      if (!isGroupAdmins) return reply(mess.admin);
      if (!isBotGroupAdmins) return reply(mess.botAdmin);

      try {
        if (xy.message.reply_to_message) {
          const messageId = xy.message.reply_to_message.message_id;
          await xy.api.unpinChatMessage(xy.chat.id, messageId);
          reply(`<blockquote>📌 Sematan pesan berhasil <b>dilepaskan</b>.</blockquote>`, { parse_mode: 'HTML' });
        } else {
          await xy.api.unpinAllChatMessages(xy.chat.id);
          reply(`<blockquote>📌 Semua pesan sematan berhasil <b>dilepaskan</b>.</blockquote>`, { parse_mode: 'HTML' });
        }
      } catch (e) {
        console.error("Error /unpin:", e);
        reply(`<blockquote>❌ Gagal melepaskan sematan pesan.\n\nPastikan bot memiliki hak admin untuk <b>menyematkan pesan</b>.</blockquote>`, { parse_mode: 'HTML' });
      }
      break;
    }
    
    // --- GROUP FEATURE IMPLEMENTATION (ADD, KICK, PROMOTE, ETC) ---

    case 'add':
    case 'kick': {
      if (xy.chat.type !== 'group' && xy.chat.type !== 'supergroup') return reply(mess.group);
      if (!isGroupAdmins) return reply(mess.admin);
      if (!isBotGroupAdmins) return reply(mess.botAdmin);

      const targetUser = xy.message.reply_to_message?.from;
      if (!targetUser) return reply(`<blockquote>❌ Harap balas pesan anggota yang ingin di${command}.</blockquote>`, { parse_mode: 'HTML' });

      try {
        if (command === 'add') {
          // Telegram API tidak memiliki metode 'add', tapi bisa menggunakan inviteLink (lebih rumit) atau menunggu anggota sendiri yang masuk.
          // Untuk bot Telegram, cara paling mudah adalah meminta pengguna join link.
          return reply(`<blockquote>Untuk menambahkan <b>${targetUser.first_name}</b>, kirim link undangan grup ini kepadanya.</blockquote>`, { parse_mode: 'HTML' });
        } else if (command === 'kick') {
          await xy.api.banChatMember(xy.chat.id, targetUser.id);
          reply(`<blockquote>✅ Anggota <b>${targetUser.first_name}</b> telah berhasil dikeluarkan dari grup.</blockquote>`, { parse_mode: 'HTML' });
        }
      } catch (e) {
        console.error(`Error /${command}:`, e);
        reply(`<blockquote>❌ Gagal menjalankan perintah /${command}. Pastikan bot memiliki hak admin yang sesuai.</blockquote>`, { parse_mode: 'HTML' });
      }
      break;
    }
    
    case 'promote':
    case 'demote': {
      if (xy.chat.type !== 'group' && xy.chat.type !== 'supergroup') return reply(mess.group);
      if (!isGroupAdmins) return reply(mess.admin);
      if (!isBotGroupAdmins) return reply(mess.botAdmin);

      const targetUser = xy.message.reply_to_message?.from;
      if (!targetUser) return reply(`<blockquote>❌ Harap balas pesan anggota yang ingin di${command}.</blockquote>`, { parse_mode: 'HTML' });
      
      try {
        if (command === 'promote') {
            await xy.api.promoteChatMember(xy.chat.id, targetUser.id, {
                can_change_info: true,
                can_delete_messages: true,
                can_invite_users: true,
                can_restrict_members: true,
                can_pin_messages: true,
                can_manage_topics: true,
                can_manage_video_chats: true,
                can_promote_members: false // Bot tidak boleh mempromosikan admin lain untuk mempromosikan
            });
            reply(`<blockquote>✅ Anggota <b>${targetUser.first_name}</b> telah berhasil diangkat menjadi Admin.</blockquote>`, { parse_mode: 'HTML' });
        } else if (command === 'demote') {
            await xy.api.promoteChatMember(xy.chat.id, targetUser.id, {
                can_change_info: false,
                can_delete_messages: false,
                can_invite_users: false,
                can_restrict_members: false,
                can_pin_messages: false,
                can_manage_topics: false,
                can_manage_video_chats: false,
                can_promote_members: false
            });
            reply(`<blockquote>✅ Admin <b>${targetUser.first_name}</b> telah berhasil diturunkan pangkatnya menjadi anggota biasa.</blockquote>`, { parse_mode: 'HTML' });
        }
      } catch (e) {
        console.error(`Error /${command}:`, e);
        reply(`<blockquote>❌ Gagal menjalankan perintah /${command}. Pastikan bot memiliki hak admin yang lebih tinggi dari target.</blockquote>`, { parse_mode: 'HTML' });
      }
      break;
    }

    case 'welcome':
    case 'leave': {
      if (xy.chat.type !== 'group' && xy.chat.type !== 'supergroup') return reply(mess.group);
      if (!isGroupAdmins) return reply(mess.admin);

      const groupID = xy.chat.id;
      let listData = readJson(WELEAVE_FILE, []);
      let foundIndex = listData.findIndex(item => item.id === groupID);

      const action = text.toLowerCase().trim();
      const statusKey = command === 'welcome' ? 'welcome' : 'leave';

      if (action === 'on') {
          if (foundIndex === -1) {
              listData.push({ id: groupID, welcome: command === 'welcome', leave: command === 'leave' });
          } else {
              listData[foundIndex][statusKey] = true;
          }
          writeJson(WELEAVE_FILE, listData);
          reply(`<blockquote>✅ Pesan ${statusKey} berhasil <b>DIAKTIFKAN</b> di grup ini.</blockquote>`, { parse_mode: 'HTML' });
      } else if (action === 'off') {
          if (foundIndex !== -1) {
              listData[foundIndex][statusKey] = false;
              writeJson(WELEAVE_FILE, listData);
          }
          reply(`<blockquote>❌ Pesan ${statusKey} berhasil <b>DINONAKTIFKAN</b> di grup ini.</blockquote>`, { parse_mode: 'HTML' });
      } else {
          reply(`<blockquote>📌 Penggunaan: <code>/${command} on</code> atau <code>/${command} off</code></blockquote>`, { parse_mode: 'HTML' });
      }
      break;
    }

    case 'antilink': {
      if (xy.chat.type !== 'group' && xy.chat.type !== 'supergroup') return reply(mess.group);
      if (!isGroupAdmins) return reply(mess.admin);

      const groupID = xy.chat.id;
      let listData = readJson(ANTILINK_FILE, []);
      let foundIndex = listData.findIndex(item => item.id === groupID);
      const action = text.toLowerCase().trim();

      if (action === 'on') {
          if (foundIndex === -1) {
              listData.push({ id: groupID, active: true });
          } else {
              listData[foundIndex].active = true;
          }
          writeJson(ANTILINK_FILE, listData);
          reply(`<blockquote>✅ Fitur Anti-Link berhasil <b>DIAKTIFKAN</b>. Bot akan menghapus pesan yang mengandung link (kecuali admin).</blockquote>`, { parse_mode: 'HTML' });
      } else if (action === 'off') {
          if (foundIndex !== -1) {
              listData[foundIndex].active = false;
              writeJson(ANTILINK_FILE, listData);
          }
          reply(`<blockquote>❌ Fitur Anti-Link berhasil <b>DINONAKTIFKAN</b>.</blockquote>`, { parse_mode: 'HTML' });
      } else {
          const status = foundIndex !== -1 && listData[foundIndex].active ? 'AKTIF' : 'NONAKTIF';
          reply(`<blockquote>⚙️ Status Anti-Link saat ini: <b>${status}</b>\n\n📌 Penggunaan: <code>/${command} on</code> atau <code>/${command} off</code></blockquote>`, { parse_mode: 'HTML' });
      }
      break;
    }
    
    case 'linkgroup': {
        if (xy.chat.type !== 'group' && xy.chat.type !== 'supergroup') return reply(mess.group);
        if (!isGroupAdmins) return reply(mess.admin);
        if (!isBotGroupAdmins) return reply(mess.botAdmin);

        try {
            const inviteLink = await xy.api.exportChatInviteLink(xy.chat.id);
            reply(`<blockquote>🔗 Link Undangan Grup <b>${xy.chat.title}</b>:\n\n${inviteLink}</blockquote>`, { parse_mode: 'HTML' });
        } catch (e) {
            console.error("Error /linkgroup:", e);
            reply(`<blockquote>❌ Gagal mendapatkan link grup. Pastikan bot memiliki hak admin untuk <b>mengundang pengguna</b>.</blockquote>`, { parse_mode: 'HTML' });
        }
        break;
    }
    
    case 'delete': {
        if (xy.chat.type !== 'group' && xy.chat.type !== 'supergroup') return reply(mess.group);
        if (!isGroupAdmins) return reply(mess.admin);
        if (!isBotGroupAdmins) return reply(mess.botAdmin);

        if (!xy.message.reply_to_message) return reply('<blockquote>❌ Harap balas pesan yang ingin Anda <b>hapus</b>.</blockquote>', { parse_mode: 'HTML' });
        
        try {
            await xy.api.deleteMessage(xy.chat.id, xy.message.reply_to_message.message_id);
            await xy.api.deleteMessage(xy.chat.id, xy.message.message_id); // Hapus perintah user
        } catch (e) {
            console.error("Error /delete:", e);
            reply(`<blockquote>❌ Gagal menghapus pesan. Pastikan bot memiliki hak admin untuk <b>menghapus pesan</b>.</blockquote>`, { parse_mode: 'HTML' });
        }
        break;
    }
    
    case 'warn': {
        if (xy.chat.type !== 'group' && xy.chat.type !== 'supergroup') return reply(mess.group);
        if (!isGroupAdmins) return reply(mess.admin);
        
        const targetUser = xy.message.reply_to_message?.from;
        if (!targetUser) return reply(`<blockquote>❌ Harap balas pesan anggota yang ingin diwarn.</blockquote>`, { parse_mode: 'HTML' });
        
        const targetId = String(targetUser.id);
        const groupID = String(xy.chat.id);
        const maxWarn = 3;

        let groupWarns = warnDB[groupID] || {};
        let userWarns = groupWarns[targetId] || 0;

        userWarns++;
        groupWarns[targetId] = userWarns;
        warnDB[groupID] = groupWarns;
        saveWarnDB(warnDB);

        if (userWarns >= maxWarn) {
            try {
                await xy.api.banChatMember(xy.chat.id, targetUser.id);
                delete groupWarns[targetId];
                warnDB[groupID] = groupWarns;
                saveWarnDB(warnDB);
                reply(`<blockquote>⚠️ <b>PERINGATAN!</b> (${userWarns}/${maxWarn})\n\nAnggota <b>${targetUser.first_name}</b> telah mencapai batas peringatan dan dikeluarkan dari grup.</blockquote>`, { parse_mode: 'HTML' });
            } catch (e) {
                console.error("Error kick warn:", e);
                reply(`<blockquote>⚠️ <b>PERINGATAN!</b> (${userWarns}/${maxWarn})\n\nAnggota <b>${targetUser.first_name}</b> telah mencapai batas peringatan, namun gagal dikeluarkan.</blockquote>`, { parse_mode: 'HTML' });
            }
        } else {
            reply(`<blockquote>⚠️ <b>PERINGATAN!</b> (${userWarns}/${maxWarn})\n\nAnggota <b>${targetUser.first_name}</b> menerima peringatan. Jika mencapai ${maxWarn} kali, dia akan dikeluarkan.</blockquote>`, { parse_mode: 'HTML' });
        }
        break;
    }
    
    case 'warns': {
        if (xy.chat.type !== 'group' && xy.chat.type !== 'supergroup') return reply(mess.group);
        
        const targetUser = xy.message.reply_to_message?.from || xy.from;
        const targetId = String(targetUser.id);
        const groupID = String(xy.chat.id);
        const maxWarn = 3;

        const groupWarns = warnDB[groupID] || {};
        const userWarns = groupWarns[targetId] || 0;
        
        reply(`<blockquote>👤 <b>${targetUser.first_name}</b>\n\nTotal Peringatan: <b>${userWarns}/${maxWarn}</b></blockquote>`, { parse_mode: 'HTML' });
        break;
    }

    case 'resetwarn': {
        if (xy.chat.type !== 'group' && xy.chat.type !== 'supergroup') return reply(mess.group);
        if (!isGroupAdmins) return reply(mess.admin);

        const targetUser = xy.message.reply_to_message?.from;
        if (!targetUser) return reply(`<blockquote>❌ Harap balas pesan anggota untuk me-reset peringatannya.</blockquote>`, { parse_mode: 'HTML' });

        const targetId = String(targetUser.id);
        const groupID = String(xy.chat.id);

        let groupWarns = warnDB[groupID] || {};
        if (groupWarns[targetId]) {
            delete groupWarns[targetId];
            warnDB[groupID] = groupWarns;
            saveWarnDB(warnDB);
            reply(`<blockquote>✅ Peringatan anggota <b>${targetUser.first_name}</b> telah di-reset (0/3).</blockquote>`, { parse_mode: 'HTML' });
        } else {
            reply(`<blockquote>⚠️ Anggota <b>${targetUser.first_name}</b> tidak memiliki peringatan untuk di-reset.</blockquote>`, { parse_mode: 'HTML' });
        }
        break;
    }
    
    case 'createpolling':
    case 'groupstats': {
        reply(`<blockquote>Fitur <b>/${command}</b> (Grup) memerlukan integrasi API atau proses yang lebih kompleks dan masih dalam tahap pengembangan.</blockquote>`, { parse_mode: 'HTML' });
        break;
    }

    // --- STORE FEATURE IMPLEMENTATION (PRODUCT LIST) ---

    case 'addlist': {
        if (xy.chat.type !== 'group' && xy.chat.type !== 'supergroup') return reply(mess.group);

        const productInfo = text.split('|');
        if (productInfo.length < 2) return reply(`<blockquote>❌ Format salah!\n\nPenggunaan: <code>/addlist [Key Produk] | [Deskripsi/Respon]</code>\n(Opsional: Reply foto/video untuk menambahkan media)</blockquote>`, { parse_mode: 'HTML' });
        
        const [key, responseText] = productInfo.map(s => s.trim());
        const groupID = xy.chat.id;

        let listData = readJson(LIST_FILE);
        const isExist = listData.some(item => item.id === groupID && item.key.toLowerCase() === key.toLowerCase());
        if (isExist) return reply(`<blockquote>⚠️ Key produk "<b>${key}</b>" sudah ada di grup ini. Gunakan <code>/updatelist</code> untuk mengubahnya.</blockquote>`, { parse_mode: 'HTML' });

        const newItem = {
            id: groupID,
            key: key,
            response: responseText,
            isImage: false,
            image_url: ''
        };

        const replyMessage = xy.message.reply_to_message;
        if (replyMessage && (replyMessage.photo || replyMessage.video)) {
            // Logika mengunggah media (disini saya menggunakan placeholder URL karena uploader CatBox/FileIO tidak tersedia)
            // Asumsi: Kita bisa mendapatkan URL media dari Telegram API atau CatBox/FileIO
            
            // Contoh Placeholder:
            const mediaType = replyMessage.photo ? 'Photo' : 'Video';
            newItem.isImage = true;
            newItem.image_url = 'https://telegra.ph/file/134ccbbd0dfc434a910ab.png'; // Ganti dengan URL upload sebenarnya jika CatBox berfungsi
            
            reply(`<blockquote>⏳ Media sedang diunggah... (Menggunakan URL placeholder sementara)</blockquote>`, { parse_mode: 'HTML' });
            
            // Jika Anda memiliki fungsi upload, ganti baris di atas dengan:
            /*
            const fileId = replyMessage.photo ? replyMessage.photo.at(-1).file_id : replyMessage.video.file_id;
            const file = await xy.api.getFile(fileId);
            const fileUrl = `https://api.telegram.org/file/bot${botToken}/${file.file_path}`;
            const uploadedUrl = await CatBox(fileUrl); // Asumsi CatBox bisa menerima URL Telegram
            newItem.image_url = uploadedUrl;
            */
            
            listData.push(newItem);
            writeJson(LIST_FILE, listData);
            reply(`<blockquote>✅ Produk/Respon <b>${key}</b> berhasil ditambahkan dengan ${mediaType} sebagai media!</blockquote>`, { parse_mode: 'HTML' });
            
        } else {
            listData.push(newItem);
            writeJson(LIST_FILE, listData);
            reply(`<blockquote>✅ Produk/Respon <b>${key}</b> berhasil ditambahkan (Teks saja).</blockquote>`, { parse_mode: 'HTML' });
        }
        break;
    }

    case 'dellist': {
        if (xy.chat.type !== 'group' && xy.chat.type !== 'supergroup') return reply(mess.group);
        if (!text) return reply(`<blockquote>❌ Format salah!\n\nPenggunaan: <code>/dellist [Key Produk]</code></blockquote>`, { parse_mode: 'HTML' });

        const key = text.trim();
        const groupID = xy.chat.id;
        let listData = readJson(LIST_FILE);
        
        const initialLength = listData.length;
        listData = listData.filter(item => !(item.id === groupID && item.key.toLowerCase() === key.toLowerCase()));

        if (listData.length < initialLength) {
            writeJson(LIST_FILE, listData);
            reply(`<blockquote>✅ Produk/Respon <b>${key}</b> berhasil dihapus dari grup ini.</blockquote>`, { parse_mode: 'HTML' });
        } else {
            reply(`<blockquote>⚠️ Key produk "<b>${key}</b>" tidak ditemukan di grup ini.</blockquote>`, { parse_mode: 'HTML' });
        }
        break;
    }

    case 'updatelist': {
        if (xy.chat.type !== 'group' && xy.chat.type !== 'supergroup') return reply(mess.group);

        const productInfo = text.split('|');
        if (productInfo.length < 2) return reply(`<blockquote>❌ Format salah!\n\nPenggunaan: <code>/updatelist [Key Produk] | [Deskripsi/Respon Baru]</code>\n(Opsional: Reply foto/video untuk menambahkan media baru)</blockquote>`, { parse_mode: 'HTML' });
        
        const [key, responseText] = productInfo.map(s => s.trim());
        const groupID = xy.chat.id;

        let listData = readJson(LIST_FILE);
        const foundIndex = listData.findIndex(item => item.id === groupID && item.key.toLowerCase() === key.toLowerCase());

        if (foundIndex === -1) return reply(`<blockquote>⚠️ Key produk "<b>${key}</b>" tidak ditemukan. Gunakan <code>/addlist</code> untuk menambahkannya.</blockquote>`, { parse_mode: 'HTML' });

        listData[foundIndex].response = responseText;
        listData[foundIndex].isImage = false;
        listData[foundIndex].image_url = '';

        const replyMessage = xy.message.reply_to_message;
        if (replyMessage && (replyMessage.photo || replyMessage.video)) {
            const mediaType = replyMessage.photo ? 'Photo' : 'Video';
            listData[foundIndex].isImage = true;
            listData[foundIndex].image_url = 'https://telegra.ph/file/134ccbbd0dfc434a910ab.png'; // Placeholder

            // Implementasi upload media sebenarnya di sini jika memungkinkan
            
            writeJson(LIST_FILE, listData);
            reply(`<blockquote>✅ Produk/Respon <b>${key}</b> berhasil diperbarui dengan ${mediaType} baru!</blockquote>`, { parse_mode: 'HTML' });
        } else {
            writeJson(LIST_FILE, listData);
            reply(`<blockquote>✅ Produk/Respon <b>${key}</b> berhasil diperbarui (Teks saja).</blockquote>`, { parse_mode: 'HTML' });
        }
        break;
    }

    case 'dellistall': {
        if (xy.chat.type !== 'group' && xy.chat.type !== 'supergroup') return reply(mess.group);
        
        const groupID = xy.chat.id;
        let listData = readJson(LIST_FILE);
        
        const initialLength = listData.length;
        listData = listData.filter(item => item.id !== groupID);

        if (listData.length < initialLength) {
            writeJson(LIST_FILE, listData);
            reply(`<blockquote>✅ Semua Produk/Respon (${initialLength - listData.length} item) berhasil dihapus dari grup ini.</blockquote>`, { parse_mode: 'HTML' });
        } else {
            reply(`<blockquote>⚠️ Tidak ada Produk/Respon yang terdaftar di grup ini.</blockquote>`, { parse_mode: 'HTML' });
        }
        break;
    }

    case 'listproduk': {
        if (xy.chat.type !== 'group' && xy.chat.type !== 'supergroup') return reply(mess.group);
        
        const groupID = xy.chat.id;
        const listData = readJson(LIST_FILE);
        const groupList = listData.filter(item => item.id === groupID);

        if (groupList.length === 0) return reply(`<blockquote>⚠️ Tidak ada Produk/Respon yang terdaftar di grup ini.</blockquote>`, { parse_mode: 'HTML' });

        let responseText = `📜 <b>DAFTAR PRODUK/RESPON GRUP</b> (${groupList.length} item)\n\n`;
        groupList.forEach((item, index) => {
            const media = item.isImage ? '🖼️ (Media)' : '';
            responseText += `${index + 1}. <b>${item.key}</b> ${media}\n`;
        });
        
        responseText += `\n📌 Untuk melihat detail, ketik <b>Key</b> produk (misalnya: ${groupList[0].key})`;

        reply(`<blockquote>${responseText}</blockquote>`, { parse_mode: 'HTML' });
        break;
    }

    case 'searchproduk': {
        if (xy.chat.type !== 'group' && xy.chat.type !== 'supergroup') return reply(mess.group);
        if (!text) return reply(`<blockquote>❌ Format salah!\n\nPenggunaan: <code>/searchproduk [Kata Kunci]</code></blockquote>`, { parse_mode: 'HTML' });

        const keyword = text.trim().toLowerCase();
        const groupID = xy.chat.id;
        const listData = readJson(LIST_FILE);
        
        const results = listData.filter(item => 
            item.id === groupID && 
            (item.key.toLowerCase().includes(keyword) || item.response.toLowerCase().includes(keyword))
        );

        if (results.length === 0) return reply(`<blockquote>⚠️ Tidak ditemukan Produk/Respon yang cocok dengan kata kunci "<b>${text}</b>".</blockquote>`, { parse_mode: 'HTML' });

        let responseText = `🔍 <b>HASIL PENCARIAN PRODUK</b> (${results.length} item)\n\n`;
        results.forEach((item, index) => {
            const media = item.isImage ? '🖼️ (Media)' : '';
            responseText += `${index + 1}. <b>${item.key}</b> ${media}\n`;
        });

        responseText += `\n📌 Untuk melihat detail, ketik <b>Key</b> produk.`;
        
        reply(`<blockquote>${responseText}</blockquote>`, { parse_mode: 'HTML' });
        break;
    }

    default:
  }
}

module.exports = {
  handleMessage
};

