const { io } = require('socket.io-client');

const API_URL = process.env.SERVER_URL || 'http://localhost:5000';

const loginOrRegister = async (username, email, password) => {
  const loginRes = await fetch(`${API_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: email, password }),
  });

  const loginData = await loginRes.json();
  if (loginRes.ok && loginData.data?.accessToken) {
    return { token: loginData.data.accessToken, user: loginData.data.user };
  }

  const regRes = await fetch(`${API_URL}/api/v1/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, email, password }),
  });

  const regData = await regRes.json();
  if (regRes.ok && regData.data?.accessToken) {
    return { token: regData.data.accessToken, user: regData.data.user };
  }

  throw new Error(regData.message || loginData.message || 'Auth failed');
};

const run = async () => {
  console.log('[SIM] Authenticating test players...');
  const p1 = await loginOrRegister('sim_rival_one', 'sim_one@example.com', 'Pass123456!');
  const p2 = await loginOrRegister('sim_rival_two', 'sim_two@example.com', 'Pass123456!');
  console.log(`[SIM] Player 1: ${p1.user.username} (${p1.user.rating} RR)`);
  console.log(`[SIM] Player 2: ${p2.user.username} (${p2.user.rating} RR)`);

  const s1 = io(API_URL, { auth: { token: p1.token } });
  const s2 = io(API_URL, { auth: { token: p2.token } });

  let connectedCount = 0;
  let activeBattleId = null;

  const onConnect = () => {
    connectedCount++;
    if (connectedCount === 2) {
      console.log('[SIM] Both sockets connected. Joining matchmaking queue...');
      s1.emit('queue_join', { mode: 'ranked_1v1' }, (ack) => {
        console.log(`[SIM] S1 queue_join ack:`, ack);
      });
      s2.emit('queue_join', { mode: 'ranked_1v1' }, (ack) => {
        console.log(`[SIM] S2 queue_join ack:`, ack);
      });
    }
  };

  s1.on('connect', () => {
    console.log(`[SIM] S1 connected (${s1.id})`);
    onConnect();
  });

  s2.on('connect', () => {
    console.log(`[SIM] S2 connected (${s2.id})`);
    onConnect();
  });

  s1.on('queue_status', (data) => {
    console.log('[SIM] S1 queue_status:', data);
  });

  s2.on('queue_status', (data) => {
    console.log('[SIM] S2 queue_status:', data);
  });

  s1.on('match_found', (data) => {
    console.log('[SIM] S1 match_found:', data.battleId, 'vs', data.opponent.username, data.ratingPreview);
    activeBattleId = data.battleId;
    s1.emit('match_accept', { battleId: data.battleId });
  });

  s2.on('match_found', (data) => {
    console.log('[SIM] S2 match_found:', data.battleId, 'vs', data.opponent.username, data.ratingPreview);
    activeBattleId = data.battleId;
    s2.emit('match_accept', { battleId: data.battleId });
  });

  s1.on('battle_start', async (data) => {
    console.log('[SIM] S1 battle_start:', data.battleId, 'Problem:', data.problem.title);
    s1.emit('battle_chat', { battleId: data.battleId, text: 'gl hf!' });

    setTimeout(async () => {
      console.log('[SIM] Player 1 submitting solution...');
      const code = data.problem.starterCode?.javascript || data.problem.starterCode?.python;
      const lang = data.problem.starterCode?.javascript ? 'javascript' : 'python';

      const res = await fetch(`${API_URL}/api/v1/battles/${data.battleId}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${p1.token}`,
        },
        body: JSON.stringify({
          language: lang,
          code,
        }),
      });

      const resData = await res.json();
      console.log('[SIM] Submit HTTP response:', resData);
    }, 1500);
  });

  s2.on('battle_start', (data) => {
    console.log('[SIM] S2 battle_start:', data.battleId, 'Problem:', data.problem.title);
  });

  s1.on('battle_chat_message', (msg) => {
    console.log(`[SIM] S1 chat received: [${msg.from}]: ${msg.text}`);
  });

  s2.on('battle_chat_message', (msg) => {
    console.log(`[SIM] S2 chat received: [${msg.from}]: ${msg.text}`);
  });

  s1.on('submission_result', (result) => {
    console.log('[SIM] S1 submission_result:', result);
  });

  s2.on('opponent_progress', (prog) => {
    console.log('[SIM] S2 opponent_progress:', prog);
  });

  const onEnd = (eventSource, data) => {
    console.log(`[SIM] ${eventSource} battle_end:`, data);
    setTimeout(() => {
      console.log('[SIM] Battle simulation concluded successfully.');
      s1.disconnect();
      s2.disconnect();
      process.exit(0);
    }, 500);
  };

  s1.on('battle_end', (data) => onEnd('S1', data));
  s2.on('battle_end', (data) => onEnd('S2', data));
};

run().catch((err) => {
  console.error('[SIM] Error:', err);
  process.exit(1);
});
