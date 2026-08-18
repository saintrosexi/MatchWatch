// Adversarial edge-case tester for realtimeRooms.js
import assert from 'node:assert/strict';
import {
  generateRoomCode,
  createRoom,
  joinRoom,
  leaveRoom,
  recordRoomSwipe,
  subscribeToRoom,
  getActiveRoom,
  getCurrentUser
} from '../src/engine/realtimeRooms.js';

console.log('🧪 Starting Adversarial Edge Case Suite...\n');

let passed = 0;
let total = 0;

function run(name, fn) {
  total++;
  try {
    fn();
    console.log(`  ✅ [PASS] ${name}`);
    passed++;
  } catch (e) {
    console.error(`  ❌ [FAIL] ${name}`, e);
  }
}

async function runAsync(name, fn) {
  total++;
  try {
    await fn();
    console.log(`  ✅ [PASS] ${name}`);
    passed++;
  } catch (e) {
    console.error(`  ❌ [FAIL] ${name}`, e);
  }
}

// 1. generateRoomCode randomness and characters
run('Room code generation 1000 iterations uniqueness & valid alphabet', () => {
  const codes = new Set();
  const validChars = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}$/;
  for (let i = 0; i < 1000; i++) {
    const c = generateRoomCode();
    assert.match(c, validChars);
    codes.add(c);
  }
  // With 32^4 = 1,048,576 combinations, 1000 random codes should have > 980 unique
  assert.ok(codes.size > 980, `Expected >980 unique codes, got ${codes.size}`);
});

// 2. recordRoomSwipe with no active room
run('recordRoomSwipe when no active room returns null gracefully', () => {
  assert.equal(getActiveRoom(), null);
  const res = recordRoomSwipe({ movieId: 1, liked: true, userId: 'u1' });
  assert.equal(res, null);
});

// 3. createRoom with null/empty inputs
await runAsync('createRoom with null/empty inputs generates valid fallback room', async () => {
  const room = await createRoom(null);
  assert.ok(room);
  assert.match(room.code, /^[A-Z0-9]{4}$/);
  assert.equal(room.members.length, 1);
  assert.equal(room.deck.length, 25);
  await leaveRoom();
});

// 4. Duplicate likes by same user do not duplicate in member.likes or matches
await runAsync('Duplicate likes by same user are idempotent', async () => {
  const host = { id: 'h1', name: 'Host', likes: [] };
  const guest = { id: 'g1', name: 'Guest', likes: [] };
  const room = await createRoom({ hostUser: host });
  await joinRoom({ roomCode: room.code, user: guest });

  // Like movie 10 three times
  recordRoomSwipe({ movieId: 10, liked: true, userId: 'h1' });
  recordRoomSwipe({ movieId: 10, liked: true, userId: 'h1' });
  recordRoomSwipe({ movieId: 10, liked: true, userId: 'h1' });

  const active = getActiveRoom();
  const hostMember = active.members.find(m => m.id === 'h1');
  const countOf10 = hostMember.likes.filter(id => id === 10).length;
  assert.equal(countOf10, 1, 'Likes array must not contain duplicate movie IDs');

  // Guest likes movie 10
  const match1 = recordRoomSwipe({ movieId: 10, liked: true, userId: 'g1' });
  assert.ok(match1, 'Should trigger match');

  // Guest likes movie 10 again -> should NOT trigger a second match
  const match2 = recordRoomSwipe({ movieId: 10, liked: true, userId: 'g1' });
  assert.equal(match2, null, 'Duplicate like must not trigger duplicate match');
  assert.equal(getActiveRoom().matches.length, 1);

  await leaveRoom();
});

// 5. Non-existent movie ID matching
await runAsync('Matching movie ID not in database creates safe fallback movie item', async () => {
  const host = { id: 'h2', name: 'Host 2', likes: [] };
  const guest = { id: 'g2', name: 'Guest 2', likes: [] };
  const room = await createRoom({ hostUser: host });
  await joinRoom({ roomCode: room.code, user: guest });

  recordRoomSwipe({ movieId: 9999999, liked: true, userId: 'h2' });
  const match = recordRoomSwipe({ movieId: 9999999, liked: true, userId: 'g2' });

  assert.ok(match);
  assert.equal(match.movieId, 9999999);
  assert.ok(match.movie);
  assert.equal(match.movie.id, 9999999);

  await leaveRoom();
});

// 6. Subscription safety
run('subscribeToRoom with invalid arguments does not throw and returns noop un按ub', () => {
  const unsub1 = subscribeToRoom(null);
  assert.equal(typeof unsub1, 'function');
  unsub1();

  const unsub2 = subscribeToRoom('INVALID_CODE', null);
  assert.equal(typeof unsub2, 'function');
  unsub2();
});

// 7. Multiple unsubscriptions do not throw
await runAsync('Multiple calls to unsubscribe are idempotent', async () => {
  const room = await createRoom({ hostUser: { id: 'h3', name: 'H3' } });
  let count = 0;
  const unsub = subscribeToRoom((r) => { count++; });
  unsub();
  unsub();
  unsub();
  await leaveRoom();
});

// 8. Leave room when already null
await runAsync('leaveRoom when no room is active is safe', async () => {
  await leaveRoom();
  await leaveRoom(null, null);
  assert.equal(getActiveRoom(), null);
});

console.log(`\nAdversarial Results: ${passed} / ${total} Passed`);
if (passed === total) {
  process.exit(0);
} else {
  process.exit(1);
}
