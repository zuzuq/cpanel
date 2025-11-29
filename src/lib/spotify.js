const axios = require('axios');
const fs = require('fs');
const path = require('path');

class SpotifyApi {
  constructor() {
    this.sites = [
      'https://spotifydown.org',
      'https://spotifysave.com',
      'https://spotify-downloader.com'
    ];
  }

  // Ekstrak metadata dari Spotify URL
  async getSpotifyInfo(spotifyUrl) {
    try {
      const trackId = spotifyUrl.match(/track\/([a-zA-Z0-9]+)/)?.[1];
      if (!trackId) throw new Error('Invalid Spotify URL');

      // Gunakan Spotify embed untuk metadata
      const embedUrl = `https://open.spotify.com/embed/track/${trackId}`;
      const response = await axios.get(embedUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      const html = response.data;
      
      // Parse dari JSON-LD atau meta tags
      let title = 'Unknown';
      let artist = 'Unknown Artist';
      let album = 'Unknown Album';

      // Try JSON-LD first
      const jsonLdMatch = html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s);
      if (jsonLdMatch) {
        try {
          const jsonData = JSON.parse(jsonLdMatch[1]);
          title = jsonData.name || title;
          artist = jsonData.byArtist?.name || artist;
          album = jsonData.inAlbum?.name || album;
        } catch (e) {
          // Fallback to meta tags
        }
      }

      // Fallback to meta tags
      if (title === 'Unknown') {
        const titleMatch = html.match(/<title>([^<]+)<\/title>/);
        if (titleMatch) {
          const fullTitle = titleMatch[1];
          const parts = fullTitle.split(' - ');
          if (parts.length >= 2) {
            title = parts[0].trim();
            artist = parts[1].replace(' | Spotify', '').trim();
          }
        }
      }

      return { title, artist, album, trackId };
    } catch (error) {
      throw new Error(`Failed to get Spotify info: ${error.message}`);
    }
  }

  // Coba download dari berbagai site
  async tryDownloadFromSite(siteUrl, spotifyUrl) {
    try {
      // Method 1: Direct POST
      const response = await axios.post(siteUrl, {
        url: spotifyUrl,
        download: true
      }, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 30000
      });

      // Cari link download dari response
      const downloadMatch = response.data.match(/href="([^"]+\.mp3[^"]*)"/);
      if (downloadMatch) {
        return downloadMatch[1];
      }

      // Method 2: Cari API endpoint
      const apiMatch = response.data.match(/\/api\/[^"'\s]+/);
      if (apiMatch) {
        const apiUrl = siteUrl + apiMatch[0];
        const apiResponse = await axios.post(apiUrl, {
          url: spotifyUrl
        }, {
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });

        if (apiResponse.data.download_url) {
          return apiResponse.data.download_url;
        }
      }

      throw new Error('No download link found');
    } catch (error) {
      throw new Error(`Site ${siteUrl} failed: ${error.message}`);
    }
  }

  // Download file dari URL
  async downloadFile(downloadUrl, outputPath) {
    try {
      const response = await axios({
        method: 'GET',
        url: downloadUrl,
        responseType: 'stream',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 60000
      });

      const writer = fs.createWriteStream(outputPath);
      response.data.pipe(writer);

      return new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
        
        // Timeout setelah 60 detik
        setTimeout(() => {
          writer.destroy();
          reject(new Error('Download timeout'));
        }, 60000);
      });
    } catch (error) {
      throw new Error(`Download failed: ${error.message}`);
    }
  }

  // Main download function
  async download(spotifyUrl) {
    try {
      console.log('📥 Getting Spotify metadata...');
      
      // Dapatkan info lagu
      const info = await this.getSpotifyInfo(spotifyUrl);
      console.log(`🎵 Found: ${info.title} - ${info.artist}`);

      // Buat folder temp
      const tempDir = path.join(__dirname, 'temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      // Coba download dari berbagai site
      let downloadUrl = null;
      let lastError = null;

      for (const site of this.sites) {
        try {
          console.log(`🔍 Trying ${site}...`);
          downloadUrl = await this.tryDownloadFromSite(site, spotifyUrl);
          if (downloadUrl) break;
        } catch (error) {
          lastError = error;
          console.log(`❌ ${site} failed: ${error.message}`);
        }
      }

      if (!downloadUrl) {
        throw new Error(`All sites failed. Last error: ${lastError?.message}`);
      }

      console.log('📺 Found download URL');

      // Download file
      const fileName = `${info.artist} - ${info.title}`.replace(/[^\w\s-]/g, '').substring(0, 50);
      const outputPath = path.join(tempDir, `${fileName}.mp3`);

      console.log('⬇️ Downloading audio...');
      await this.downloadFile(downloadUrl, outputPath);

      // Cek file size
      const stats = fs.statSync(outputPath);
      if (stats.size < 1000) { // File terlalu kecil
        fs.unlinkSync(outputPath);
        throw new Error('Downloaded file is too small (probably empty)');
      }

      console.log('✅ Download complete!');

      return {
        title: info.title,
        artist: info.artist,
        album: info.album,
        path: outputPath
      };

    } catch (error) {
      console.error('❌ Download error:', error.message);
      throw error;
    }
  }
}

module.exports = { SpotifyApi };