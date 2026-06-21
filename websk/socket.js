const WebSocket = require('ws');
const http = require('http');
const express = require('express');

const app = express();

// 필요한 API 라우트나 미들웨어 추가 가능
// app.use(...);

const server = http.createServer(app);

const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
  console.log('클라이언트 연결됨');

  ws.on('message', (message) => {
    console.log('받은 메시지:', message);

    // 받은 메시지를 연결된 모든 클라이언트에게 브로드캐스팅
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  });

  ws.on('close', () => {
    console.log('클라이언트 연결 종료');
  });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`서버 실행 중 -> http://localhost:${PORT}`);
  console.log('Express API + WebSocket 서버가 같은 포트에서 동시 실행 중입니다.');
});