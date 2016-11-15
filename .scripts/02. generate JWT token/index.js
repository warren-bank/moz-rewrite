// copied from:
//     https://addons-server.readthedocs.io/en/latest/topics/api/auth.html

var jwt = require('jsonwebtoken');

var api_key    = process.env['JWT_issuer'];
var api_secret = process.env['JWT_secret'];

if (!api_key || !api_secret){
  console.log('please supply api credentials in environment variables');
  process.exit(1);
}

var issuedAt = Math.floor(Date.now() / 1000);
var payload = {
  iss: api_key,
  jti: Math.random().toString(),
  iat: issuedAt,
  exp: issuedAt + 60,
};

var token = jwt.sign(payload, api_secret, {
  algorithm: 'HS256',  // HMAC-SHA256 signing algorithm
});

console.log(token)
