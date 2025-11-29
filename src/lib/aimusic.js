  /*
 • Fitur By Anomaki Team
 • Created : xyzan code
 • Generate Music Dari Idemu (scrape)
 • Jangan Hapus Wm
 • https://whatsapp.com/channel/0029Vaio4dYC1FuGr5kxfy2l
*/
const axios = require('axios');
async function genmusic(prompt) {
  const h = {
    'Content-Type': 'application/json',
    'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Mobile Safari/537.36',
    'Referer': 'https://suno.exomlapi.com/'
  };
  const datagen = {
    prompt: prompt,
    title: "",
    style: "",
    customMode: false,
    instrumental: false
  };
  try {
    const resGen = await axios.post(
      'https://suno.exomlapi.com/generate',
      datagen, {
        headers: h
      });
    if (resGen.data.status !==
      'initiated') {
      throw new Error(
        'gagal untuk membuatnya om');
    }
    const taskid = resGen.data.taskId;
    const token = resGen.data.token;
    async function checkstats() {
      const statusData = {
        taskId: taskid,
        token: token
      };
      const statsres = await axios
        .post(
          'https://suno.exomlapi.com/check-status',
          statusData, {
            headers: h
          });
      if (statsres.data.status ===
        'TEXT_SUCCESS') {
        return statsres.data
          .results;
      }
      if (statsres.data.status ===
        'error') {
        throw new Error(
          'membuatnya gagal');
      }
      await new Promise(resolve =>
        setTimeout(resolve, 3000));
      return checkstats();
    }
    return await checkstats();
  }
  catch (e) {
    throw new Error(`${e.message}`);
  }
}
module.exports = genmusic;
