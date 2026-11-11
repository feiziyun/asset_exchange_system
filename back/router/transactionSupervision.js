const express = require('express');
const db = require('../db/index');

const router = express.Router();
const pool = db.promise();
const SOURCE_MESSAGE = '当前为本系统业务交易记录。区块、Gas 和风险事件须接入原型的独立交易监管数据服务。';
const STATUS_SQL = `CASE
  WHEN t.status = 'PAMING' THEN 'auditing'
  WHEN ao.order_status = 3 OR t.status IN ('已完成', '已交付') THEN 'finished'
  ELSE 'submitted' END`;

router.use((req, res, next) => {
  if (!['regulator', 'admin'].includes(String(req.auth?.identity || '').toLowerCase())) {
    return res.status(403).json({ message: '仅监管方或管理员可查看交易穿透监管' });
  }
  next();
});

async function transferSource() {
  const [[row]] = await pool.query(`SELECT COUNT(*) AS found FROM information_schema.tables
    WHERE table_schema = DATABASE() AND table_name = 'asset_chain_transfer_record'`);
  const exists = Number(row?.found || 0) > 0;
  return {
    join: exists ? 'LEFT JOIN asset_chain_transfer_record atr ON atr.order_id = ao.id' : '',
    hash: exists ? "NULLIF(atr.chain_tx_hash, '')" : 'NULL',
    from: exists ? "NULLIF(atr.from_address, '')" : 'NULL',
    to: exists ? "NULLIF(atr.to_address, '')" : 'NULL',
    action: exists ? 'atr.chain_action' : 'NULL',
  };
}

function fromSql(source) {
  return `FROM transactions t
    LEFT JOIN asset_order ao ON ao.order_no = t.order_no
    LEFT JOIN digital_asset da ON da.id = t.asset_id
    LEFT JOIN digital_contracts dc ON dc.transaction_id = t.transaction_id
    LEFT JOIN asset_chain_info aci ON aci.asset_id = t.asset_id
    ${source.join}`;
}

function selectSql(source) {
  return `SELECT t.id, t.transaction_id, t.order_no, t.created_at,
    t.status AS business_status, da.asset_name, dc.contract_name AS business_contract_name,
    COALESCE(dc.token_id, aci.token_id) AS token_id,
    ao.buy_qty, ao.trade_mode, ao.deal_price AS value,
    COALESCE(${source.from}, NULLIF(t.seller_address, '')) AS from_address,
    COALESCE(${source.to}, NULLIF(t.buyer_address, '')) AS to_address,
    ${source.hash} AS tx_hash, ${source.action} AS chain_action,
    ${STATUS_SQL} AS supervision_status ${fromSql(source)}`;
}

function parseCursor(value) {
  if (!value) return null;
  try {
    const id = Number(Buffer.from(String(value), 'base64url').toString('utf8'));
    return Number.isSafeInteger(id) && id > 0 ? id : null;
  } catch (_error) { return null; }
}

function whereClause(query, source) {
  const terms = [];
  const values = [];
  const like = (field, value) => {
    if (value) { terms.push(`${field} LIKE ?`); values.push(`%${String(value).trim()}%`); }
  };
  like(source.hash, query.tx_hash);
  like(`COALESCE(${source.from}, t.seller_address)`, query.from_address);
  like(`COALESCE(${source.to}, t.buyer_address)`, query.to_address);
  if (query.status && query.status !== 'all') {
    if (!['submitted', 'auditing', 'risk', 'finished'].includes(query.status)) throw new Error('无效的监管状态');
    terms.push(`${STATUS_SQL} = ?`);
    values.push(query.status);
  }
  if (query.chain_status) {
    if (!['success', 'failed', 'unknown'].includes(query.chain_status)) throw new Error('无效的链上状态');
    terms.push(query.chain_status === 'success' ? `${source.hash} IS NOT NULL`
      : query.chain_status === 'unknown' ? `${source.hash} IS NULL` : '1 = 0');
  }
  // 本地业务库没有风险判定；不能把业务失败伪装成风险事件。
  if (query.risk_level) terms.push('1 = 0');
  if (query.start_time) { terms.push('t.created_at >= ?'); values.push(String(query.start_time).replace('T', ' ')); }
  if (query.end_time) { terms.push('t.created_at <= ?'); values.push(String(query.end_time).replace('T', ' ')); }
  return { sql: terms.length ? `WHERE ${terms.join(' AND ')}` : '', values };
}

function formatRow(row) {
  return {
    record_key: row.transaction_id,
    business_transaction_id: row.transaction_id,
    tx_hash: row.tx_hash || null,
    datetime: row.created_at,
    block_number: null,
    chain_id: null,
    contract_name: null,
    contract_method: null,
    sender_address: null,
    tx_type: null,
    gas_used: null,
    from_address: row.from_address || null,
    to_address: row.to_address || null,
    value: row.value == null ? null : Number(row.value), // 原型交易金额：一份的单价
    asset_symbol: 'CNY',
    fee: null,
    chain_status: row.tx_hash ? 'success' : 'unknown',
    supervision_status: row.supervision_status,
    risk_level: null,
    source_kind: 'business',
    token_id: row.token_id || null,
    operation: row.chain_action || row.trade_mode || null,
    business_contract_name: row.business_contract_name || null,
    asset_name: row.asset_name || null,
    order_no: row.order_no || null,
    buy_qty: row.buy_qty == null ? null : Number(row.buy_qty),
    business_status: row.business_status || null,
    risk_events: [],
  };
}

router.get('/overview', async (req, res) => {
  const date = String(req.query.date || '').trim();
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ message: '日期格式应为 YYYY-MM-DD' });
  try {
    const [[latest]] = await pool.query("SELECT DATE_FORMAT(MAX(created_at), '%Y-%m-%d') AS stat_date FROM transactions");
    const statDate = date || latest?.stat_date || null;
    const [rows] = statDate
      ? await pool.query(`SELECT ${STATUS_SQL} AS supervision_status, COUNT(*) AS count
          FROM transactions t LEFT JOIN asset_order ao ON ao.order_no = t.order_no
          WHERE DATE(t.created_at) = ? GROUP BY supervision_status`, [statDate])
      : [[]];
    const counts = { submitted: 0, auditing: 0, risk: 0, finished: 0 };
    for (const row of rows) counts[row.supervision_status] = Number(row.count || 0);
    const [[finished]] = await pool.query('SELECT COUNT(*) AS count FROM transactions');
    return res.json({ available: true, source_kind: 'business', message: SOURCE_MESSAGE,
      stat_date: statDate, total: Object.values(counts).reduce((sum, count) => sum + count, 0),
      finished_total: Number(finished?.count || 0), status_counts: counts });
  } catch (error) {
    console.error('交易穿透监管统计失败:', error);
    return res.status(500).json({ message: error.message || '查询监管总览失败' });
  }
});

router.get('/transactions', async (req, res) => {
  try {
    const pageSize = Math.min(Math.max(Number(req.query.page_size || 50), 1), 200);
    if (!Number.isInteger(pageSize)) return res.status(400).json({ message: '无效的 page_size' });
    const cursor = parseCursor(req.query.cursor);
    if (req.query.cursor && !cursor) return res.status(400).json({ message: '无效的分页游标' });
    const source = await transferSource();
    const filter = whereClause(req.query, source);
    const cursorSql = cursor ? `${filter.sql ? 'AND' : 'WHERE'} t.id < ?` : '';
    const [rows] = await pool.query(`${selectSql(source)} ${filter.sql} ${cursorSql}
      ORDER BY t.id DESC LIMIT ?`, [...filter.values, ...(cursor ? [cursor] : []), pageSize + 1]);
    const [[count]] = await pool.query(`SELECT COUNT(*) AS total ${fromSql(source)} ${filter.sql}`, filter.values);
    const hasMore = rows.length > pageSize;
    const visible = rows.slice(0, pageSize);
    return res.json({ available: true, source_kind: 'business', message: SOURCE_MESSAGE,
      items: visible.map(formatRow), total: Number(count?.total || 0), has_more: hasMore,
      next_cursor: hasMore ? Buffer.from(String(visible[visible.length - 1].id)).toString('base64url') : null });
  } catch (error) {
    console.error('交易穿透监管列表失败:', error);
    return res.status(error.message.startsWith('无效') ? 400 : 500).json({ message: error.message || '查询监管交易列表失败' });
  }
});

router.get('/transactions/:identifier', async (req, res) => {
  try {
    const source = await transferSource();
    const [rows] = await pool.query(`${selectSql(source)}
      WHERE t.transaction_id = ? OR ${source.hash} = ? LIMIT 1`,
    [req.params.identifier, req.params.identifier]);
    if (!rows[0]) return res.status(404).json({ message: '交易不存在' });
    return res.json(formatRow(rows[0]));
  } catch (error) {
    console.error('交易穿透监管详情失败:', error);
    return res.status(500).json({ message: error.message || '查询交易详情失败' });
  }
});

// 原型的监管处置由独立数据服务负责，不能把它写入业务交易状态。
router.patch('/transactions/:identifier/status', (_req, res) => res.status(409).json({
  message: '本地业务库不支持修改监管状态，请接入原型交易监管数据服务',
}));

module.exports = router;
