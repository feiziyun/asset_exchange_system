const express = require('express');
const db = require('../db/index');

const router = express.Router();
const pool = db.promise();

router.get('/overview', async (_req, res) => {
  try {
    const [[stats]] = await pool.query(
      `
        SELECT
          COUNT(*) AS total_transactions,
          SUM(CASE WHEN status IN ('已确认', '已交付', '已完成', 'VM_RUNNING') THEN 1 ELSE 0 END) AS active_transactions,
          SUM(CASE WHEN status IN ('FAILED', '已取消', '退款中', '已退款') THEN 1 ELSE 0 END) AS abnormal_transactions,
          SUM(CASE WHEN DATE(created_at) = CURDATE() THEN 1 ELSE 0 END) AS today_transactions
        FROM transactions
      `
    );

    const [[amount]] = await pool.query(
      `
        SELECT IFNULL(SUM(ao.total_price), 0) AS total_amount
        FROM asset_order ao
        WHERE ao.order_status IN (1, 2, 3)
      `
    );

    return res.send({
      status: 0,
      data: {
        totalTransactions: Number(stats?.total_transactions || 0),
        activeTransactions: Number(stats?.active_transactions || 0),
        abnormalTransactions: Number(stats?.abnormal_transactions || 0),
        todayTransactions: Number(stats?.today_transactions || 0),
        totalAmount: Number(amount?.total_amount || 0),
      },
    });
  } catch (error) {
    return res.status(500).send({ status: 1, message: error.message || '查询监管总览失败' });
  }
});

router.get('/transactions', async (req, res) => {
  try {
    const page = Math.max(Number(req.query.page || 1), 1);
    const pageSize = Math.min(Math.max(Number(req.query.pageSize || req.query.page_size || 10), 1), 100);
    const offset = (page - 1) * pageSize;
    const keyword = String(req.query.keyword || '').trim();
    const where = [];
    const params = [];

    if (keyword) {
      where.push('(t.transaction_id LIKE ? OR t.buyer_address LIKE ? OR t.seller_address LIKE ? OR da.asset_name LIKE ?)');
      params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const [rows] = await pool.query(
      `
        SELECT
          t.transaction_id AS txHash,
          t.order_no,
          t.asset_id,
          da.asset_name,
          t.buyer_address,
          t.seller_address,
          t.status,
          t.pc_type,
          t.created_at,
          t.updated_at,
          ao.total_price,
          ao.buy_qty
        FROM transactions t
        LEFT JOIN digital_asset da ON t.asset_id = da.id
        LEFT JOIN asset_order ao ON t.order_no = ao.order_no
        ${whereSql}
        ORDER BY t.updated_at DESC, t.id DESC
        LIMIT ? OFFSET ?
      `,
      [...params, pageSize, offset]
    );

    const [[count]] = await pool.query(
      `
        SELECT COUNT(*) AS total
        FROM transactions t
        LEFT JOIN digital_asset da ON t.asset_id = da.id
        ${whereSql}
      `,
      params
    );

    return res.send({
      status: 0,
      data: {
        list: rows,
        total: Number(count?.total || 0),
        page,
        pageSize,
      },
    });
  } catch (error) {
    return res.status(500).send({ status: 1, message: error.message || '查询监管交易列表失败' });
  }
});

router.get('/transactions/:txHash', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `
        SELECT
          t.*,
          da.asset_name,
          da.description,
          ao.total_price,
          ao.buy_qty,
          dc.contract_id,
          dc.contract_name,
          dc.pc_type AS contract_pc_type
        FROM transactions t
        LEFT JOIN digital_asset da ON t.asset_id = da.id
        LEFT JOIN asset_order ao ON t.order_no = ao.order_no
        LEFT JOIN digital_contracts dc ON t.transaction_id = dc.transaction_id
        WHERE t.transaction_id = ?
        LIMIT 1
      `,
      [req.params.txHash]
    );

    if (!rows[0]) {
      return res.status(404).send({ status: 1, message: '交易不存在' });
    }

    return res.send({ status: 0, data: rows[0] });
  } catch (error) {
    return res.status(500).send({ status: 1, message: error.message || '查询交易详情失败' });
  }
});

router.patch('/transactions/:txHash/status', async (req, res) => {
  try {
    const status = String(req.body?.status || '').trim();
    if (!status) {
      return res.status(400).send({ status: 1, message: '缺少 status' });
    }

    const [result] = await pool.query(
      `
        UPDATE transactions
        SET status = ?, updated_at = NOW()
        WHERE transaction_id = ?
      `,
      [status, req.params.txHash]
    );

    if (!result?.affectedRows) {
      return res.status(404).send({ status: 1, message: '交易不存在' });
    }

    return res.send({ status: 0, message: '状态更新成功' });
  } catch (error) {
    return res.status(500).send({ status: 1, message: error.message || '更新交易状态失败' });
  }
});

module.exports = router;
