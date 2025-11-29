require('./config/settings')
require('./src/lib/menu')
const fs = require('fs');
const path = require('path');
const {
  Bot,
  Markup,
  InlineKeyboard,
  InputFile
} = require("grammy");
const ora = require('ora');
const axios = require('axios');
const readlineSync = require('readline-sync');
const {
  handleMessage
} = require("./config/xy");
const connectwa = require("./src/lib/connectwa");
const {
  setBotInstance,
  restoreWhatsAppSessions
} = require('./src/lib/connectwa');

const tokenPath = path.join(__dirname, './src/database/token.json');
const warnFile = path.join(__dirname, "./src/database/warns.json");
const partnerFile = path.join(__dirname, "./src/database/partner.json");
const resellerFile = path.join(__dirname, "./src/database/reseller.json");
const sellerFile = path.join(__dirname, "./src/database/seller.json");
const ownerFile = path.join(__dirname, "./owner.json");
const userFile = path.join(__dirname, "./src/database/user.json");

function ensureDatabaseFiles() {
  const files = [{
    path: partnerFile,
    defaultContent: "[]"
  }, {
    path: resellerFile,
    defaultContent: "[]"
  }, {
    path: sellerFile,
    defaultContent: "[]"
  }, {
    path: ownerFile,
    defaultContent: "[]"
  }, {
    path: userFile,
    defaultContent: "[]"
  }, {
    path: warnFile,
    defaultContent: "{}"
  }, {
    path: './src/database/list.json',
    defaultContent: "[]"
  }, {
    path: './src/database/weleave.json',
    defaultContent: "[]"
  }, {
    path: './src/database/antilink.json',
    defaultContent: "[]"
  }];

  for (const file of files) {
    if (!fs.existsSync(file.path)) {
      try {
        fs.writeFileSync(file.path, file.defaultContent, 'utf8');
      } catch (e) {
        console.error(`Gagal membuat file ${file.path}:`, e);
      }
    }
  }
}

ensureDatabaseFiles();


global.mess = {
    owner: "❌ Hanya Owner yang bisa menggunakan perintah ini!",
    seller: "❌ Hanya Owner/Partner/Reseller yang bisa menggunakan perintah ini!",
    group: "❌ Perintah ini hanya bisa digunakan di dalam grup!",
    admin: "❌ Hanya Admin Grup yang bisa menggunakan perintah ini!",
    botAdmin: "❌ Jadikan bot sebagai Admin agar dapat menjalankan perintah ini!",
};



function getUserStatus(userId) {
  const userIdStr = String(userId);
  const ownerList = JSON.parse(fs.readFileSync(ownerFile));
  const sellerList = JSON.parse(fs.readFileSync(sellerFile));
  const partnerList = JSON.parse(fs.readFileSync(partnerFile));
  const resellerList = JSON.parse(fs.readFileSync(resellerFile));

  if (ownerList.includes(userIdStr)) return "owner";
  if (sellerList.some(seller => String(seller.id) === userIdStr)) return "seller";
  if (Array.isArray(partnerList) && partnerList.some(partner => String(partner.id) === userIdStr)) return "partner";
  if (Array.isArray(resellerList) && resellerList.some(reseller => String(reseller.id) === userIdStr)) return "reseller";

  return "user";
}

global.startTime = Date.now();

function formatDuration(ms) {
  const s = Math.floor(ms / 1000) % 60;
  const m = Math.floor(ms / (1000 * 60)) % 60;
  const h = Math.floor(ms / (1000 * 60 * 60)) % 24;
  const d = Math.floor(ms / (1000 * 60 * 60 * 24));

  return `${d} hari ${h} jam ${m} menit ${s} detik`;
}

function readWarnDB() {
  try {
    if (fs.existsSync(warnFile)) {
      return JSON.parse(fs.readFileSync(warnFile, "utf8"));
    }
    return {};
  } catch (error) {
    console.error("❌ Error membaca warnDB:", error);
    return {};
  }
}

function saveWarnDB(data) {
  try {
    fs.writeFileSync(warnFile, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error("❌ Error menyimpan warnDB:", error);
  }
}

let warnDB = readWarnDB();
let pendingWarns = new Map();

const sleep = async (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function askToken() {
  console.log('🔑 Masukkan Token Bot Telegram:');
  return readlineSync.question('> ').trim();
}

// GANTI FUNGSI getToken() DI INDEX.JS MENJADI SEPERTI INI:

function getToken() {
  // 1. Cek settings.js (Prioritas Utama)
  if (global.botToken && global.botToken.trim() !== '') {
      return global.botToken;
  }

  // 2. Cek database token.json (Backup)
  if (fs.existsSync(tokenPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(tokenPath, 'utf-8'));
      if (data.token && data.token.trim() !== '') {
        return data.token.trim();
      }
    } catch (err) {
      console.log('⚠️ Gagal membaca token.json');
    }
  }

  // 3. Jika kosong semua, baru tanya (tapi harusnya gak bakal sampai sini kalau settings.js benar)
  console.log('⚠️ Token tidak ditemukan di settings.js maupun database!');
  return readlineSync.question('🔑 Masukkan Token Bot Telegram: ').trim();
}

const botToken = getToken();
const bot = new Bot(botToken);


function loadUsers() {
  if (!fs.existsSync(userFile)) return [];
  return JSON.parse(fs.readFileSync(userFile, "utf8"));
}

function saveUsers(users) {
  fs.writeFileSync(userFile, JSON.stringify(users, null, 2));
}

setBotInstance(bot);
const START_MENU_PHOTO_URL = 'https://files.catbox.moe/cn6poe.jpg';

bot.command("start", async (xy) => {
  const userId = xy.from.id;
  const users = new Set(loadUsers());
  users.add(userId);
  saveUsers([...users]);

    const keyboard = {
      inline_keyboard: [
        [
          { text: "ʙᴜʏ ꜱᴄʀɪᴘᴛ", url: "https://t.me/sipicung" },
          { text: "ᴅᴇᴠᴇʟᴏᴘᴇʀ", url: "https://t.me/sipicung" }
        ],
        [{ text: "ʙᴜᴋᴀ ᴍᴇɴᴜ", callback_data: "mainmenu" }]
      ]
    };

  
  await xy.api.sendPhoto(xy.chat.id, START_MENU_PHOTO_URL, {
    caption: caption,
    parse_mode: 'HTML',
    reply_markup: keyboard
  });
});


function getMainMenuKeyboard() {
  return new InlineKeyboard()
    .text("ꜱᴘᴇᴄɪᴀʟ ᴍᴇɴᴜ", "specialmenu").text("ʀᴇꜱᴇʟʟᴇʀ ᴘᴀɴᴇʟ", "resellerpanel").row() 
    .text("ᴘᴀʀᴛɴᴇʀ ᴘᴀɴᴇʟ", "partnerpanel").text("ꜱᴛᴏʀᴇ ᴍᴇɴᴜ", "storemenu").row() 
    .text("ᴛᴏᴏʟꜱ ᴍᴇɴᴜ", "toolsmenu").text(" ᴅᴏᴡɴʟᴏᴀᴅᴇʀ ᴍᴇɴᴜ", "downloadermenu").row()
    .text("ɪɴꜱᴛᴀʟʟ ᴘᴀɴᴇʟ", "installermenu").text("ɢʀᴏᴜᴘ ᴍᴇɴᴜ", "groupmenu").row()
    .text("ᴏᴡɴᴇʀ ᴍᴇɴᴜ", "ownermenu");
}



function getOwnerMenuKeyboard() {
  return new InlineKeyboard()
    .text("ᴀᴅᴅ ᴍᴇɴᴜ", "ownermenu_add").text("ᴅᴇʟᴇᴛᴇ ᴍᴇɴᴜ", "ownermenu_delete").row()
    .text("ꜱᴇᴛᴛɪɴɢ ꜱᴇʀᴠᴇʀ", "ownermenu_setserver").text("ʟɪꜱᴛ & ꜱᴛᴀᴛᴜꜱ", "ownermenu_list").row()
    .text("ᴘᴀɴᴇʟ ᴛᴏᴏʟꜱ", "ownermenu_panelmgmt").text("ᴡᴀ ᴄᴏɴɴᴇᴄᴛ", "ownermenu_wa").row()
    .text("<<<", "mainmenu");
}


function getOwnerMenu_ListKeyboard() {
  return new InlineKeyboard()
    .text("ʟɪꜱᴛ ᴏᴡɴᴇʀ", "cmd_listowner").text("ʟɪꜱᴛ ꜱᴇʟʟᴇʀ", "cmd_listseller").row()
    .text("ʟɪꜱᴛ ᴘᴀʀᴛɴᴇʀ", "cmd_listpt").text("ʟɪꜱᴛ ʀᴇꜱᴇʟʟᴇʀ", "cmd_listrt").row()
    .text("ᴛᴏᴛᴀʟ ꜱᴇʀᴠᴇʀ ᴠ1", "cmd_totalserver").text("ᴛᴏᴛᴀʟ ꜱᴇʀᴠᴇʀ ᴠ2", "cmd_totalserverv2").row()
    .text("ᴛᴏᴛᴀʟ ꜱᴇʀᴠᴇʀ ᴠ3", "cmd_totalserverv3").text("ᴛᴏᴛᴀʟ ꜱᴇʀᴠᴇʀ ᴠ4", "cmd_totalserverv4").row()
    .text("ᴄᴇᴋ ɪᴅ ᴛᴇʟᴇ", "cmd_cekidtele").text("ᴄᴇᴋ ꜱᴇʀᴠᴇʀ", "cmd_cekserver").row()
    .text("<<<", "ownermenu");
}



function getPartnerPanelKeyboard() {
  return new InlineKeyboard()
    .text("ꜱᴇʀᴠᴇʀ ᴠ1", "partnerpanel_v1").text("ꜱᴇʀᴠᴇʀ ᴠ2", "partnerpanel_v2").text("ꜱᴇʀᴠᴇʀ ᴠ3", "partnerpanel_v3").row()
    .text("ꜱᴇʀᴠᴇʀ ᴠ4", "partnerpanel_v4").row() 
    .text("<<<", "mainmenu");
}


function getResellerPanelKeyboard() {
  return new InlineKeyboard()
    .text("ꜱᴇʀᴠᴇʀ ᴠ1", "resellerpanel_v1").text("ꜱᴇʀᴠᴇʀ ᴠ2", "resellerpanel_v2").text("ꜱᴇʀᴠᴇʀ ᴠ3", "resellerpanel_v3").row()
    .text("ꜱᴇʀᴠᴇʀ ᴠ4", "resellerpanel_v4").row()
    .text("<<<", "mainmenu");
}

async function sendMainMenu(ctx) {
  const uptime = formatDuration(Date.now() - global.startTime);


     const info = `
<b>🤖 INFO BOT</b>

• Nama Bot: ${namabot}
• Status Kamu: ${getUserStatus(ctx.from.id)}
• ID Kamu: ${ctx.from.id}
• Username: @${ctx.from.username || "-"}
• Versi Bot: 3.1.0
• Aktif Sejak: ${uptime}
• Dibuat Oleh: <a href="tg://user?id=8127540523">Picung X Cpanel</a>

<b>🔘 Silakan pilih menu:</b>
`;

  const finalCaption = `<blockquote>${info}</blockquote>`;

  try {
    if (ctx.update.callback_query && ctx.callbackQuery.message.photo) {
      try {
        await ctx.api.deleteMessage(ctx.chat.id, ctx.callbackQuery.message.message_id);
      } catch (e) {
        console.error("❌ Gagal menghapus pesan menu lama:", e.message);
      }
      

      await ctx.reply(finalCaption, {
        parse_mode: "HTML",
        reply_markup: getMainMenuKeyboard(),
      });
      
    } else if (ctx.update.message) {
        await ctx.reply(finalCaption, {
            parse_mode: "HTML",
            reply_markup: getMainMenuKeyboard(),
        });
    } else if (ctx.update.callback_query) {
        await ctx.editMessageText(finalCaption, {
            parse_mode: "HTML",
            reply_markup: getMainMenuKeyboard(),
        });
    }

  } catch (error) {
    console.error("❌ Gagal kirim menu utama:", error);
    if (ctx.update.callback_query && ctx.callbackQuery.message.text) {
       await ctx.editMessageText(finalCaption, {
          parse_mode: "HTML",
          reply_markup: getMainMenuKeyboard(),
        });
    }
  }
}

const menus = {
  specialmenu: specialmenu,
  toolsmenu: toolsmenu,
  downloadermenu: downloadermenu,
  storemenu: storemenu,
  installermenu: installermenu,
  groupmenu: groupmenu,
};

bot.command("menu", sendMainMenu);
for (const key in menus) {
  bot.callbackQuery(key, async (ctx) => {
    try {
      await ctx.answerCallbackQuery();
      await ctx.editMessageText(menus[key], {
          parse_mode: "HTML",
          reply_markup: new InlineKeyboard().text("⬅️ Kembali", "mainmenu"),
      });
      
    } catch (error) {
      console.error(`❌ Gagal buka menu ${key} (Edit Text):`, error);
      await ctx.editMessageText(menus[key], {
            parse_mode: "HTML",
            reply_markup: new InlineKeyboard().text("⬅️ Kembali", "mainmenu"),
          });
    }
  });
}

const checkIsOwner = (userId) => {
    const owners = JSON.parse(fs.readFileSync(ownerFile, 'utf8'));
    return owners.includes(String(userId));
};

bot.callbackQuery("ownermenu", async (ctx) => {
  const userId = ctx.from.id;
  
  if (!checkIsOwner(userId)) {
     return ctx.answerCallbackQuery({
       text: "❌ Maaf, Anda bukan Owner.",
       show_alert: true,
     });
  }
  await ctx.answerCallbackQuery();
  
  const info = `
<blockquote><b>📌 OWNER MENU</b>

Silakan pilih kategori perintah yang ingin Anda gunakan:
</blockquote>`;
  try {
    await ctx.editMessageText(info, {
      parse_mode: "HTML",
      reply_markup: getOwnerMenuKeyboard(),
    });
  } catch (error) {
    
    console.error(`❌ Gagal buka Owner Menu (Edit Text):`, error);
    await ctx.reply(info, {
      parse_mode: "HTML",
      reply_markup: getOwnerMenuKeyboard(),
    });
  }
});


bot.callbackQuery("ownermenu_add", async (ctx) => {
    if (!checkIsOwner(ctx.from.id)) return ctx.answerCallbackQuery({ text: "❌ Maaf, Anda bukan Owner.", show_alert: true });
    await ctx.answerCallbackQuery();
    
    await ctx.editMessageText(global.ownermenu_add_text, {
        parse_mode: "HTML",
        reply_markup: new InlineKeyboard().text("⬅️ Kembali ke Owner Menu", "ownermenu"),
    });
});

bot.callbackQuery("ownermenu_delete", async (ctx) => {
    if (!checkIsOwner(ctx.from.id)) return ctx.answerCallbackQuery({ text: "❌ Maaf, Anda bukan Owner.", show_alert: true });
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(global.ownermenu_delete_text, {
        parse_mode: "HTML",
        reply_markup: new InlineKeyboard().text("⬅️ Kembali ke Owner Menu", "ownermenu"),
    });
});

bot.callbackQuery("ownermenu_setserver", async (ctx) => {
    if (!checkIsOwner(ctx.from.id)) return ctx.answerCallbackQuery({ text: "❌ Maaf, Anda bukan Owner.", show_alert: true });
    await ctx.answerCallbackQuery();
    
    await ctx.editMessageText(global.ownermenu_setserver_text, {
        parse_mode: "HTML",
        reply_markup: new InlineKeyboard().text("⬅️ Kembali ke Owner Menu", "ownermenu"),
    });
});

bot.callbackQuery("ownermenu_panelmgmt", async (ctx) => {
    if (!checkIsOwner(ctx.from.id)) return ctx.answerCallbackQuery({ text: "❌ Maaf, Anda bukan Owner.", show_alert: true });
    await ctx.answerCallbackQuery();
    
    await ctx.editMessageText(global.ownermenu_panelmgmt_text, {
        parse_mode: "HTML",
        reply_markup: new InlineKeyboard().text("⬅️ Kembali ke Owner Menu", "ownermenu"),
    });
});

bot.callbackQuery("ownermenu_wa", async (ctx) => {
    if (!checkIsOwner(ctx.from.id)) return ctx.answerCallbackQuery({ text: "❌ Maaf, Anda bukan Owner.", show_alert: true });
    await ctx.answerCallbackQuery();
    
    await ctx.editMessageText(global.ownermenu_wa_text, {
        parse_mode: "HTML",
        reply_markup: new InlineKeyboard().text("⬅️ Kembali ke Owner Menu", "ownermenu"),
    });
});


bot.callbackQuery("ownermenu_list", async (ctx) => {
    if (!checkIsOwner(ctx.from.id)) return ctx.answerCallbackQuery({ text: "❌ Maaf, Anda bukan Owner.", show_alert: true });
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(`<blockquote><b>📋 LIST & STATUS MENU</b>\n\nKlik tombol di bawah untuk melihat daftar atau status.</blockquote>`, {
        parse_mode: "HTML",
        reply_markup: getOwnerMenu_ListKeyboard(),
    });
});



bot.callbackQuery("mainmenu", async (ctx) => {

  await sendMainMenu(ctx);
});


bot.callbackQuery("partnerpanel", async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.editMessageText("<blockquote><b>🤝 Partner Panel</b>\n\nSilakan pilih server yang ingin Anda kelola:</blockquote>", {
    parse_mode: "HTML",
    reply_markup: getPartnerPanelKeyboard(),
  });
});

bot.callbackQuery("resellerpanel", async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.editMessageText("<blockquote><b>🛒 Reseller Panel</b>\n\nSilakan pilih server yang ingin Anda kelola:</blockquote>", {
    parse_mode: "HTML",
    reply_markup: getResellerPanelKeyboard(),
  });
});


bot.callbackQuery("partnerpanel_v1", async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.editMessageText(partnerpanel, {
    parse_mode: "HTML",
    reply_markup: new InlineKeyboard().text("⬅️ Kembali", "partnerpanel"),
  });
});
bot.callbackQuery("partnerpanel_v2", async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.editMessageText(partnerpanelV2, {
    parse_mode: "HTML",
    reply_markup: new InlineKeyboard().text("⬅️ Kembali", "partnerpanel"),
  });
});
bot.callbackQuery("partnerpanel_v3", async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.editMessageText(partnerpanelV3, {
    parse_mode: "HTML",
    reply_markup: new InlineKeyboard().text("⬅️ Kembali", "partnerpanel"),
  });
});
bot.callbackQuery("partnerpanel_v4", async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.editMessageText(partnerpanelV4, {
    parse_mode: "HTML",
    reply_markup: new InlineKeyboard().text("⬅️ Kembali", "partnerpanel"),
  });
});
bot.callbackQuery("resellerpanel_v1", async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.editMessageText(resellerpanel, {
    parse_mode: "HTML",
    reply_markup: new InlineKeyboard().text("⬅️ Kembali", "resellerpanel"),
  });
});
bot.callbackQuery("resellerpanel_v2", async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.editMessageText(resellerpanelV2, {
    parse_mode: "HTML",
    reply_markup: new InlineKeyboard().text("⬅️ Kembali", "resellerpanel"),
  });
});
bot.callbackQuery("resellerpanel_v3", async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.editMessageText(resellerpanelV3, {
    parse_mode: "HTML",
    reply_markup: new InlineKeyboard().text("⬅️ Kembali", "resellerpanel"),
  });
});
bot.callbackQuery("resellerpanel_v4", async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.editMessageText(resellerpanelV4, {
    parse_mode: "HTML",
    reply_markup: new InlineKeyboard().text("⬅️ Kembali", "resellerpanel"),
  });
});

bot.on("callback_query:data", async (ctx) => {
  const data = ctx.callbackQuery.data;
  const userId = ctx.from.id;
  

  if (data.startsWith("cmd_")) {
      await ctx.answerCallbackQuery(`Memproses perintah: ${data.slice(4)}...`);
      
      const command = data.slice(4); 
      
      const message = ctx.callbackQuery.message;
      const from = ctx.callbackQuery.from;
      const chat = ctx.callbackQuery.message.chat;

      const owners = JSON.parse(fs.readFileSync(ownerFile, 'utf8'));
      const isOwner = owners.includes(String(from.id));
      const seller = JSON.parse(fs.readFileSync(sellerFile));
      const partner = JSON.parse(fs.readFileSync(partnerFile));
      const reseller = JSON.parse(fs.readFileSync(resellerFile));
      const isSeller = seller.some(s => String(s.id) === String(from.id));
      const isPartner = partner.some(p => String(p.id) === String(from.id));
      const isReseller = reseller.some(r => String(r.id) === String(from.id));
      
      const isGroupAdmins = false; 
      const isBotGroupAdmins = false; 

      const xy = {
          message, from, chat,

          reply: (text, extra) => ctx.reply(text, extra), 
          api: ctx.api, me: ctx.me
      };
      
      const q = ''; 
      const text = ''; 
      const sender = userId;
      const db_respon_list = JSON.parse(fs.readFileSync('./src/database/list.json'));
      const { CatBox, InputFile } = require('./src/lib/uploader');
      function generateReadableString(length) {
          const words = ["sky", "cloud", "wind", "fire", "storm", "light", "wave", "stone", "shadow", "earth"];
          const randomWord = words[Math.floor(Math.random() * words.length)];
          const randomNumber = Math.floor(100 + Math.random() * 900);
          return randomWord + randomNumber;
      }
      const mess = global.mess;
      const paket = global.paket;
      
      await handleMessage(xy, command, sleep, isOwner, isSeller, isPartner, isReseller, xy.reply, owners, seller, sellerFile, q, text, InlineKeyboard, paket, isGroupAdmins, mess, warnDB, saveWarnDB, pendingWarns, InputFile, botToken, CatBox, sender, db_respon_list, generateReadableString, isBotGroupAdmins);
      return;
  }
  

  if (data.startsWith("listsrv") || data.startsWith("listadmin") || data.startsWith("listusr")) {
    await ctx.answerCallbackQuery();

    const parts = data.split(" ");
    const command = parts[0];
    const page = parts[1];
    
    const message = ctx.callbackQuery.message;
    const from = ctx.callbackQuery.from;
    const chat = ctx.callbackQuery.message.chat;

    const owners = JSON.parse(fs.readFileSync(ownerFile, 'utf8'));
    const isOwner = owners.includes(String(from.id));
    const seller = JSON.parse(fs.readFileSync(sellerFile));
    const partner = JSON.parse(fs.readFileSync(partnerFile));
    const reseller = JSON.parse(fs.readFileSync(resellerFile));
    const isSeller = seller.some(s => String(s.id) === String(from.id));
    const isPartner = partner.some(p => String(p.id) === String(from.id));
    const isReseller = reseller.some(r => String(r.id) === String(from.id));
    

    const xy = {
      message,
      from,
      chat,

      reply: (text, extra) => ctx.editMessageText(text, extra),
      api: ctx.api,
      me: ctx.me
    };


    const q = xy.message.text || '';
    const text = page;
    const isGroupAdmins = false;
    const isBotGroupAdmins = false; 
    const sender = userId;
    const db_respon_list = JSON.parse(fs.readFileSync('./src/database/list.json'));
    const { CatBox, InputFile } = require('./src/lib/uploader');
    function generateReadableString(length) {
      const words = ["sky", "cloud", "wind", "fire", "storm", "light", "wave", "stone", "shadow", "earth"];
      const randomWord = words[Math.floor(Math.random() * words.length)];
      const randomNumber = Math.floor(100 + Math.random() * 900);
      return randomWord + randomNumber;
    }
    const mess = global.mess;
    const paket = global.paket;
    await handleMessage(xy, command, sleep, isOwner, isSeller, isPartner, isReseller, xy.reply, owners, seller, sellerFile, q, text, InlineKeyboard, paket, isGroupAdmins, mess, warnDB, saveWarnDB, pendingWarns, InputFile, botToken, CatBox, sender, db_respon_list, generateReadableString, isBotGroupAdmins);
    
  }
  
  if (data.startsWith("cancel_warn_")) {
    try {
      const admins = await ctx.getChatAdministrators();
      const isAdmin = admins.some((admin) => admin.user.id === userId);
      if (!isAdmin) {
        return ctx.answerCallbackQuery({
          text: "❌ Hanya admin yang bisa membatalkan peringatan.",
          show_alert: true,
        });
      }
    } catch (e) {
      console.error("Gagal cek admin:", e);
      return ctx.answerCallbackQuery({
        text: "❌ Terjadi kesalahan saat memverifikasi admin.",
        show_alert: true,
      });
    }

    const warnedUserId = data.split("_")[2];
    if (!warnDB[warnedUserId] || warnDB[warnedUserId].length === 0) {
      return ctx.answerCallbackQuery({
        text: "⚠️ Tidak ada peringatan yang bisa dibatalkan.",
        show_alert: true,
      });
    }

    warnDB[warnedUserId].pop();
    saveWarnDB(warnDB);

    const warnCount = warnDB[warnedUserId].length;
    let updatedText = `<blockquote>⚠️ <b>Peringatan telah diperbarui!</b>\n📌 Total peringatan: ${warnCount}/3</blockquote>`;

    await ctx.editMessageText(updatedText, {
      parse_mode: 'HTML',
      reply_markup: warnCount > 0 ? {
        inline_keyboard: [
          [{
            text: "❌ Batalkan Peringatan",
            callback_data: `cancel_warn_${warnedUserId}`
          }]
        ]
      } : undefined
    });

    await ctx.answerCallbackQuery({
      text: "✅ Peringatan berhasil dibatalkan!",
      show_alert: true,
    });
  }
});

const spinner = ora({
  text: 'Menghubungkan bot...',
  spinner: 'bouncingBar'
}).start();

function animateWaitingText() {
  let dots = '';
  return setInterval(() => {
    dots = dots.length < 3 ? dots + '.' : '';
    process.stdout.write(`\r⌛ Menunggu pesan${dots} `);
  }, 500);
}

bot.api.getMe().then((me) => {
  console.clear();
  console.log("==================================");
  spinner.succeed("✅ Bot berhasil terhubung!");
  console.log(`🤖 Nama Bot  : ${me.first_name}`);
  console.log(`📛 Username  : @${me.username}`);
  console.log("▶️ Bot aktif dan siap menerima perintah");
  console.log("==================================");

  animateWaitingText();

  (async () => {
    await connectwa.restoreWhatsAppSessions();
    console.log("✅ Semua sesi berhasil direstore. Bot siap digunakan.");
  })();
  bot.start();
}).catch((err) => {
  console.error("❌ Gagal menghubungkan bot:", err.message);
  process.exit(1);
});

bot.on("message:new_chat_members", async (ctx) => {
  const groupID = ctx.chat.id;
  let listData = [];
  try {
    listData = JSON.parse(fs.readFileSync('./src/database/weleave.json', 'utf8'));
  } catch (e) {}

  const found = listData.find(item => item.id === groupID);
  if (!found || !found.welcome) return;

  for (const user of ctx.message.new_chat_members) {
    const name = user.first_name || "Pengguna";
    await ctx.reply(`<blockquote>👋 Selamat datang, <b>${name}</b>!</blockquote>`, {
      parse_mode: "HTML"
    });
  }
});

bot.on("message:left_chat_member", async (ctx) => {
  const groupID = ctx.chat.id;
  let listData = [];
  try {
    listData = JSON.parse(fs.readFileSync('./src/database/weleave.json', 'utf8'));
  } catch (e) {}

  const found = listData.find(item => item.id === groupID);
  if (!found || !found.leave) return;

  const name = ctx.message.left_chat_member?.first_name || "Pengguna";
  await ctx.reply(`<blockquote>👋 Selamat tinggal, <b>${name}</b>!</blockquote>`, {
    parse_mode: "HTML"
  });
});


bot.on("message", async (xy, next) => {
  const msg = xy.message

  process.stdout.clearLine(0);
  process.stdout.cursorTo(0);

  const user = xy.from;
  const nama = `${user.first_name || ''} ${user.last_name || ''}`.trim();
  const username = user.username ? `@${user.username}` : '(tanpa username)';
  const waktu = new Date().toLocaleTimeString();

  console.log(`⏰ ${waktu}`);
  console.log(`🆔 Id : ${user.id}`)
  console.log(`📩 Dari     : ${username} (${nama})`);
  console.log(`📝 Pesan    : ${msg.text}`);
  console.log("==================================");


  const seller = JSON.parse(fs.readFileSync('./src/database/seller.json'));
  const partner = JSON.parse(fs.readFileSync('./src/database/partner.json'));
  const reseller = JSON.parse(fs.readFileSync('./src/database/reseller.json')); 
  const sellerPath = './src/database/seller.json';
  const owners = JSON.parse(fs.readFileSync('./owner.json', 'utf8'));
  const db_respon_list = JSON.parse(fs.readFileSync('./src/database/list.json'));

  const isOwner = owners.includes(String(xy.from.id));

  const now = Date.now();

  const validSellers = seller.filter(item => item.expiresAt > now);

  const {
    CatBox,
    fileIO,
    pomfCDN
  } = require('./src/lib/uploader');

  if (validSellers.length !== seller.length) {
    fs.writeFileSync(sellerPath, JSON.stringify(validSellers, null, 2));
  }

  const isSeller = validSellers.some(item =>
    item.id === String(xy.from.id)
  );

  const isPartner = Array.isArray(partner) && partner.some(item =>
    item.id === String(item.id)
  );
  
  const isReseller = Array.isArray(reseller) && reseller.some(item =>
    item.id === String(item.id)
  );

  const isGroup = ['group', 'supergroup'].includes(xy.chat.type);

  const groupName = isGroup ? xy.chat.title : "";
  const groupId = isGroup ? xy.chat.id : "";

  let groupAdmins = [];
  let isGroupAdmins = false;
  let isBotGroupAdmins = false;

  if (isGroup) {
    try {
      const participants = await xy.getChatAdministrators();
      groupAdmins = participants.map(admin => admin.user.id);
      isGroupAdmins = groupAdmins.includes(xy.from.id);

      const botId = xy.me.id;
      isBotGroupAdmins = groupAdmins.includes(botId);
    } catch(e) {
        console.error("Error fetching group admins:", e.message);
    }
  }

  
  const reply = (teks, extra) => xy.reply(teks, extra);

  function generateReadableString(length) {
    const words = ["sky", "cloud", "wind", "fire", "storm", "light", "wave", "stone", "shadow", "earth"];
    const randomWord = words[Math.floor(Math.random() * words.length)];
    const randomNumber = Math.floor(100 + Math.random() * 900);
    return randomWord + randomNumber;
  }

  let body = msg.text ||
    msg.caption ||
    msg.document?.file_name ||
    msg.video?.file_name ||
    msg.audio?.file_name ||
    (msg.voice && '[Voice Message]') ||
    (msg.sticker && '[Sticker]') ||
    (msg.animation && '[GIF]') ||
    (msg.photo && '[Photo]') ||
    (msg.contact && '[Contact]') ||
    (msg.location && '[Location]') ||
    (msg.venue && '[Venue]') ||
    (msg.poll && '[Poll]') ||
    "";

  const prefix = global.prefix || "/"; 
  const command = body.startsWith(prefix) ?
    body.slice(prefix.length).trim().split(" ")[0].split("@")[0].toLowerCase() :
    "";
  const args = body.trim().split(/ +/).slice(1);
  const q = text = args.join(" ");

  const sender = xy.message.chat.id;

  if (body && xy.chat && xy.chat.type !== 'private') {
    let userInput = body.trim();
    let matchedProduct = db_respon_list.find(item =>
      item.id === xy.chat.id &&
      item.key.toLowerCase() === userInput.toLowerCase()
    );

    if (matchedProduct) {
      if (matchedProduct.isImage && matchedProduct.image_url) {
        const response = await axios.get(matchedProduct.image_url, {
          responseType: "arraybuffer"
        });
        const imagePath = `./temp.jpg`;

        fs.writeFileSync(imagePath, response.data);

        await xy.api.sendPhoto(xy.chat.id, new InputFile(imagePath), {
          caption: `<blockquote><b>${matchedProduct.key}</b>\n\n${matchedProduct.response}</blockquote>`,
          parse_mode: "HTML"
        });

        fs.unlinkSync(imagePath);
      } else {
        reply(`<blockquote><b>${matchedProduct.key}</b>\n\n${matchedProduct.response}</blockquote>`, {
          parse_mode: "HTML"
        });
      }
    }
  }

  if (!global.groupMembers) {
    global.groupMembers = {};
  }

  if (xy.message && xy.message.from && xy.message.chat && xy.message.chat.type !== 'private') {
    const chatId = xy.message.chat.id;
    const user = xy.message.from;
    try {
      if (!global.groupMembers[chatId]) {
        global.groupMembers[chatId] = [];
      }

      const existingMemberIndex = global.groupMembers[chatId].findIndex(
        member => member.id === user.id
      );

      if (existingMemberIndex === -1) {
        global.groupMembers[chatId].push({
          id: user.id,
          first_name: user.first_name || '',
          last_name: user.last_name || '',
          username: user.username || '',
          is_bot: user.is_bot || false,
          last_seen: new Date().toISOString()
        });
      } else {
        global.groupMembers[chatId][existingMemberIndex].last_seen = new Date().toISOString();
      }

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      global.groupMembers[chatId] = global.groupMembers[chatId].filter(member => {
        const lastSeen = new Date(member.last_seen);
        return lastSeen > thirtyDaysAgo;
      });
    } catch (error) {
      console.error("Error auto-collecting member:", error);
    }
  }
  await handleMessage(xy, command, sleep, isOwner, isSeller, isPartner, isReseller, reply, owners, seller, sellerPath, q, text, InlineKeyboard, paket, isGroupAdmins, global.mess, warnDB, saveWarnDB, pendingWarns, InputFile, botToken, CatBox, sender, db_respon_list, generateReadableString, isBotGroupAdmins);
});

