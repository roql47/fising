const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');

const clients = new Map(); // WebSocket → 닉네임
const userRooms = new Map(); // WebSocket → 방 이름
const inventories = new Map(); // 닉네임 → { 물고기: 수량 }
const userGold = new Map(); // 닉네임 → 골드

const fishTable = [
  { name: '타코문어', chance: 0.4, price: 10 },
  { name: '풀고등어', chance: 0.3, price: 5 },
  { name: '경단붕어', chance: 0.2, price: 20 },
  { name: '버터오징어', chance: 0.1, price: 15 }
];

function getRandomFish() {
  const rand = Math.random();
  let total = 0;
  for (const fish of fishTable) {
    total += fish.chance;
    if (rand < total) return fish;
  }
  return fishTable[0];
}

function getTime() {
  return new Date().toLocaleTimeString();
}

function broadcast(room, messageObj) {
  const json = JSON.stringify(messageObj);
  for (const [client] of clients) {
    if (client.readyState === WebSocket.OPEN && userRooms.get(client) === room) {
      client.send(json);
    }
  }
}

function saveLog(room, content) {
  const logDir = path.join(__dirname, 'chatlogs');
  if (!fs.existsSync(logDir)) fs.mkdirSync(logDir);
  const filePath = path.join(logDir, `${room}.txt`);
  fs.appendFileSync(filePath, content + '\n');
}

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('웹소켓 채팅 서버 실행 중');
});

const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
  ws.send(JSON.stringify({ type: 'request_nickname' }));

  ws.on('message', (data) => {
    let parsed;
    try {
      parsed = JSON.parse(data);
    } catch {
      return;
    }

    if (parsed.type === 'join') {
      const nickname = parsed.nickname;
      const room = parsed.room;

      // 같은 닉네임으로 연결된 기존 소켓 종료 및 제거
      for (const [client, name] of clients.entries()) {
        if (name === nickname && client !== ws) {
          client.send(JSON.stringify({ text: `⚠️ 다른 위치에서 접속되어 연결이 종료됩니다.` }));
          clients.delete(client);
          userRooms.delete(client);
          client.terminate(); // 즉시 종료
        }
      }

      // 새 연결 등록
      clients.set(ws, nickname);
      userRooms.set(ws, room);
      inventories.set(nickname, inventories.get(nickname) || {});
      userGold.set(nickname, userGold.get(nickname) || 0);

      const joinMsg = `[${getTime()}] 💬 ${nickname}님이 입장했습니다.`;
      broadcast(room, { text: joinMsg });
      return;
    }

    if (parsed.type === 'message') {
      const sender = clients.get(ws);
      const room = userRooms.get(ws);
      const text = parsed.text.trim();
      const time = getTime();

      // 🎣 낚시
      if (text === '낚시하기') {
        const fish = getRandomFish();
        const inv = inventories.get(sender);
        inv[fish.name] = (inv[fish.name] || 0) + 1;
        const result = `[${time}] 🎣 ${sender}님이 '${fish.name}'(을/를) 낚았습니다!`;
        saveLog(room, result);
        broadcast(room, { text: result });
        return;
      }

      // 💰 판매
      if (text === '판매') {
        const inv = inventories.get(sender);
        let earned = 0;
        for (const fish of fishTable) {
          const count = inv[fish.name] || 0;
          earned += count * fish.price;
          inv[fish.name] = 0;
        }
        userGold.set(sender, userGold.get(sender) + earned);
        const result = `[${time}] 💰 ${sender}님이 ${earned}골드를 획득했습니다!`;
        saveLog(room, result);
        broadcast(room, { text: result });
        return;
      }

      // 📦 인벤토리
      if (text === '인벤토리') {
        const inv = inventories.get(sender);
        const gold = userGold.get(sender);
        let summary = `[${time}] 📦 ${sender}님의 인벤토리:\n`;
        for (const fish of fishTable) {
          summary += ` - ${fish.name}: ${inv[fish.name] || 0}마리\n`;
        }
        summary += ` - 💰 골드: ${gold}G`;
        broadcast(room, { text: summary });
        return;
      }

      // 일반 채팅 메시지
      const formatted = `[${time}] ${sender}: ${text}`;
      saveLog(room, formatted);
      broadcast(room, { text: formatted });
    }
  });

  ws.on('close', () => {
    const nickname = clients.get(ws);
    const room = userRooms.get(ws);
    clients.delete(ws);
    userRooms.delete(ws);
    if (nickname && room) {
      const exitMsg = `[${getTime()}] ❌ ${nickname}님이 퇴장했습니다.`;
      broadcast(room, { text: exitMsg });
    }
  });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`서버가 포트 ${PORT}에서 실행 중입니다`);
});
