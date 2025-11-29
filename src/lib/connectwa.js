const {
  default: makeWASocket,
  Browsers,
  jidDecode,
  DisconnectReason,
  makeInMemoryStore,
  useMultiFileAuthState,
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const fs = require("fs");

// Import bot dari file utama - pastikan ini Grammy bot instance
let bot;
try {
  bot = require('../../index'); // Sesuaikan path ke bot Grammy
} catch (e) {
  console.log("Bot import error:", e.message);
}

const sleep = async (ms) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

const SESSIONS_DIR = "./sessions";
const SESSIONS_FILE = "./sessions/active_sessions.json";
const sessions = new Map();

// *Membuat folder sesi jika belum ada*
function ensureSessionDir(number) {
  const dir = `${SESSIONS_DIR}/${number}`;
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// *Menyimpan daftar sesi aktif ke file*
function updateActiveSessions() {
  try {
    if (!fs.existsSync(SESSIONS_DIR)) {
      fs.mkdirSync(SESSIONS_DIR, { recursive: true });
    }
    const sessionsList = Array.from(sessions.keys());
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessionsList, null, 2));    
  } catch (error) {
    console.error("❌ Error updating sessions file:", error);
  }
}

async function restoreWhatsAppSessions() {
  try {
    if (!fs.existsSync(SESSIONS_FILE)) {
      fs.writeFileSync(SESSIONS_FILE, JSON.stringify([], null, 2));
      return;
    }

    const activeSessions = JSON.parse(fs.readFileSync(SESSIONS_FILE, "utf-8"));
      
    for (const number of activeSessions) {
      console.log(`🔄 Restoring session: ${number}`);
      try {
        await startWhatsAppSession(number);
        await sleep(5000); // Delay between connections
      } catch (error) {
        console.error(`❌ Failed to restore session ${number}:`, error.message);
      }
    }
  } catch (error) {
    console.error("❌ Error restoring sessions:", error);
  }
}

// *Fungsi utama untuk menghubungkan WhatsApp*
async function startWhatsAppSession(number, chatId, messageId = null) {
  return new Promise(async (resolve, reject) => {
    try {
      
      const sessionPath = ensureSessionDir(number);
      const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
      const usePairingCode = true;

      const waClient = makeWASocket({
        auth: state,
        printQRInTerminal: !usePairingCode,
        logger: pino({ level: "silent" }),
        browser: ["Ubuntu", "Chrome", "20.0.04"],
        markOnlineOnConnect: true,
        syncFullHistory: false,
        generateHighQualityLinkPreview: true,
      });

      // Update message jika ada chatId dan messageId
      if (chatId && messageId && bot) {
        try {
          await bot.api.editMessageText(chatId, messageId, `🔄 Menghubungkan ke WhatsApp: ${number}...`);
        } catch (e) {
          console.log("Info: Could not edit message");
        }
      }

      // Request pairing code jika belum registered
if (usePairingCode && !waClient.authState.creds.registered) {
  try {
    console.log(`📱 Requesting pairing code for ${number}...`);
    await sleep(3000);
    
    const code = await waClient.requestPairingCode(number);
    if (!code) throw new Error("Pairing code not received");

    const formattedCode = code.match(/.{1,4}/g)?.join("-") || code;
    
    console.log(`📲 Pairing code for ${number}: ${formattedCode}`);

    const messageText = `📲 Kode pairing untuk ${number}:\n\n\`${formattedCode}\`\n\nMasukkan kode ini di WhatsApp Anda:\n1. Buka WhatsApp\n2. Tap ⋮ > Perangkat Tertaut\n3. Tap "Tautkan Perangkat"\n4. Masukkan kode di atas`;

    if (chatId && bot) {
      try {
        if (messageId) {
          await bot.api.editMessageText(chatId, messageId, messageText, {
            parse_mode: "Markdown"
          });
        } else {
          await bot.api.sendMessage(chatId, messageText, {
            parse_mode: "Markdown"
          });
        }
      } catch (e) {
        console.log("⚠️ Gagal edit, kirim pesan baru...");
        await bot.api.sendMessage(chatId, messageText, {
          parse_mode: "Markdown"
        });
      }
    }
  } catch (error) {
    console.error("⚠️ Failed to get pairing code:", error);

    const errorMsg = `❌ Gagal mendapatkan pairing code untuk ${number}: ${error.message}`;
    if (chatId && bot) {
      try {
        if (messageId) {
          await bot.api.editMessageText(chatId, messageId, errorMsg);
        } else {
          await bot.api.sendMessage(chatId, errorMsg);
        }
      } catch (e) {
        console.log("⚠️ Gagal edit pesan error, kirim baru...");
        await bot.api.sendMessage(chatId, errorMsg);
      }
    }

    reject(error);
    return;
  }
}

      // Connection update handler
      waClient.ev.on("connection.update", async (update) => {
        try {
          const { connection, lastDisconnect, qr } = update;
          
          console.log(`📡 Connection update for ${number}: ${connection}`);

          if (connection === "open") {
            // Session berhasil terhubung
            sessions.set(number, waClient);
            updateActiveSessions();
            
            console.log(`✅ WhatsApp ${number} successfully connected!`);
            
            if (chatId && messageId && bot) {
              try {
                await bot.api.editMessageText(
                  chatId, 
                  messageId, 
                  `✅ WhatsApp ${number} berhasil terhubung!\n\n🔗 Status: Connected\n📱 Ready to send messages`
                );
              } catch (e) {
                console.log("Info: Could not edit success message");
              }
            }
            
            resolve(waClient);
            
          } else if (connection === "close") {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            
            console.log(`❌ Connection closed for ${number}. Status code: ${statusCode}`);
            
            if (shouldReconnect) {
              console.log(`♻️ Attempting to reconnect: ${number}...`);
              setTimeout(() => {
                startWhatsAppSession(number, chatId, messageId)
                  .then(resolve)
                  .catch(reject);
              }, 5000);
            } else {
              console.log(`❌ WhatsApp session ${number} logged out.`);
              sessions.delete(number);
              updateActiveSessions();
              
              if (chatId && bot) {
                try {
                  await bot.api.sendMessage(chatId, `❌ WhatsApp ${number} session terminated.`);
                } catch (e) {
                  console.log("Info: Could not send termination message");
                }
              }
              
              // Clean up session folder
              try {
                fs.rmSync(sessionPath, { recursive: true, force: true });
                console.log(`🗑️ Cleaned up session folder for ${number}`);
              } catch (e) {
                console.log(`⚠️ Could not clean session folder: ${e.message}`);
              }
              
              reject(new Error(`Session ${number} was logged out`));
            }
            
          } else if (connection === "connecting") {       
            if (chatId && messageId && bot) {
              try {
                await bot.api.editMessageText(
                  chatId, 
                  messageId, 
                  `🔄 Connecting to WhatsApp: ${number}...\n\n⏳ Please wait...`
                );
              } catch (e) {
                console.log("Info: Could not edit connecting message");
              }
            }
          }
          
        } catch (err) {
          console.error("❌ Unhandled connection update error:", err);
          reject(err);
        }
      });

      // Credentials update handler
      waClient.ev.on("creds.update", saveCreds);
      
      // Message handler (optional - untuk receive message) in 

    } catch (error) {
      console.error(`❌ Failed to start WhatsApp session ${number}:`, error);
      reject(error);
    }
  });
}

// Set bot instance (call this function from main file)
function setBotInstance(botInstance) {
  bot = botInstance;
  console.log("✅ Bot instance set for WhatsApp session manager");
}

module.exports = { 
  sessions, 
  startWhatsAppSession, 
  restoreWhatsAppSessions, 
  updateActiveSessions,
  setBotInstance 
};