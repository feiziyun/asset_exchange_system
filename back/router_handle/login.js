// 导入数据库
const db = require('../db/index.js');
// 导入加密中间件
const bcrypt = require('bcryptjs');
// 导入jwt，用于生成token
const jwt = require('jsonwebtoken')
// 导入jwt配置文件，用于加密解密
const jwtconfig = require('../jwt_config/index.js')

exports.register = (req, res) => {
  const regInfo = req.body;
  //数据为空
  if(!regInfo.account || !regInfo.password){
    return res.send({
      status:1,
      message:'账户or密码不能为空'
    })
  }
  if (!['buyer', 'seller'].includes(String(regInfo.identity || ''))) {
    return res.send({
      status: 1,
      message: '普通注册仅支持买家和卖家，监管/审计账号请由管理员创建'
    })
  }
  //数据已存在
  const sql = 'select * from users where account = ?';
  //参数三是处理结果的回调函数
  db.query(sql, regInfo.account, (err, results)=>{
    if (err) return res.cc(err);
    if(results.length>0){
      return res.send({
        status:1,
        message:'账号已存在'
      })
    }
    //对密码加密  中间件 bcrypt.js
    const hashedPassword = bcrypt.hashSync(regInfo.password, 10);
    const sql1 = 'insert into users set ?';
    const identity = regInfo.identity
    const create_time = new Date();
    db.query(sql1,{
      account:regInfo.account,
      password:hashedPassword,
      identity,
      create_time,
      status:0
    },(insertErr, insertResults)=>{
      if (insertErr) return res.cc(insertErr);
      if(insertResults.affectedRows !==1){
        return res.send({
          status:1,
          message:'注册用户失败，请稍后再试'
        })
      };
      return res.send({
        status:0,
        message:'注册成功'
      });
    })
  })
}

exports.login = (req, res) => {
  const logInfo = req.body;
  const sql = 'select * from users where account = ?';
  db.query(sql, logInfo.account, (err, results)=>{
    //执行sql语句失败（数据库断开）
    if(err) return res.cc(err);
    if(results.length !== 1) return res.cc('账号不存在');
    const compareResult = bcrypt.compareSync(logInfo.password, results[0].password)
    if(!compareResult) return res.cc('密码错误');
    if(results[0].status ==1)return res.cc('账号被冻结');
    const rawIdentity = String(results[0].identity || '').toLowerCase()
    const normalizedIdentity = ['buyer', 'seller', 'admin', 'regulator', 'auditor'].includes(rawIdentity)
      ? rawIdentity
      : 'buyer'
    const user = {
      id: results[0].id,
      account: results[0].account,
      identity: normalizedIdentity,
      auditor_target: results[0].auditor_target || null,
      name: results[0].name || '',
      email: results[0].email || '',
      department: results[0].department || '',
      sex: results[0].sex || '',
      status: results[0].status,
    }
    const accessTokenStr = jwt.sign(user, jwtconfig.accessSecretKey, {
      expiresIn:'7h'
    })
    const businessTokenStr = jwt.sign(user, jwtconfig.businessSecretKey, {
      expiresIn:'7h'
    })
    res.send({
      results: {
        ...results[0],
        identity: normalizedIdentity
      },
      identity: normalizedIdentity,
      status:0,
      message:'登陆成功',
      token:'Bearer '+ businessTokenStr,
      accessToken:'Bearer ' + accessTokenStr,
    })
  })
}



// 找回密码一、验证账号和邮箱
exports.verifyAccountEmail = (req, res) => {
  const { account, email } = req.body;
  const sql = 'select email from users where account = ?';
  db.query(sql, [account, email], (err, results) => {
    if (err) return res.cc(err);
    if (results.length !== 1) {
      return res.send({
        status: 1,
        message: '账号不存在'
      });
    }
    if (results[0].email !== email) {
      return res.send({
        status: 1,
        message: '账号和邮箱不匹配，请检查后重试'
      });
    }
    const token = jwt.sign({account}, jwtconfig.resetSecretKey, { expiresIn: '10m' });
    res.send({
      status: 0,
      message: '验证成功！',
      token: 'Bearer ' + token
    })
  })
}

// 找回密码二、重置密码
exports.resetPassword = (req, res) => {
  const { account, newPassword } = req.body
  const sql = 'update users set password = ? where account = ?';
  const newHashedPassword = bcrypt.hashSync(newPassword, 10);
  db.query(sql, [newHashedPassword, account], (err, results) => {
    if (err) return res.cc(err);
    if (results.affectedRows !== 1) {
      return res.send({
        status: 1,
        message: '重置密码失败，请稍后再试'
      });
    }
    res.send({
      status: 0,
      message: '重置密码成功！',
    })
  })
} 
    
