// 导入数据库
const db = require('../db/index.js');
const bcrypt = require('bcryptjs');
const pamNodes = require('../service/pamNodes');
const assetService = require('../service/asset');
const pool = db.promise();

exports.listAdminAssets = async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.page_size) || 20));
    const where = [];
    const args = [];
    if (req.query.keyword) { where.push('da.asset_name LIKE ?'); args.push(`%${String(req.query.keyword).trim()}%`); }
    if (req.query.status !== undefined && req.query.status !== '') {
      where.push('da.status = ?'); args.push(Number(req.query.status));
    }
    const filter = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const [[count]] = await pool.query(`SELECT COUNT(*) AS total FROM digital_asset da ${filter}`, args);
    const [list] = await pool.query(`SELECT da.id, da.asset_name, da.price, da.price_unit, da.status,
      da.view_count, da.trade_count, da.created_at, da.file_hash,
      ac.category_name, r.region_name, aci.token_id, aci.owner_address,
      aci.chain_tx_hash, aci.chain_status, aci.chain_time, aci.fail_reason,
      aci.last_sync_time, aci.retry_count
      FROM digital_asset da
      LEFT JOIN asset_category ac ON ac.id = da.category_id
      LEFT JOIN region r ON r.id = da.region_id
      LEFT JOIN asset_chain_info aci ON aci.asset_id = da.id
      ${filter} ORDER BY da.created_at DESC, da.id DESC LIMIT ? OFFSET ?`,
    [...args, pageSize, (page - 1) * pageSize]);
    const [[stats]] = await pool.query(`SELECT COUNT(*) AS total,
      COALESCE(SUM(status = 1), 0) AS active, COALESCE(SUM(status = 2), 0) AS soldOut,
      COALESCE(SUM(status = 0), 0) AS offline FROM digital_asset`);
    return res.send({ status: 0, data: { list, total: Number(count.total), stats } });
  } catch (error) {
    console.error('管理员资产列表失败:', error);
    return res.status(500).send({ status: 1, message: error.message });
  }
};

exports.listAdminOrders = async (req, res) => {
  try {
    const result = await assetService.listOrders({
      page: req.query.page, page_size: req.query.page_size,
      keyword: req.query.keyword, order_status: req.query.status,
    }, req.auth?.id, 'admin');
    const [[stats]] = await pool.query(`SELECT COUNT(*) AS total,
      COALESCE(SUM(order_status = 0), 0) AS pending,
      COALESCE(SUM(order_status = 3), 0) AS completed,
      COALESCE(SUM(order_status IN (4, 6)), 0) AS cancelled FROM asset_order`);
    return res.send({ status: 0, data: { list: result.list, total: Number(result.pagination.total), stats } });
  } catch (error) {
    console.error('管理员订单列表失败:', error);
    return res.status(500).send({ status: 1, message: error.message });
  }
};

const validateAuditorTarget = async (identity, rawTarget) => {
  if (identity !== 'auditor') return '';
  const target = String(rawTarget || '').trim();
  if (!target) throw new Error('审计方必须选择审计入口');
  if (target === 'HUB') return target;
  if (!target.startsWith('NODE:') || !target.slice(5)) throw new Error('审计入口必须是 HUB 或 NODE:<node_id>');
  const nodes = await pamNodes.fetchNodes(true);
  if (!nodes.some((node) => node.node_id === target.slice(5))) throw new Error('审计节点不存在或未启用');
  return target;
};

exports.getAuditNodes = async (_req, res) => {
  try {
    const nodes = await pamNodes.fetchNodes(true);
    return res.send({ status: 0, data: { nodes } });
  } catch (error) {
    console.error('获取审计节点目录失败:', error);
    return res.status(502).send({ status: 1, message: error.message || '获取审计节点目录失败' });
  }
};

exports.getAuditNodeCredentials = async (_req, res) => {
  try {
    const nodes = await pamNodes.fetchNodes(true);
    const [rows] = await pamNodes.pool.query('SELECT node_id, node_name, username, updated_at FROM pam_node_credentials');
    const byId = new Map(rows.map((row) => [row.node_id, row]));
    return res.send({ status: 0, data: { nodes: nodes.map((node) => ({
      ...node,
      has_credentials: byId.has(node.node_id),
      username: byId.get(node.node_id)?.username || '',
      credentials_updated_at: byId.get(node.node_id)?.updated_at || null,
    })) } });
  } catch (error) {
    console.error('获取审计节点凭据状态失败:', error);
    return res.status(502).send({ status: 1, message: error.message || '获取审计节点失败' });
  }
};

exports.saveAuditNodeCredentials = async (req, res) => {
  const nodeId = String(req.params.nodeId || '').trim();
  const username = String(req.body?.username || '').trim();
  const password = String(req.body?.password || '');
  if (!nodeId || !username) return res.status(400).send({ status: 1, message: '缺少节点 ID 或节点账号' });
  try {
    const nodes = await pamNodes.fetchNodes(true);
    const node = nodes.find((item) => item.node_id === nodeId);
    if (!node) return res.status(404).send({ status: 1, message: '节点不存在或未启用' });
    const [rows] = await pamNodes.pool.query('SELECT node_id FROM pam_node_credentials WHERE node_id = ? LIMIT 1', [nodeId]);
    if (!rows.length && !password) return res.status(400).send({ status: 1, message: '首次配置节点凭据时必须填写密码' });
    if (!rows.length) {
      await pamNodes.pool.query('INSERT INTO pam_node_credentials (node_id, node_name, username, password_enc) VALUES (?, ?, ?, ?)',
        [nodeId, node.node_name || nodeId, username, pamNodes.encryptSecret(password)]);
    } else if (password) {
      await pamNodes.pool.query('UPDATE pam_node_credentials SET node_name = ?, username = ?, password_enc = ? WHERE node_id = ?',
        [node.node_name || nodeId, username, pamNodes.encryptSecret(password), nodeId]);
    } else {
      await pamNodes.pool.query('UPDATE pam_node_credentials SET node_name = ?, username = ? WHERE node_id = ?',
        [node.node_name || nodeId, username, nodeId]);
    }
    return res.send({ status: 0, message: '节点凭据已保存' });
  } catch (error) {
    console.error('保存审计节点凭据失败:', error);
    return res.status(500).send({ status: 1, message: error.message || '保存节点凭据失败' });
  }
};

exports.createUser = async (req, res) => {
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

  let auditorTarget;
  try {
    auditorTarget = await validateAuditorTarget(normalizedIdentity, req.body?.auditor_target);
  } catch (error) {
    return res.status(400).send({ status: 1, message: error.message });
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
      auditor_target: auditorTarget || null,
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

  let sql = 'SELECT id, account, name, identity, auditor_target, department, sex, email, status, create_time, update_time FROM users WHERE 1=1';
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
  const countSql = sql.replace('SELECT id, account, name, identity, auditor_target, department, sex, email, status, create_time, update_time FROM users', 'SELECT COUNT(*) as total FROM users');

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

exports.updateUserIdentity = async (req, res) => {
  const { id } = req.params;
  const { identity } = req.body;
  const allowedIdentities = ['admin', 'seller', 'buyer', 'regulator', 'auditor'];

  if (!allowedIdentities.includes(String(identity || '').trim())) {
    return res.send({
      status: 1,
      message: '角色值无效'
    });
  }

  let auditorTarget;
  try {
    auditorTarget = await validateAuditorTarget(String(identity || '').trim(), req.body?.auditor_target);
  } catch (error) {
    return res.status(400).send({ status: 1, message: error.message });
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

    const updateSql = 'UPDATE users SET identity = ?, auditor_target = ?, update_time = NOW() WHERE id = ?';
    db.query(updateSql, [identity, auditorTarget || null, id], (updateErr, updateResults) => {
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
