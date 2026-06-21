const express = require('express');
const cors = require('cors');
const axios = require('axios');
const http = require('http');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = 8000;

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
http.createServer(app).listen(PORT, () => {
  console.log(`서버 http://localhost:${PORT} 에서 실행 중`);
});