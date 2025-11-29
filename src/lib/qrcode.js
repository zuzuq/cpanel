const qr = require('qrcode');
const fetch = require('node-fetch');
const FormData = require('form-data');

module.exports = async function toqrcode(stringqr) {
  return new Promise((resolve, reject) => {
    qr.toDataURL(stringqr, async (err, url) => {
      if (err) return reject(err);

      const base64Data = url.split(',')[1];
      const buffer = Buffer.from(base64Data, 'base64');

      const formData = new FormData();
      formData.append('fileToUpload', buffer, { filename: 'image.png' });
      formData.append('reqtype', 'fileupload');

      try {
        const response = await fetch('https://catbox.moe/user/api.php', {
          method: 'POST',
          body: formData
        });

        const result = await response.text();

        if (!result.startsWith('https://files.catbox.moe/')) {
          reject('Gagal upload: ' + result);
        } else {
          resolve(result.trim());
        }
      } catch (error) {
        reject('Gagal mengirim permintaan: ' + error);
      }
    });
  });
};