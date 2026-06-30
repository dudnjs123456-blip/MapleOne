const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const http = require('http');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');  // JWT 추가
const axios = require('axios');  // CommonJS 방식
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: 'tkdalsdl135?',
  database: 'user_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// 비밀키 (실서비스 시에는 환경변수로 관리하세요)
const SECRET_KEY = 'your-very-secure-secret-key';

// 회원가입 API: 비밀번호 해시 후 저장
app.post('/api/register', async (req, res) => {
  const { newUsername, newPassword, ipAddress, datetime } = req.body;

  // 개발용 평문 비밀번호 로그 (실서비스 시 제거 권장)
  console.log('회원가입 요청받음 - 아이디:', newUsername, ', 비밀번호:', newPassword, ', IP:', ipAddress, ', 가입시간:', datetime);

  try {
    // 중복 사용자 확인
    const [existingUsers] = await pool.execute(
      'SELECT User_Id FROM new_table WHERE User_Id = ?',
      [newUsername]
    );

    if (existingUsers.length > 0) {
      return res.status(409).json({ message: '이미 존재하는 아이디입니다.' });
    }

    // 비밀번호 해시
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // 사용자 정보 저장
    const sql = 'INSERT INTO new_table (User_Id, User_password, Ipadress, onday) VALUES (?, ?, ?, ?)';
    await pool.execute(sql, [newUsername, hashedPassword, ipAddress, datetime]);

    res.status(201).json({ message: '회원가입이 성공적으로 완료되었습니다!' });
  } catch (error) {
    console.error('회원가입 오류:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// 로그인 API: 비밀번호 검증 후 JWT 토큰 발급 및 콘솔 출력
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    // User_password와 nxAPI 컬럼을 모두 조회
    const [rows] = await pool.execute(
      'SELECT User_password, nxAPI FROM new_table WHERE User_Id = ?',
      [username]
    );

    if (rows.length === 0) {
      return res.status(401).json({ message: '사용자가 존재하지 않습니다.' });
    }

    const hashedPassword = rows[0].User_password;
    const nxAPIValue = rows[0].nxAPI;  // 추가로 가져온 칼럼

    const isMatch = await bcrypt.compare(password, hashedPassword);

    if (!isMatch) {
      return res.status(401).json({ message: '비밀번호가 올바르지 않습니다.' });
    }

    // JWT 토큰 발급
    const token = jwt.sign({ username }, SECRET_KEY, { expiresIn: '1h' });

    console.log('로그인 성공!');
    console.log('아이디:', username);
    console.log('발급된 토큰:', token);

    // 토큰, username, nxAPI 컬럼값 모두 클라이언트에 전달
    res.status(200).json({
      message: '로그인 성공!',
      token,
      username,
      nxAPI: nxAPIValue,  // 이 부분이 추가됨
    });
  } catch (error) {
    console.error('로그인 오류:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// JWT 검증 미들웨어 예시
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  // Bearer TOKEN 형식에서 토큰 추출
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ message: '토큰이 없습니다. 인증 실패' });

  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) return res.status(403).json({ message: '토큰이 유효하지 않습니다.' });

    req.user = user; // 검증된 사용자 정보 저장
    next();
  });
}

// 보호 라우트 예시 (로그인 필요 API)
app.get('/api/protected', authenticateToken, (req, res) => {
  res.json({ message: `토큰 인증 성공! 환영합니다, ${req.user.username}님.` });
});

app.get('/', (req, res) => {
  res.send('서버 정상 작동 중입니다.');
});

// 기본 캐릭터 리스트 API
app.post('/api/maple/character', async (req, res) => {
  const { apiKey } = req.body;
  if (!apiKey) return res.status(400).json({ message: 'API 키 필요' });

  try {
    const url = 'https://open.api.nexon.com/maplestory/v1/character/list';
    const headers = { 'x-nxopen-api-key': apiKey, Accept: 'application/json' };
    const response = await axios.get(url, { headers });
    res.json({ success: true, data: response.data });
  } catch (err) {
    console.error('기본 캐릭터 리스트 조회 실패:', err.message);
    res.status(500).json({ message: '기본 캐릭터 리스트 조회 실패', error: err.message });
  }
});

// 상세 캐릭터 정보 API
app.post('/api/maple/character/basic', async (req, res) => {
  const { apiKey, ocidList } = req.body;

  if (!apiKey) return res.status(400).json({ message: 'API 키 필요' });
  if (!Array.isArray(ocidList) || !ocidList.length)
    return res.status(400).json({ message: 'ocid 리스트 필요' });

  // console.log('[basic API] 수신한 apiKey:', apiKey);
  // console.log(`[basic API] 수신한 ocid 리스트 (${ocidList.length}개):`, ocidList);

  const headers = { 'x-nxopen-api-key': apiKey, Accept: 'application/json' };

  try {
    const validOcids = ocidList.filter(ocid => typeof ocid === 'string' && ocid.trim() !== '');

    const promises = validOcids.map(ocid =>
      axios
        .get('https://open.api.nexon.com/maplestory/v1/character/basic', {
          headers,
          params: { ocid },
        })
        .then(resp => {
          // console.log(`[basic API] ocid: ${ocid} 응답 데이터`, resp.data);
          return { ocid, data: resp.data };
        })
        .catch(error => {
          // console.error(`[basic API] ocid: ${ocid} 호출 실패:`, error.response?.data || error.message);
          return { ocid, data: null };
        })
    );

    const details = await Promise.all(promises);

    res.json({ success: true, details });
  } catch (error) {
    // console.error('[basic API] 상세 호출 실패:', error.message);
    res.status(500).json({ message: '상세 호출 실패', error: error.message });
  }
});


// 기존 require 구문은 그대로 유지

app.get('/force', async (req, res) => {
  const { apiKey, date } = req.query;
  console.log('force 요청 쿼리 파라미터:', req.query);
  if (!apiKey || !date) {
    return res.status(400).json({ message: 'apiKey와 date는 필수입니다.' });
  }

  try {
    const url = 'https://open.api.nexon.com/maplestory/v1/history/starforce';
    const headers = {
      'x-nxopen-api-key': apiKey,
      Accept: 'application/json',
    };

    // cursor는 빈 문자열로 고정
    const params = {
      count: 999,
      date,
      cursor: '',
    };

    const response = await axios.get(url, { headers, params });
    res.json({ success: true, data: response.data });
  } catch (error) {
    console.error('스타포스 결과 조회 실패:', error.response?.data || error.message);
    res.status(500).json({ message: '스타포스 결과 조회 실패', error: error.message });
  }
});


const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
  console.log(`서버가 포트 ${PORT}에서 정상 실행 중입니다.`);
});