const qr = require('qrcode');
const axios = require('axios');
const BodyForm = require('form-data');
const fs = require('fs');
const path = require('path');

// Fungsi upload ke Catbox (dari code kamu)
async function CatBox(filePath) {
    try {
        const fileStream = fs.createReadStream(filePath);
        const formData = new BodyForm();
        
        const fileName = path.basename(filePath);
        const fileExt = path.extname(filePath);
        
        formData.append('fileToUpload', fileStream, {
            filename: fileName,
            contentType: getContentType(fileExt)
        });
        formData.append('reqtype', 'fileupload');
        formData.append('userhash', '');

        const response = await axios.post('https://catbox.moe/user/api.php', formData, {
            headers: {
                ...formData.getHeaders(),
            },
        });

        let uploadedUrl = response.data.trim();
        
        if (fileExt === '.mp4' && uploadedUrl.endsWith('.jpg')) {
            uploadedUrl = uploadedUrl.replace(/\.jpg$/, '.mp4');
        }

        return uploadedUrl;
    } catch (error) {
        console.error("Error at Catbox uploader:", error);
        return null;
    }
}

function getContentType(ext) {
    const types = {
        '.mp4': 'video/mp4',
        '.webm': 'video/webm',
        '.avi': 'video/x-msvideo',
        '.mov': 'video/quicktime',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif'
    };
    return types[ext.toLowerCase()] || 'application/octet-stream';
}

// Fungsi utama untuk generate QR dan upload ke Catbox
async function generateQRAndUpload(qrData, tempDir = './temp') {
    return new Promise(async (resolve, reject) => {
        try {
            // Pastikan folder temp ada
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }
            
            // Generate nama file unik
            const timestamp = Date.now();
            const randomId = Math.floor(Math.random() * 10000);
            const fileName = `qr_${timestamp}_${randomId}.png`;
            const filePath = path.join(tempDir, fileName);
            
            console.log('Generating QR code for:', qrData);
            
            // Generate QR code sebagai file
            await qr.toFile(filePath, qrData, {
                errorCorrectionLevel: 'M',
                type: 'png',
                quality: 0.92,
                margin: 2,
                color: {
                    dark: '#000000',
                    light: '#FFFFFF'
                },
                width: 300
            });
            
            console.log('QR code saved to:', filePath);
            
            // Upload ke Catbox
            const catboxUrl = await CatBox(filePath);
            
            if (catboxUrl && catboxUrl.startsWith('https://files.catbox.moe/')) {
                console.log('QR uploaded to Catbox:', catboxUrl);
                
                // Hapus file temporary
                fs.unlinkSync(filePath);
                
                resolve(catboxUrl);
            } else {
                throw new Error('Failed to upload to Catbox: ' + catboxUrl);
            }
            
        } catch (error) {
            console.error('Error generating QR or uploading:', error);
            
            // Cleanup file jika ada error
            const filePath = path.join(tempDir, `qr_${Date.now()}_*.png`);
            try {
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            } catch (cleanupError) {
                // Ignore cleanup errors
            }
            
            reject(error);
        }
    });
}

module.exports = { generateQRAndUpload, CatBox };