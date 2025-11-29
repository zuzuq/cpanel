const fs = require('fs');

const nama_path_addlist = './src/database/list.json'

function addResponList1(groupID, key, response, isImage, image_url, _db) {
var obj_add = {
id: groupID,
key: key,
response: response,
isImage: isImage,
image_url: image_url
}
_db.push(obj_add)
fs.writeFileSync(nama_path_addlist, JSON.stringify(_db, null, 3))
}

function getDataResponList1(groupID, key, _db) {
let position = null
Object.keys(_db).forEach((x) => {
if (_db[x].id === groupID && _db[x].key === key) {
position = x
}
})
if (position !== null) {
return _db[position]
}
}

function isAlreadyResponList1(groupID, key, _db) {
let found = false
Object.keys(_db).forEach((x) => {
if (_db[x].id === groupID && _db[x].key === key) {
found = true
}
})
return found
}

function sendResponList1(groupId, key, _dir) {
let position = null
Object.keys(_dir).forEach((x) => {
if (_dir[x].id === groupId && _dir[x].key === key) {
position = x
}
})
if (position !== null) {
return _dir[position].response
}
}

function isAlreadyResponList1Group(groupID, _db) {
let found = false
Object.keys(_db).forEach((x) => {
if (_db[x].id === groupID) {
found = true
}
})
return found
}

function delResponList1(groupID, key, _db) {
let position = null
Object.keys(_db).forEach((x) => {
if (_db[x].id === groupID && _db[x].key === key) {
position = x
}
})

if (position !== null) {
_db.splice(position, 1)
fs.writeFileSync(nama_path_addlist, JSON.stringify(_db, null, 3))
}
}

function updateResponList1(groupID, key, response, isImage, image_url, _db) {
let position = null
Object.keys(_db).forEach((x) => {
if (_db[x].id === groupID && _db[x].key === key) {
position = x
}
})
if (position !== null) {
_db[position].response = response
_db[position].isImage = isImage
_db[position].image_url = image_url
fs.writeFileSync(nama_path_addlist, JSON.stringify(_db, null, 3))
}
}

module.exports = { addResponList1, delResponList1, isAlreadyResponList1, isAlreadyResponList1Group, sendResponList1, updateResponList1, getDataResponList1 }