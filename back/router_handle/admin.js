// 导入数据库
const db = require('../db/index.js');
const bcrypt = require('bcryptjs');

exports.createUser = (req, res) => {
  const { account, password, identity = 'buyer', name = '', department = '', email = '' } = req.body || {};
  const allowedIdentities = ['admin', 'seller', 'buyer', 'regulator', 'auditor'];
  const normalizedAccount = String(account || '').trim();
  const normalizedIdentity = String(identity || '').trim();

  if (!/^[a-zA-Z0-9]{6,12}$/.test(normalizedAccount)) {
    return res.send({
      status: 1,
      message: '账号必须为6-12位字母或数字'
    });
  }

  if (!/^(?![0-9]+$)[a-z0-9]{6,12}$/.test(String(password || ''))) {
    return res.send({
      status: 1,
      message: '密码必须为6-12位小写字母或数字，且不能为纯数字'
    });
  }

  if (!allowedIdentities.includes(normalizedIdentity)) {
    return res.send({
      status: 1,
      message: '管理员仅可创建管理员、卖家、买家、监管、审计账号'
    });
  }

  const checkSql = 'SELECT id FROM users WHERE account = ? LIMIT 1';
  db.query(checkSql, [normalizedAccount], (err, results) => {
    if (err) return res.cc(err);
    if (results.length > 0) {
      return res.send({
        status: 1,
        message: '账号已存在'
      });
    }

    const insertSql = 'INSERT INTO users SET ?';
    db.query(insertSql, {
      account: normalizedAccount,
      password: bcrypt.hashSync(password, 10),
      identity: normalizedIdentity,
      name: String(name || '').trim(),
      department: String(department || '').trim(),
      email: String(email || '').trim(),
      status: 0,
      create_time: new Date(),
      update_time: new Date()
    }, (insertErr, insertResults) => {
      if (insertErr) return res.cc(insertErr);
      if (insertResults.affectedRows !== 1) {
        return res.send({
          status: 1,
          message: '创建用户失败'
        });
      }
      res.send({
        status: 0,
        message: '创建用户成功',
        data: { id: insertResults.insertId }
      });
    });
  });
};

// 获取所有用户列表
exports.getUserList = (req, res) => {
  const { page = 1, pageSize = 20, keyword, identity, status } = req.query;
  const offset = (page - 1) * pageSize;

  let sql = 'SELECT id, account, name, identity, department, sex, email, status, create_time, update_time FROM users WHERE 1=1';
  const params = [];

  // 搜索条件
  if (keyword) {
    sql += ' AND (account LIKE ? OR name LIKE ?)';
    params.push(`%${keyword}%`, `%${keyword}%`);
  }

  // 身份筛选
  if (identity) {
    sql += ' AND identity = ?';
    params.push(identity);
  }

  // 状态筛选
  if (status !== undefined && status !== null) {
    sql += ' AND status = ?';
    params.push(status);
  }

  // 获取总数
  const countSql = sql.replace('SELECT id, account, name, identity, department, sex, email, status, create_time, update_time FROM users', 'SELECT COUNT(*) as total FROM users');

  db.query(countSql, params, (err, countResults) => {
    if (err) return res.cc(err);

    const total = countResults[0].total;

    // 分页查询
    sql += ' ORDER BY create_time DESC LIMIT ? OFFSET ?';
    params.push(parseInt(pageSize), parseInt(offset));

    db.query(sql, params, (err, results) => {
      if (err) return res.cc(err);

      // 统计各身份用户数
      const statsSql = `
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN identity = 'admin' THEN 1 ELSE 0 END) as admin,
          SUM(CASE WHEN identity = 'seller' THEN 1 ELSE 0 END) as seller,
          SUM(CASE WHEN identity = 'buyer' THEN 1 ELSE 0 END) as buyer,
          SUM(CASE WHEN identity = 'regulator' THEN 1 ELSE 0 END) as regulator,
          SUM(CASE WHEN identity = 'auditor' THEN 1 ELSE 0 END) as auditor
        FROM users
      `;

      db.query(statsSql, (err, statsResults) => {
        if (err) return res.cc(err);

        res.send({
          status: 0,
          message: '获取用户列表成功',
          data: {
            list: results,
            total: total,
            stats: statsResults[0]
          }
        });
      });
    });
  });
};

exports.updateUserIdentity = (req, res) => {
  const { id } = req.params;
  const { identity } = req.body;
  const allowedIdentities = ['admin', 'seller', 'buyer', 'regulator', 'auditor'];

  if (!allowedIdentities.includes(String(identity || '').trim())) {
    return res.send({
      status: 1,
      message: '角色值无效'
    });
  }

  const operatorId = req.auth?.id;
  const checkSql = 'SELECT id, identity FROM users WHERE id = ? LIMIT 1';
  db.query(checkSql, [id], (err, results) => {
    if (err) return res.cc(err);
    if (results.length !== 1) {
      return res.send({
        status: 1,
        message: '用户不存在'
      });
    }

    const currentUser = results[0];
    if (String(currentUser.identity || '') === 'admin' && String(identity) !== 'admin') {
      return res.send({
        status: 1,
        message: '不能移除管理员角色'
      });
    }

    const updateSql = 'UPDATE users SET identity = ?, update_time = NOW() WHERE id = ?';
    db.query(updateSql, [identity, id], (updateErr, updateResults) => {
      if (updateErr) return res.cc(updateErr);
      if (updateResults.affectedRows !== 1) {
        return res.send({
          status: 1,
          message: '更新用户角色失败'
        });
      }

      const insertLogSql = `
        CREATE TABLE IF NOT EXISTS user_role_logs (
          id BIGINT PRIMARY KEY AUTO_INCREMENT,
          user_id BIGINT NOT NULL,
          old_identity VARCHAR(20) DEFAULT NULL,
          new_identity VARCHAR(20) DEFAULT NULL,
          operator_user_id BIGINT DEFAULT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `;

      db.query(insertLogSql, (logTableErr) => {
        if (logTableErr) {
          return res.send({
            status: 0,
            message: '更新用户角色成功',
          });
        }

        const logSql = `
          INSERT INTO user_role_logs (user_id, old_identity, new_identity, operator_user_id)
          VALUES (?, ?, ?, ?)
        `;
        db.query(
          logSql,
          [id, currentUser.identity || null, identity, operatorId || null],
          () => res.send({
            status: 0,
            message: '更新用户角色成功',
          })
        );
      });
    });
  });
};

// 冻结/解冻用户
exports.updateUserStatus = (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  // 验证状态值
  if (status !== 0 && status !== 1) {
    return res.send({
      status: 1,
      message: '状态值无效'
    });
  }

  // 不能冻结管理员账号
  const checkSql = 'SELECT identity FROM users WHERE id = ?';
  db.query(checkSql, [id], (err, results) => {
    if (err) return res.cc(err);
    if (results.length !== 1) {
      return res.send({
        status: 1,
        message: '用户不存在'
      });
    }

    if (results[0].identity === 'admin') {
      return res.send({
        status: 1,
        message: '不能冻结管理员账号'
      });
    }

    // 更新用户状态
    const sql = 'UPDATE users SET status = ? WHERE id = ?';
    db.query(sql, [status, id], (err, results) => {
      if (err) return res.cc(err);
      if (results.affectedRows !== 1) {
        return res.send({
          status: 1,
          message: '更新用户状态失败'
        });
      }

      res.send({
        status: 0,
        message: status === 1 ? '冻结用户成功' : '解冻用户成功'
      });
    });
  });
};

// 获取链上信息列表
exports.getChainInfo = (req, res) => {
  const { page = 1, pageSize = 20, keyword, chain_status } = req.query;
  const offset = (page - 1) * pageSize;

  let sql = `
    SELECT
      aci.id, aci.asset_id, da.asset_name, aci.token_id, aci.owner_address,
      aci.chain_tx_hash, aci.chain_status, aci.chain_time, aci.last_sync_time,
      aci.fail_reason, aci.retry_count
    FROM asset_chain_info aci
    LEFT JOIN digital_asset da ON aci.asset_id = da.id
    WHERE 1=1
  `;
  const params = [];

  // 搜索条件
  if (keyword) {
    sql += ' AND (da.asset_name LIKE ? OR aci.token_id LIKE ?)';
    params.push(`%${keyword}%`, `%${keyword}%`);
  }

  // 链上状态筛选
  if (chain_status !== undefined && chain_status !== null) {
    sql += ' AND aci.chain_status = ?';
    params.push(chain_status);
  }

  // 获取总数
  const countSql = `
    SELECT COUNT(*) as total
    FROM asset_chain_info aci
    LEFT JOIN digital_asset da ON aci.asset_id = da.id
    WHERE 1=1
    ${keyword ? ' AND (da.asset_name LIKE ? OR aci.token_id LIKE ?)' : ''}
    ${chain_status !== undefined && chain_status !== null ? ' AND aci.chain_status = ?' : ''}
  `;

  db.query(countSql, params.slice(0, params.length - 2), (err, countResults) => {
    if (err) return res.cc(err);

    const total = countResults[0].total;

    // 分页查询
    sql += ' ORDER BY aci.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(pageSize), parseInt(offset));

    db.query(sql, params, (err, results) => {
      if (err) return res.cc(err);

      // 统计链上状态
      const statsSql = `
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN chain_status = 1 THEN 1 ELSE 0 END) as onChain,
          SUM(CASE WHEN chain_status = 0 THEN 1 ELSE 0 END) as pending,
          SUM(CASE WHEN chain_status = 2 THEN 1 ELSE 0 END) as failed
        FROM asset_chain_info
      `;

      db.query(statsSql, (err, statsResults) => {
        if (err) return res.cc(err);

        res.send({
          status: 0,
          message: '获取链上信息成功',
          data: {
            list: results,
            total: total,
            stats: statsResults[0]
          }
        });
      });
    });
  });
};

// 管理员修改资产状态
exports.updateAssetStatus = (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  // 验证状态值
  if (![0, 1, 2].includes(status)) {
    return res.send({
      status: 1,
      message: '状态值无效'
    });
  }

  const sql = 'UPDATE digital_asset SET status = ? WHERE id = ?';
  db.query(sql, [status, id], (err, results) => {
    if (err) return res.cc(err);
    if (results.affectedRows !== 1) {
      return res.send({
        status: 1,
        message: '更新资产状态失败'
      });
    }

    res.send({
      status: 0,
      message: '更新资产状态成功'
    });
  });
};
