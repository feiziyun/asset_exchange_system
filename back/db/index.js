const mysql = require('mysql2');

//创建连接
const db = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'autonomous_asset_exchange',
  charset: 'utf8mb4',
})

//对外暴露
module.exports = db;
