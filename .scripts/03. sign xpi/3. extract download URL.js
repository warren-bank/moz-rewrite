const fs = require('fs');

var json = fs.readFileSync( process.env['status_txt'] )
var status = JSON.parse(json)

var url = 'not found'

if (status && status.files && status.files.length && status.files[0].download_url){
  url = status.files[0].download_url
}

console.log(url)
