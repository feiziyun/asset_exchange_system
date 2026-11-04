const multer = require('multer');

const memoryUpload = multer({ storage: multer.memoryStorage() });

module.exports = {
  memoryUpload,
};
