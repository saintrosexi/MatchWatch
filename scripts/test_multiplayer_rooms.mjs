// MatchWatch 3 — Comprehensive Realtime Multiplayer Rooms Test Suite
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
import { isFirebaseConfigured, app, database } from '../src/firebase.js';

console.log('🚀 Running MatchWatch 3 Multiplayer Rooms Test Suite...\n');

let passedTests = 0;
let totalTests = 0;

function test(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✅ [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${name}`);
    console.error(err);
    process.exitCode = 1;
  }
}

async function asyncTest(name, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`  ✅ [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${name}`);
    console.error(err);
    process.exitCode = 1;
  }
}

// ---------------------------------------------------------------------------
// 1. Firebase Client Configuration
// ---------------------------------------------------------------------------
test('1.1 Firebase client exports valid config and instances', () => {
  assert.equal(typeof isFirebaseConfigured, 'function');
  const configured = isFirebaseConfigured();
  assert.equal(configured, true, 'isFirebaseConfigured() must return true when .env is loaded');
  assert.ok(app, 'Firebase app instance should be initialized');
  assert.ok(database, 'Firebase Realtime Database instance should be initialized');
});

// ---------------------------------------------------------------------------
// 2. Room Code Generation
// ---------------------------------------------------------------------------
test('2.1 generateRoomCode produces valid 4-character uppercase alphanumeric codes', () => {
  for (let i = 0; i < 50; i++) {
    const code = generateRoomCode();
    assert.equal(typeof code, 'string', 'Code must be a string');
    assert.equal(code.length, 4, `Code must be exactly 4 characters, got "${code}"`);
    assert.match(code, /^[A-Z0-9]{4}$/, `Code "${code}" must contain only uppercase alphanumeric characters`);
  }
});

// ---------------------------------------------------------------------------
// 3. Parameter Polymorphism & Initial State
// ---------------------------------------------------------------------------
await asyncTest('3.1 createRoom with Object parameters ({ hostUser, preset })', async () => {
  const host = {
    id: 'user_host_obj',
    name: 'Елена (Хост)',
    avatar: '👑',
    likes: [1, 2, 3]
  };

  const room = await createRoom({ hostUser: host, preset: 'popcorn_party' });

  assert.ok(room, 'Room must be created');
  assert.equal(room.preset, 'popcorn_party');
  assert.equal(room.status, 'waiting');
  assert.match(room.code, /^[A-Z0-9]{4}$/);
  assert.equal(room.members.length, 1);
  assert.equal(room.members[0].id, 'user_host_obj');
  assert.equal(room.members[0].isHost, true);
  assert.deepEqual(room.members[0].likes, [1, 2, 3]);

  // Verify compromise deck is 25 full movie items
  assert.ok(Array.isArray(room.deck), 'Room deck must be an array');
  assert.equal(room.deck.length, 25, `Deck must contain exactly 25 movies, got ${room.deck.length}`);
  assert.ok(room.deck[0].id, 'Deck item must have an id');
  assert.ok(room.deck[0].title || room.deck[0].titleRu, 'Deck item must have a title');

  // Verify getActiveRoom matches created room
  const active = getActiveRoom();
  assert.equal(active.code, room.code);

  await leaveRoom();
  assert.equal(getActiveRoom(), null);
});

await asyncTest('3.2 createRoom with Positional parameters (user, preset)', async () => {
  const host = {
    id: 'user_host_pos',
    name: 'Дмитрий (Хост)',
    avatar: '🍿',
    likes: [4, 5, 6]
  };

  const room = await createRoom(host, 'noir_thriller');

  assert.ok(room, 'Room must be created');
  assert.equal(room.preset, 'noir_thriller');
  assert.equal(room.members[0].id, 'user_host_pos');
  assert.equal(room.members[0].name, 'Дмитрий (Хост)');
  assert.equal(room.deck.length, 25);

  await leaveRoom();
});

// ---------------------------------------------------------------------------
// 4. Presence Tracking & Deck Synchronization (Host + Guest)
// ---------------------------------------------------------------------------
await asyncTest('4.1 Host creates room and Guest joins with object params ({ roomCode, user })', async () => {
  const host = {
    id: 'host_session_1',
    name: 'Алиса',
    avatar: '👑',
    likes: [1, 5, 8]
  };

  const guest = {
    id: 'guest_session_1',
    name: 'Борис',
    avatar: '🎬',
    likes: [2, 5, 9]
  };

  const createdRoom = await createRoom({ hostUser: host });
  const roomCode = createdRoom.code;

  let subscriberUpdates = [];
  const unsubscribe = subscribeToRoom((r) => {
    if (r) subscriberUpdates.push({ ...r });
  });

  const joinedRoom = await joinRoom({ roomCode, user: guest });

  assert.equal(joinedRoom.code, roomCode);
  assert.equal(joinedRoom.status, 'active');
  assert.equal(joinedRoom.members.length, 2);

  const memberIds = joinedRoom.members.map((m) => m.id);
  assert.ok(memberIds.includes('host_session_1'), 'Host must be in members');
  assert.ok(memberIds.includes('guest_session_1'), 'Guest must be in members');

  // Deck must be synchronized 25 compromise movies
  assert.equal(joinedRoom.deck.length, 25);

  unsubscribe();
  await leaveRoom();
});

await asyncTest('4.2 Host creates room and Guest joins with positional params (roomCode, user)', async () => {
  const host = { id: 'host_pos_1', name: 'Иван', avatar: '👑', likes: [] };
  const guest = { id: 'guest_pos_1', name: 'Ольга', avatar: '🍿', likes: [] };

  const created = await createRoom(host);
  const joined = await joinRoom(created.code, guest);

  assert.equal(joined.code, created.code);
  assert.equal(joined.members.length, 2);
  assert.equal(joined.status, 'active');

  await leaveRoom();
});

// ---------------------------------------------------------------------------
// 5. Multi-Client Swipe Matching Simulation
// ---------------------------------------------------------------------------
await asyncTest('5.1 Two users swiping in same room: mutual like triggers match celebration synchronously and reactively', async () => {
  const host = { id: 'user_A', name: 'User A', avatar: '👑', likes: [] };
  const guest = { id: 'user_B', name: 'User B', avatar: '🍿', likes: [] };

  const room = await createRoom({ hostUser: host });
  await joinRoom({ roomCode: room.code, user: guest });

  const active = getActiveRoom();
  const testMovie1 = active.deck[0];
  const testMovie2 = active.deck[1];

  let observedMatches = [];
  const unsub = subscribeToRoom((r) => {
    if (r && r.matches) {
      observedMatches = [...r.matches];
    }
  });

  // Step 1: User A likes Movie 1 -> not a mutual match yet
  const resA1 = recordRoomSwipe({ movieId: testMovie1.id, liked: true, userId: 'user_A' });
  assert.equal(resA1, null, 'User A liking alone should return null');
  assert.equal(observedMatches.length, 0, 'Matches array should still be empty');

  // Step 2: User B likes Movie 1 -> MUTUAL MATCH!
  const resB1 = recordRoomSwipe({ movieId: testMovie1.id, liked: true, userId: 'user_B' });
  assert.ok(resB1, 'User B completing mutual like must return match object');
  assert.equal(resB1.matched, true);
  assert.equal(resB1.movieId, testMovie1.id);
  assert.ok(resB1.movie, 'Match object must contain movie metadata');
  assert.equal(resB1.movie.id, testMovie1.id);
  assert.equal(observedMatches.length, 1, 'Subscriber should receive match in room state');

  // Step 3: User A dislikes Movie 2 -> no match
  const resA2 = recordRoomSwipe({ movieId: testMovie2.id, liked: false, userId: 'user_A' });
  assert.equal(resA2, null);

  // Step 4: User B likes Movie 2 -> no match because User A passed
  const resB2 = recordRoomSwipe({ movieId: testMovie2.id, liked: true, userId: 'user_B' });
  assert.equal(resB2, null);
  assert.equal(observedMatches.length, 1, 'Matches count should remain 1');

  // Step 5: Test positional swipe invocation
  const testMovie3 = active.deck[2];
  recordRoomSwipe(testMovie3.id, true, 'user_A');
  const resB3 = recordRoomSwipe(testMovie3.id, true, 'user_B');
  assert.ok(resB3, 'Positional invocation must trigger match on mutual like');
  assert.equal(resB3.movieId, testMovie3.id);
  assert.equal(observedMatches.length, 2, 'Total matches should now be 2');

  unsub();
  await leaveRoom();
});

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log(`\n========================================`);
console.log(`Multiplayer Rooms Tests: ${passedTests} / ${totalTests} Passed`);
console.log(`========================================\n`);

if (passedTests === totalTests) {
  console.log('🎉 All Realtime Room multiplayer tests passed successfully!');
  process.exit(0);
} else {
  console.error(`💥 Some tests failed: ${totalTests - passedTests} failure(s)`);
  process.exit(1);
}
