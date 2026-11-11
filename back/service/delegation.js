const db = require('../db/index');
const chain = require('./chainClient');

const pool = db.promise();
const RIGHTS = [
  ['持有权', 'can_sell_ownership'],
  ['经营权', 'can_sell_view_right'],
  ['使用权', 'can_sell_process_right'],
];
const error = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });

const configureOwner = async (ownerId, ownerAddress) => {
  const [rows] = await pool.query(
    `SELECT certificate_name,org,address FROM certificate_registry
     WHERE user_id=? AND address=? ORDER BY id DESC LIMIT 1`,
    [ownerId, ownerAddress],
  );
  const cert = rows[0];
  if (!cert?.certificate_name || !cert?.org) throw error('未找到所有者证书，无法执行链上授权');
  const org = cert.org.endsWith('.chainmaker.org') ? cert.org : `${cert.org}.chainmaker.org`;
  const configured = await chain.dynamicCertConfig(cert.certificate_name, org);
  if (configured?.code !== undefined && Number(configured.code) !== 0) {
    throw error(configured.message || '链上证书配置失败', 502);
  }
  return cert;
};

const parseRights = (input, asset) => {
  const available = RIGHTS.filter(([, field]) => Number(asset[field]) === 1).map(([name]) => name);
  const requested = (Array.isArray(input) ? input : String(input || '').split(','))
    .map((right) => String(right).trim()).filter(Boolean);
  if (!requested.length) throw error('请至少选择一项允许代理的权益');
  if (requested.some((right) => !available.includes(right))) throw error('代理权益超出可售范围');
  return [...new Set(requested)].join(',');
};

exports.listAgent = async (userId) => {
  const [rows] = await pool.query(
    `SELECT d.id AS delegation_id, d.*, da.asset_name, da.file_hash, da.description,
            da.classification_data_level, da.pc_type, da.is_proxied,
            da.picture, da.picture_mime_type,
            u.account AS owner_username
     FROM asset_delegations d
     JOIN digital_asset da ON da.id=d.asset_id
     JOIN users u ON u.id=d.owner_id
     WHERE d.agent_user_id=? AND d.status='ACTIVE' AND d.quantity_remaining>0
     ORDER BY d.id DESC`, [userId],
  );
  return rows.map((row) => ({
    ...row,
    picture: Buffer.isBuffer(row.picture) ? row.picture.toString('base64') : null,
  }));
};

exports.listOwner = async (userId) => {
  const [rows] = await pool.query(
    `SELECT d.id AS delegation_id, d.*, u.account AS agent_username
     FROM asset_delegations d LEFT JOIN users u ON u.id=d.agent_user_id
     WHERE d.owner_id=? AND d.status IN ('PENDING','ACTIVE','SOLD_OUT')
     ORDER BY d.id DESC`, [userId],
  );
  return rows;
};

exports.get = async (id, userId) => {
  const [rows] = await pool.query(
    `SELECT d.*, da.asset_name, da.file_hash, da.description,
            da.classification_data_level, da.pc_type
     FROM asset_delegations d JOIN digital_asset da ON da.id=d.asset_id
     WHERE d.id=? AND (d.owner_id=? OR d.agent_user_id=?) LIMIT 1`,
    [id, userId, userId],
  );
  if (!rows.length) throw error('代理关系不存在', 404);
  return rows[0];
};

exports.delegate = async (payload, userId) => {
  const assetHash = String(payload.asset_id || '').trim();
  const agentAddress = String(payload.agent_address || '').trim();
  if (!assetHash || !agentAddress) throw error('缺少 asset_id 或 agent_address');
  const quantity = Number(payload.quantity);
  if (!Number.isSafeInteger(quantity) || quantity < 1) throw error('托管份数必须为正整数');
  if (Number(payload.actor_user_id) !== Number(userId)) throw error('操作人身份不一致', 403);

  const [agents] = await pool.query(
    `SELECT cr.user_id,cr.certificate_name,u.identity FROM certificate_registry cr
     JOIN users u ON u.id=cr.user_id
     WHERE cr.address=? AND cr.user_id IS NOT NULL ORDER BY cr.id DESC LIMIT 1`, [agentAddress],
  );
  const agentId = Number(agents[0]?.user_id || 0);
  if (!agentId) throw error('托管码未绑定系统用户，请填写本站证书地址');
  const agentCertificateName = String(agents[0].certificate_name || '').trim();
  if (!agentCertificateName) throw error('代理人证书信息不完整');
  if (agentId === Number(userId)) throw error('不能把资产代理给自己');
  if (!(/seller/i.test(String(agents[0].identity || '')) || String(agents[0].identity || '').includes('卖'))) {
    throw error('代理人必须是卖家用户');
  }

  const conn = await pool.getConnection();
  let reserved;
  try {
    await conn.beginTransaction();
    const [assets] = await conn.query(
      `SELECT da.*, aci.token_id, aci.owner_address FROM digital_asset da
       JOIN asset_chain_info aci ON aci.asset_id=da.id
       WHERE da.file_hash=? LIMIT 1 FOR UPDATE`, [assetHash],
    );
    const asset = assets[0];
    if (!asset) throw error('资产不存在', 404);
    if (Number(asset.user_id) !== Number(userId)) throw error('只有资产所有者可以发起代理托管', 403);
    if (Number(asset.is_divisible) === 0 && quantity !== 1) throw error('旧版不可分割资产只能托管 1 份');
    if (Number(asset.is_divisible) === 0 && String(asset.token_id || asset.file_hash) !== assetHash) throw error('资产链上标识与文件哈希不一致');
    const rights = parseRights(payload.allowed_rights, asset);
    const [publishes] = await conn.query(
      `SELECT * FROM asset_publish_record
       WHERE asset_id=? AND publisher_id=? AND delegation_id IS NULL
         AND publish_status=1 AND pricing_mode='fixed' AND remaining_qty>=?
       LIMIT 1 FOR UPDATE`, [asset.id, userId, quantity],
    );
    const publish = publishes[0];
    if (!publish) throw error('只有开放交易的固定价格资产可以代理托管');
    const [existing] = await conn.query(
      `SELECT id FROM asset_delegations WHERE asset_id=? AND status IN ('PENDING','ACTIVE','SOLD_OUT')
       LIMIT 1 FOR UPDATE`, [asset.id],
    );
    if (existing.length) throw error('该资产已有代理关系，请先撤销或退出', 409);
    const ownerAddress = String(asset.owner_address || '').trim();
    if (!ownerAddress) throw error('资产缺少链上所有者地址');
    const [result] = await conn.query(
      `INSERT INTO asset_delegations
       (asset_id,owner_id,owner_address,agent_user_id,agent_address,
        quantity_total,quantity_remaining,allowed_rights,price,status)
       VALUES (?,?,?,?,?,?,?,?,?,'PENDING')`,
      [asset.id,userId,ownerAddress,agentId,agentAddress,quantity,quantity,rights,publish.publish_price],
    );
    const [reservedStock] = await conn.query(
      `UPDATE asset_publish_record SET publish_status=IF(remaining_qty=?,2,1),
       remaining_qty=remaining_qty-?
       WHERE id=? AND remaining_qty>=?`, [quantity,quantity,publish.id,quantity],
    );
    if (!reservedStock.affectedRows) throw error('可售数量不足，无法预扣代理库存', 409);
    reserved = { id: result.insertId, asset, publish, rights, ownerAddress, agentId, agentAddress, quantity };
    await conn.commit();
  } catch (cause) {
    await conn.rollback();
    throw cause;
  } finally { conn.release(); }

  try {
    await configureOwner(userId, reserved.ownerAddress);
    if (Number(reserved.asset.is_divisible) === 1) {
      await chain.enApprove({ to: agentAddress, amount: String(quantity) });
    } else {
      const current = await chain.ownerOf(assetHash);
      if (String(current?.result || current?.owner || '').trim() !== reserved.ownerAddress) {
        throw error('链上所有者不是当前卖家，无法代理托管', 409);
      }
      await chain.setApproval({ owner: reserved.ownerAddress, to: agentAddress,
        tokenId: assetHash, isApproval: 'true' });
    }
    const finish = await pool.getConnection();
    try {
      await finish.beginTransaction();
      await finish.query(
        `INSERT INTO asset_publish_record
         (asset_id,publisher_id,delegation_id,seller_certificate_name,seller_address,
          publish_price,publish_qty,remaining_qty,sold_qty_total,publish_status,pricing_mode)
         VALUES (?,?,?,?,?,?,?,?,0,1,'fixed')`,
        [reserved.asset.id,agentId,reserved.id,agentCertificateName,agentAddress,reserved.publish.publish_price,quantity,quantity],
      );
      await finish.query("UPDATE asset_delegations SET status='ACTIVE' WHERE id=? AND status='PENDING'", [reserved.id]);
      await finish.query('UPDATE digital_asset SET proxy_agent_address=? WHERE id=?', [agentAddress,reserved.asset.id]);
      await finish.commit();
    } catch (cause) { await finish.rollback(); throw cause; }
    finally { finish.release(); }
    return { id: reserved.id, asset_id: assetHash, owner_id: userId,
      owner_address: reserved.ownerAddress, agent_user_id: agentId, agent_address: agentAddress,
      quantity_total: quantity, quantity_remaining: quantity, allowed_rights: reserved.rights,
      price: reserved.publish.publish_price, status: 'ACTIVE' };
  } catch (cause) {
    // 如果业务写入失败，尽力撤销链上授权，再返还上架库存。
    try {
      if (Number(reserved.asset.is_divisible) === 1) await chain.enApprove({ to: agentAddress, amount: '0' });
      else await chain.setApproval({ owner: reserved.ownerAddress, to: agentAddress,
        tokenId: assetHash, isApproval: 'false' });
    } catch (_ignored) {}
    const undo = await pool.getConnection();
    try {
      await undo.beginTransaction();
      await undo.query("UPDATE asset_delegations SET status='REVOKED',quantity_remaining=0,revoked_at=NOW() WHERE id=? AND status='PENDING'", [reserved.id]);
      await undo.query('UPDATE asset_publish_record SET remaining_qty=remaining_qty+?,publish_status=1 WHERE id=?', [quantity,reserved.publish.id]);
      await undo.commit();
    } catch (rollbackError) { await undo.rollback(); cause.message += `；库存回滚失败：${rollbackError.message}`; }
    finally { undo.release(); }
    throw cause;
  }
};

exports.revoke = async (payload, userId) => {
  if (Number(payload.actor_user_id) !== Number(userId)) throw error('操作人身份不一致', 403);
  const id = Number(payload.delegation_id || 0);
  const hash = String(payload.asset_id || '').trim();
  if (!id && !hash) throw error('缺少 delegation_id 或 asset_id');
  const conn = await pool.getConnection();
  let delegation;
  try {
    await conn.beginTransaction();
    const [matched] = await conn.query(
      `SELECT d.id FROM asset_delegations d JOIN digital_asset da ON da.id=d.asset_id
       WHERE ${id ? 'd.id=?' : "da.file_hash=? AND d.status IN ('ACTIVE','SOLD_OUT')"}
       ORDER BY d.id DESC LIMIT 1`, [id || hash],
    );
    if (!matched.length) throw error('代理关系不存在', 404);
    const [agentPublishes] = await conn.query(
      `SELECT * FROM asset_publish_record WHERE delegation_id=? LIMIT 1 FOR UPDATE`,
      [matched[0].id],
    );
    const [rows] = await conn.query(
      `SELECT d.*, da.file_hash,da.is_divisible FROM asset_delegations d JOIN digital_asset da ON da.id=d.asset_id
       WHERE d.id=? LIMIT 1 FOR UPDATE`, [matched[0].id],
    );
    delegation = rows[0];
    if (!delegation) throw error('代理关系不存在', 404);
    if (![Number(delegation.owner_id),Number(delegation.agent_user_id)].includes(Number(userId))) {
      throw error('只有所有者或代理人可以撤销该代理关系', 403);
    }
    if (delegation.status === 'REVOKED') { await conn.commit(); return { alreadyRevoked: true, delegationId: delegation.id, returned: 0 }; }
    if (!['ACTIVE','SOLD_OUT'].includes(delegation.status)) throw error('代理关系当前不可撤销', 409);
    const [pending] = await conn.query(
      `SELECT id FROM asset_order WHERE delegation_id=? AND order_status NOT IN (3,4,6) LIMIT 1 FOR UPDATE`, [delegation.id],
    );
    if (pending.length) throw error('该代理还有未完成订单，请先处理订单再撤销', 409);
    const agentPublish = agentPublishes[0];
    if (!agentPublish) throw error('代理上架记录不存在', 409);
    const returned = Number(agentPublish.remaining_qty || 0);
    if (returned !== Number(delegation.quantity_remaining)) throw error('代理库存数据异常', 409);
    await conn.query("UPDATE asset_delegations SET status='REVOKED',quantity_remaining=0,revoked_at=NOW() WHERE id=?", [delegation.id]);
    await conn.query('UPDATE asset_publish_record SET remaining_qty=0,publish_status=0 WHERE id=?', [agentPublish.id]);
    if (returned) {
      const [ownerStock] = await conn.query(
        `UPDATE asset_publish_record SET remaining_qty=remaining_qty+?,publish_status=1
         WHERE asset_id=? AND publisher_id=? AND delegation_id IS NULL`,
        [returned,delegation.asset_id,delegation.owner_id],
      );
      if (!ownerStock.affectedRows) throw error('所有者库存状态异常，无法返还代理库存', 409);
    }
    await conn.query('UPDATE digital_asset SET proxy_agent_address=NULL WHERE id=?', [delegation.asset_id]);
    delegation.returned = returned;
    await conn.commit();
  } catch (cause) { await conn.rollback(); throw cause; }
  finally { conn.release(); }

  try {
    await configureOwner(delegation.owner_id, delegation.owner_address);
    if (Number(delegation.is_divisible) === 1) await chain.enApprove({ to: delegation.agent_address, amount: '0' });
    else await chain.setApproval({ owner: delegation.owner_address, to: delegation.agent_address,
      tokenId: delegation.file_hash, isApproval: 'false' });
    return { alreadyRevoked: false, delegationId: delegation.id, returned: delegation.returned };
  } catch (cause) {
    return { alreadyRevoked: false, delegationId: delegation.id, returned: delegation.returned,
      chain_revoke_failed: true, warning: '业务代理已撤销，链上授权撤销失败，请核查链上授权状态' };
  }
};
