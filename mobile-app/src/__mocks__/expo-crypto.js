const crypto = require('crypto');
module.exports = {
  randomUUID: () => '00000000-0000-0000-0000-000000000000',
  getRandomBytes: (length) => crypto.randomBytes(length)
};
