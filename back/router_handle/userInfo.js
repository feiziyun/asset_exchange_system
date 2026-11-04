// 导入数据库
const db = require('../db/index.js');
// 导入加密中间件
const bcrypt = require('bcryptjs');
const toBase64Image = (buffer) => {
  if (!buffer) return '';
  if (Buffer.isBuffer(buffer)) return buffer.toString('base64');
  if (buffer instanceof Uint8Array) return Buffer.from(buffer).toString('base64');
  return '';
};


// 上传用户头像
exports.uploadAvatar = (req, res) => {
  const file = req.file;
  const userId = req.auth?.id || req.body?.id;
  if (!file?.buffer) {
    return res.send({
      status: 1,
      message: '请上传头像文件',
    });
  }
  if (!userId) {
    return res.send({
      status: 1,
      message: '缺少用户信息',
    });
  }

  const avatarMimeType = file.mimetype || 'image/jpeg';
  const avatarBase64 = toBase64Image(file.buffer);

  const sql = 'update users set avatarData = ?, avatarMimeType = ? where id = ?';
  db.query(sql, [file.buffer, avatarMimeType, userId], (err, results) => {
    if (err) return res.cc(err);
    if (results.affectedRows !== 1) {
      return res.send({
        status: 1,
        message: '上传头像失败，请稍后再试'
      });
    }
    res.send({
      status: 0,
      message: '上传头像成功！',
      data: {
        user_id: userId,
        avatar: avatarBase64,
        avatar_mime_type: avatarMimeType,
      }
    })
  })
}

// 修改密码：确认旧密码正确后，更新为新密码
exports.updatePassword = (req, res) => {
  const { id, oldPassword, newPassword } = req.body;
  const sql = 'select * from users where id = ?';
  db.query(sql, id, (err, results) => {
    if (err) return res.cc(err);
    if (results.length !== 1) {
      return res.send({
        status: 1,
        message: '用户不存在'
      });
    }
    const compareResult = bcrypt.compareSync(oldPassword, results[0].password);
    if (!compareResult) {
      return res.send({
        status: 1,
        message: '旧密码错误'
      });
    }
    const newHashedPassword = bcrypt.hashSync(newPassword, 10);
    const sql1 = 'update users set password = ? where id = ?';
    db.query(sql1, [newHashedPassword, id], (err, results) => {
      if (err) return res.cc(err);
      if (results.affectedRows !== 1) {
        return res.send({
          status: 1,
          message: '修改密码失败，请稍后再试'
        });
      }
      res.send({
        status: 0,
        message: '修改密码成功！',
      })
    })
  })
} 


// 获取用户信息，接受账户 id
exports.getUserInfo = (req, res) => {
  const id = req.query?.id || req.body?.id || req.auth?.id;
  if (!id) {
    return res.send({
      status: 1,
      message: '缺少用户ID，无法获取用户信息'
    });
  }
  const sql = 'select * from users where id = ?';
  db.query(sql, id, (err, results) => {
    if (err) return res.cc(err);
    if (results.length !== 1) {
      return res.send({
        status: 1,
        message: '获取用户信息失败，请稍后再试'
      });
    }
    const user = {
      ...results[0],
      avatarData: undefined,
      avatar: toBase64Image(results[0].avatarData),
    };
    delete user.avatarUrl;
    delete user.avatarOnlyId;
    res.send({
      status: 0,
      message: '获取用户信息成功！',
      data: user
    })
  })
}

// 修改用户名，接受参数 id、newName
exports.updateUserName = (req, res) => {
  const { id, name } = req.body;
  const sql = 'update users set name = ? where id = ?';
  db.query(sql, [name, id], (err, results) => {
    if (err) return res.cc(err);
    if (results.affectedRows !== 1) {
      return res.send({
        status: 1,
        message: '修改用户姓名失败，请稍后再试'
      });
    }
    res.send({
      status: 0,
      message: '修改用户姓名成功！',
    })
  })
}

// 修改用户性别
exports.updateUserGender = (req, res) => {
  const { id, gender} = req.body;
  const sql = 'update users set sex = ? where id = ?';
  db.query(sql, [gender, id], (err, results) => {
    if (err) return res.cc(err);
    if (results.affectedRows !== 1) {
      return res.send({
        status: 1,
        message: '修改用户性别失败，请稍后再试'
      });
    }
    res.send({
      status: 0,
      message: '修改用户性别成功！',
    })
  })
} 

// 修改用户邮箱
exports.updateUserEmail = (req, res) => {
  const { id, email} = req.body;
  const sql = 'update users set email = ? where id = ?';
  db.query(sql, [email, id], (err, results) => {
    if (err) return res.cc(err);
    if (results.affectedRows !== 1) {
      return res.send({
        status: 1,
        message: '修改用户邮箱失败，请稍后再试'
      });
    }
    res.send({
      status: 0,
      message: '修改用户邮箱成功！',
    })
  }
)}
