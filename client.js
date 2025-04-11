const WebSocket = require('ws');

// WebSocket 클라이언트 생성
const ws = new WebSocket('ws://localhost:8080');

// 연결 이벤트 처리
ws.on('open', () => {
  console.log('서버에 연결되었습니다');
  
  // 서버에 메시지 전송
  ws.send('안녕하세요 서버!');
  
  // 5초마다 메시지 전송
  setInterval(() => {
    ws.send(`현재 시간: ${new Date().toISOString()}`);
  }, 5000);
});

// 메시지 수신 이벤트 처리
ws.on('message', (message) => {
  console.log(`서버로부터 수신: ${message}`);
});

// 에러 이벤트 처리
ws.on('error', (error) => {
  console.error('WebSocket 에러:', error);
});

// 연결 종료 이벤트 처리
ws.on('close', () => {
  console.log('서버와의 연결이 종료되었습니다');
});