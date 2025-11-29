const axios = require('axios')
const cheerio = require('cheerio')
const gis = require("g-i-s")

async function pinterest(query) {
	return new Promise((resolve, reject) => {
	  let err = { status: 404, message: "Terjadi kesalahan" }
	  gis({ searchTerm: query + ' site:id.pinterest.com', }, (er, res) => {
	   if (er) return err
	   let hasil = []
	   res.forEach(x => hasil.push(x.url))
	   resolve(hasil)
	  })
	})
};

module.exports = pinterest;