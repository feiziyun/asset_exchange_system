const db = require('../db/index').promise();

function imageType(bytes, storedType) {
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.length > 8 && bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))) return 'image/png';
  if (bytes.length > 3 && bytes.toString('ascii', 0, 3) === 'GIF') return 'image/gif';
  if (bytes.length > 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return ['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(storedType) ? storedType : null;
}

module.exports = async (req, res) => {
  const fileHash = String(req.params.fileHash || '').trim();
  // Historical hashes are not always lowercase hexadecimal strings.
  if (!/^[A-Za-z0-9._~-]{1,255}$/.test(fileHash)) return res.status(400).json({ error: 'file_hash 格式非法' });
  try {
    const [rows] = await db.query('SELECT picture,picture_mime_type FROM digital_asset WHERE file_hash=? LIMIT 1', [fileHash]);
    const picture = rows[0]?.picture;
    if (!picture) return res.status(404).json({ error: '图片不存在' });
    const bytes = Buffer.isBuffer(picture) ? picture : Buffer.from(picture);
    const type = imageType(bytes, rows[0].picture_mime_type);
    if (!type) return res.status(415).json({ error: '图片格式不支持' });
    res.set('Content-Type', type);
    res.set('Cache-Control', 'public, max-age=86400');
    res.set('X-Content-Type-Options', 'nosniff');
    return res.end(bytes);
  } catch (error) {
    console.error('查询资产图片失败:', error.message);
    return res.status(500).json({ error: '图片查询失败' });
  }
};

module.exports.imageType = imageType;
