// MatchWatch 3 — Empirical Challenger Stress & Edge-Case Test Harness
// Milestone M3: Realtime Rooms Engine Empirical Verification

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
import { movies } from '../src/data/movies.js';

console.log('╔══════════════════════════════════════════════════════════════════╗');
console.log('║  MatchWatch 3 — Empirical Challenger Stress & Edge-Case Harness  ║');
console.log('║  Target: src/engine/realtimeRooms.js                             ║');
console.log('╚══════════════════════════════════════════════════════════════════╝\n');

let totalAssertions = 0;
let passedAssertions = 0;
let totalSuites = 0;
let passedSuites = 0;
const failures = [];

function recordPass() {
  totalAssertions++;
  passedAssertions++;
}

function recordFail(suiteName, error) {
  totalAssertions++;
  failures.push({ suite: suiteName, error: error.message || String(error), stack: error.stack });
  console.error(`  ❌ [FAIL] ${suiteName}: ${error.message}`);
}

async function runSuite(name, fn) {
  totalSuites++;
  console.log(`\n▶ Running Suite ${totalSuites}: ${name}`);
  const start = performance.now();
  try {
    await fn();
    const elapsed = (performance.now() - start).toFixed(2);
    passedSuites++;
    console.log(`  ✅ [PASS] Suite ${totalSuites} completed in ${elapsed}ms`);
  } catch (err) {
    const elapsed = (performance.now() - start).toFixed(2);
    recordFail(name, err);
  }
}

// ============================================================================
// SUITE 1: 1,000 Room Code Generation & Entropy Stress Test
// ============================================================================
await runSuite('1. 1,000 Room Code Generation, Character Space & Entropy Validation', async () => {
  const allowedCharset = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 32 characters (omits I, O, 0, 1)
  const allowedSet = new Set(allowedCharset.split(''));
  const generatedCodes = [];
  const charFrequency = {};
  allowedCharset.split('').forEach(c => { charFrequency[c] = 0; });

  const totalCodes = 1000;
  for (let i = 0; i < totalCodes; i++) {
    const code = generateRoomCode();

    // 1. Check type and length
    assert.equal(typeof code, 'string', `Code #${i} must be string`);
    assert.equal(code.length, 4, `Code "${code}" must be length 4`);

    // 2. Check strict regex: ^[A-Z0-9]{4}$
    assert.match(code, /^[A-Z0-9]{4}$/, `Code "${code}" must match ^[A-Z0-9]{4}$`);

    // 3. Check character space compliance (no ambiguous chars like I, O, 0, 1)
    for (let ch of code) {
      assert.ok(allowedSet.has(ch), `Code "${code}" contains unexpected char "${ch}"`);
      charFrequency[ch]++;
    }

    generatedCodes.push(code);
    recordPass();
  }

  // 4. Collision analysis
  const uniqueCodes = new Set(generatedCodes);
  const collisions = totalCodes - uniqueCodes.size;
  const collisionRate = ((collisions / totalCodes) * 100).toFixed(2);

  console.log(`     Generated: ${totalCodes} codes | Unique: ${uniqueCodes.size} | Collisions: ${collisions} (${collisionRate}%)`);
  assert.ok(uniqueCodes.size >= 985, `Unique codes (${uniqueCodes.size}) should be >= 985 for 1,000 samples in 1M keyspace`);
  recordPass();

  // 5. Burst testing: 10 consecutive bursts of 100 codes
  let burstCollisionsTotal = 0;
  for (let b = 0; b < 10; b++) {
    const burst = [];
    for (let j = 0; j < 100; j++) {
      burst.push(generateRoomCode());
    }
    const burstUnique = new Set(burst);
    const burstCollisions = 100 - burstUnique.size;
    burstCollisionsTotal += burstCollisions;
  }
  console.log(`     10x100 Burst Collisions Total: ${burstCollisionsTotal} / 1000`);
  assert.ok(burstCollisionsTotal <= 5, `Burst collisions (${burstCollisionsTotal}) should be <= 5`);
  recordPass();

  // 6. Character distribution uniformness check
  const unusedChars = Object.entries(charFrequency).filter(([_, count]) => count === 0);
  assert.equal(unusedChars.length, 0, `All 32 characters should appear across 4,000 generated characters (unused: ${unusedChars.map(u => u[0]).join(',')})`);
  recordPass();
});

// ============================================================================
// SUITE 2: Room Creation Edge Cases & Adversarial Inputs
// ============================================================================
await runSuite('2. Room Creation Under Adversarial, Null, Undefined & Empty Inputs', async () => {
  // Test 2.1: createRoom() with null
  const roomNull = await createRoom(null);
  assert.ok(roomNull, 'createRoom(null) must return valid room');
  assert.match(roomNull.code, /^[A-Z0-9]{4}$/);
  assert.equal(roomNull.members.length, 1);
  assert.equal(roomNull.deck.length, 25);
  assert.equal(roomNull.status, 'waiting');
  recordPass();
  await leaveRoom();

  // Test 2.2: createRoom() with undefined
  const roomUndef = await createRoom(undefined);
  assert.ok(roomUndef, 'createRoom(undefined) must return valid room');
  assert.equal(roomUndef.members.length, 1);
  assert.equal(roomUndef.deck.length, 25);
  recordPass();
  await leaveRoom();

  // Test 2.3: createRoom({}) empty object
  const roomEmptyObj = await createRoom({});
  assert.ok(roomEmptyObj, 'createRoom({}) must return valid room');
  assert.equal(roomEmptyObj.members.length, 1);
  assert.equal(roomEmptyObj.deck.length, 25);
  recordPass();
  await leaveRoom();

  // Test 2.4: createRoom with hostUser & preset options ({ hostUser: { id: 'u1' }, preset: 'popcorn_party' })
  const roomWithOptions = await createRoom({ hostUser: { id: 'u_opt', name: 'User Opt' }, preset: 'popcorn_party' });
  assert.ok(roomWithOptions);
  assert.equal(roomWithOptions.preset, 'popcorn_party');
  assert.equal(roomWithOptions.members.length, 1);
  assert.equal(roomWithOptions.deck.length, 25);
  recordPass();
  await leaveRoom();

  // Test 2.5: createRoom with empty user object { hostUser: {} }
  const roomEmptyUser = await createRoom({ hostUser: {} });
  assert.ok(roomEmptyUser);
  assert.equal(roomEmptyUser.members[0].isHost, true);
  assert.ok(roomEmptyUser.members[0].id);
  assert.ok(roomEmptyUser.members[0].name);
  recordPass();
  await leaveRoom();

  // Test 2.6: createRoom with malformed likes in host user
  const malformedHost = {
    id: 'user_malformed',
    name: 'Тестер',
    avatar: '🧪',
    likes: [null, undefined, "12", -5, 0, "abc", { id: 7 }, { id: "9" }, 42]
  };
  const roomMalformedLikes = await createRoom({ hostUser: malformedHost });
  assert.ok(roomMalformedLikes);
  assert.deepEqual(roomMalformedLikes.members[0].likes, [12, 7, 9, 42]);
  assert.equal(roomMalformedLikes.deck.length, 25);
  recordPass();
  await leaveRoom();

  // Test 2.7: createRoom with empty and unknown presets
  const roomEmptyPreset = await createRoom(null, '');
  assert.ok(roomEmptyPreset);
  assert.equal(roomEmptyPreset.deck.length, 25);

  const roomUnknownPreset = await createRoom(null, 'nonexistent_space_opera_999');
  assert.ok(roomUnknownPreset);
  assert.equal(roomUnknownPreset.deck.length, 25);
  recordPass();
  await leaveRoom();

  // Test 2.8: createRoom with customFilters
  const roomCustomFilters = await createRoom({
    hostUser: { id: 'host_cf' },
    customFilters: { category: 'anime', genres: ['фантастика'], minRating: 7 }
  });
  assert.ok(roomCustomFilters);
  assert.ok(roomCustomFilters.deck.length > 0 && roomCustomFilters.deck.length <= 25, `Deck length should be between 1 and 25 for filtered search, got ${roomCustomFilters.deck.length}`);
  recordPass();
  await leaveRoom();
});

// ============================================================================
// SUITE 3: Multi-User Room Joining & Presence Scaling (3+ Users)
// ============================================================================
await runSuite('3. Multi-User Room Joining (3+ Users), Presence Tracking & Idempotency', async () => {
  const host = { id: 'multi_host_1', name: 'Хост (Анна)', avatar: '👑', likes: [1, 2, 3] };
  const guest1 = { id: 'multi_guest_1', name: 'Гость 1 (Борис)', avatar: '🎬', likes: [4, 5] };
  const guest2 = { id: 'multi_guest_2', name: 'Гость 2 (Виктор)', avatar: '🍿', likes: [6, 7] };
  const guest3 = { id: 'multi_guest_3', name: 'Гость 3 (Дарья)', avatar: '🔥', likes: [8, 9] };
  const guest4 = { id: 'multi_guest_4', name: 'Гость 4 (Егор)', avatar: '⭐', likes: [10] };

  // Step 1: Host creates room
  const created = await createRoom({ hostUser: host });
  const code = created.code;
  assert.equal(created.members.length, 1);
  assert.equal(created.members[0].isHost, true);
  recordPass();

  // Step 2: Guest 1 joins
  const state1 = await joinRoom({ roomCode: code, user: guest1 });
  assert.equal(state1.members.length, 2);
  assert.equal(state1.status, 'active');
  recordPass();

  // Step 3: Guest 2 joins (3 total)
  const state2 = await joinRoom({ roomCode: code, user: guest2 });
  assert.equal(state2.members.length, 3);
  recordPass();

  // Step 4: Guest 3 joins (4 total)
  const state3 = await joinRoom({ roomCode: code, user: guest3 });
  assert.equal(state3.members.length, 4);
  recordPass();

  // Step 5: Guest 4 joins (5 total)
  const state4 = await joinRoom({ roomCode: code, user: guest4 });
  assert.equal(state4.members.length, 5);
  recordPass();

  // Step 6: Verify all members properties and presence
  const memberIds = state4.members.map(m => m.id);
  assert.deepEqual(memberIds, ['multi_host_1', 'multi_guest_1', 'multi_guest_2', 'multi_guest_3', 'multi_guest_4']);

  const onlineMembers = state4.members.filter(m => m.online === true);
  assert.equal(onlineMembers.length, 5, 'All 5 joined members must have online === true');

  const hosts = state4.members.filter(m => m.isHost === true);
  assert.equal(hosts.length, 1, 'Exactly 1 member must be host');
  assert.equal(hosts[0].id, 'multi_host_1');
  recordPass();

  // Step 7: Idempotent re-join (Guest 2 re-joins room with new likes)
  const updatedGuest2 = { id: 'multi_guest_2', name: 'Виктор Обновленный', avatar: '🚀', likes: [6, 7, 99] };
  const stateRejoin = await joinRoom({ roomCode: code, user: updatedGuest2 });
  assert.equal(stateRejoin.members.length, 5, 'Re-joining must NOT create duplicate member entries');
  const foundG2 = stateRejoin.members.find(m => m.id === 'multi_guest_2');
  assert.ok(foundG2);
  assert.equal(foundG2.online, true);
  recordPass();

  await leaveRoom();
  assert.equal(getActiveRoom(), null);
});

// ============================================================================
// SUITE 4: Concurrent Swipes on 100 Movies Across 3 Simulated Users & 2 Users
// ============================================================================
await runSuite('4. Concurrent Swiping Simulation Across 100 Movies (3 Users & 2 Users)', async () => {
  // Test Scenario 4.1: 3 Users in room (Consensus Matching)
  const host = { id: 'user_u1', name: 'User 1', avatar: '👑', likes: [] };
  const user2 = { id: 'user_u2', name: 'User 2', avatar: '🎬', likes: [] };
  const user3 = { id: 'user_u3', name: 'User 3', avatar: '🍿', likes: [] };

  const room = await createRoom({ hostUser: host });
  await joinRoom({ roomCode: room.code, user: user2 });
  await joinRoom({ roomCode: room.code, user: user3 });

  const active = getActiveRoom();
  assert.equal(active.members.length, 3, 'Room must have 3 active swiping members');

  // Let's create a test set of 100 movie IDs: 1..100
  // Partition:
  // Movies 1..25: ALL 3 users LIKE -> Expect 25 matches triggered
  // Movies 26..50: User 1 & 2 LIKE, User 3 DISLIKES -> Expect 0 matches
  // Movies 51..75: User 1 LIKES, User 2 & 3 DISLIKE -> Expect 0 matches
  // Movies 76..100: ALL 3 users DISLIKE -> Expect 0 matches

  let mutualMatchesCount = 0;
  const matchEvents = [];

  let reactiveMatchesObserved = [];
  const unsub = subscribeToRoom((r) => {
    if (r && r.matches) {
      reactiveMatchesObserved = [...r.matches];
    }
  });

  // Execute 300 swipes across 100 movies in interleaved order
  for (let mId = 1; mId <= 100; mId++) {
    const isAllLike = mId >= 1 && mId <= 25;
    const isTwoLike = mId >= 26 && mId <= 50;
    const isOneLike = mId >= 51 && mId <= 75;

    // Swipes for User 1
    const u1Like = isAllLike || isTwoLike || isOneLike;
    const res1 = recordRoomSwipe({ movieId: mId, liked: u1Like, userId: 'user_u1' });
    assert.equal(res1, null, `User 1 swiping first on movie #${mId} should never trigger mutual match alone`);

    // Swipes for User 2
    const u2Like = isAllLike || isTwoLike;
    const res2 = recordRoomSwipe({ movieId: mId, liked: u2Like, userId: 'user_u2' });
    assert.equal(res2, null, `User 2 swiping on movie #${mId} should not trigger match in 3-person room without User 3`);

    // Swipes for User 3
    const u3Like = isAllLike;
    const res3 = recordRoomSwipe({ movieId: mId, liked: u3Like, userId: 'user_u3' });

    if (isAllLike) {
      assert.ok(res3, `User 3 completing consensus like on movie #${mId} MUST return match object`);
      assert.equal(res3.matched, true);
      assert.equal(res3.movieId, mId);
      assert.ok(res3.movie);
      assert.equal(res3.users.length, 3);
      mutualMatchesCount++;
      matchEvents.push(res3);
    } else {
      assert.equal(res3, null, `Non-consensus swipe on movie #${mId} must return null`);
    }
    recordPass();
  }

  // Check final counts in 3-user room
  const finalActive = getActiveRoom();
  assert.equal(mutualMatchesCount, 25, `Exactly 25 consensus matches must be triggered, got ${mutualMatchesCount}`);
  assert.equal(finalActive.matches.length, 25, `Room state matches count must be 25`);
  assert.equal(reactiveMatchesObserved.length, 25, `Reactive subscriber must observe 25 matches`);

  // Verify member progresses
  const m1 = finalActive.members.find(m => m.id === 'user_u1');
  const m2 = finalActive.members.find(m => m.id === 'user_u2');
  const m3 = finalActive.members.find(m => m.id === 'user_u3');
  assert.equal(m1.progress, 100, 'User 1 progress should be 100');
  assert.equal(m2.progress, 100, 'User 2 progress should be 100');
  assert.equal(m3.progress, 100, 'User 3 progress should be 100');
  recordPass();

  // Test duplicate swipe protection
  const duplicateSwipe = recordRoomSwipe({ movieId: 1, liked: true, userId: 'user_u3' });
  assert.equal(duplicateSwipe, null, 'Duplicate swipe on matched movie must not create duplicate match');
  assert.equal(getActiveRoom().matches.length, 25);
  recordPass();

  unsub();
  await leaveRoom();

  // Test Scenario 4.2: 2 Users swiping on 100 movies
  const room2 = await createRoom({ hostUser: { id: 'pair_1', name: 'P1' } });
  await joinRoom({ roomCode: room2.code, user: { id: 'pair_2', name: 'P2' } });

  let pairMatches = 0;
  for (let mId = 101; mId <= 200; mId++) {
    const bothLike = mId <= 150; // 50 matches
    recordRoomSwipe({ movieId: mId, liked: true, userId: 'pair_1' });
    const resP2 = recordRoomSwipe({ movieId: mId, liked: bothLike, userId: 'pair_2' });
    if (bothLike) {
      assert.ok(resP2, `Pair match expected for movie #${mId}`);
      pairMatches++;
    } else {
      assert.equal(resP2, null);
    }
  }
  assert.equal(pairMatches, 50, 'Pair swiping across 100 movies must produce exactly 50 matches');
  assert.equal(getActiveRoom().matches.length, 50);
  recordPass();

  await leaveRoom();
});

// ============================================================================
// SUITE 5: Sparse Array & RTDB Object Map Deserialization
// ============================================================================
await runSuite('5. Sparse Array, Object Map & Malformed RTDB Snapshot Deserialization', async () => {
  const host = { id: 'host_rtdb', name: 'Хост', avatar: '👑', likes: [] };
  const room = await createRoom({ hostUser: host });

  // Test 5.1: Deserializing likes in various RTDB formats via joinRoom / recordRoomSwipe
  // Format A: Object boolean map `{ "10": true, "20": false, "30": true }`
  const guestObjLikes = {
    id: 'guest_obj_likes',
    name: 'RTDB Obj User',
    avatar: '🍿',
    likes: { "10": true, "20": false, "30": true, "40": "liked", "50": "passed" }
  };
  const joinedA = await joinRoom({ roomCode: room.code, user: guestObjLikes });
  const guestMemberA = joinedA.members.find(m => m.id === 'guest_obj_likes');
  assert.ok(guestMemberA);
  // Should extract only truthy likes: [10, 30, 40]
  assert.deepEqual(guestMemberA.likes.sort((a,b) => a-b), [10, 30, 40]);
  recordPass();

  // Format B: Array with sparse / empty slots and objects
  const guestSparseLikes = {
    id: 'guest_sparse_likes',
    name: 'Sparse User',
    avatar: '🎬',
    likes: [100, null, undefined, { id: 200 }, { id: "300" }, 0, -5, "400", "invalid"]
  };
  const joinedB = await joinRoom({ roomCode: room.code, user: guestSparseLikes });
  const guestMemberB = joinedB.members.find(m => m.id === 'guest_sparse_likes');
  assert.ok(guestMemberB);
  assert.deepEqual(guestMemberB.likes.sort((a,b) => a-b), [100, 200, 300, 400]);
  recordPass();

  // Test 5.2: Positional parameter variations
  // (movieId, liked, userId, roomCode)
  const posSwipe1 = recordRoomSwipe(10, true, 'guest_obj_likes');
  assert.equal(typeof posSwipe1 === 'object', true);
  recordPass();

  // Test 5.3: Decision string ('like', 'superlike', 'dislike') instead of boolean
  const decSwipe1 = recordRoomSwipe({ movieId: 999, decision: 'superlike', userId: 'host_rtdb' });
  const currentRoom = getActiveRoom();
  const hostMember = currentRoom.members.find(m => m.id === 'host_rtdb');
  assert.ok(hostMember.likes.includes(999), 'superlike decision string must be recognized as like');
  recordPass();

  const decSwipe2 = recordRoomSwipe({ movieId: 888, decision: 'dislike', userId: 'host_rtdb' });
  const currentRoom2 = getActiveRoom();
  const hostMember2 = currentRoom2.members.find(m => m.id === 'host_rtdb');
  assert.equal(hostMember2.likes.includes(888), false, 'dislike decision string must be recognized as pass');
  recordPass();

  await leaveRoom();
});

// ============================================================================
// SUITE 6: Synchronous Contract & Reactive Integrity of recordRoomSwipe
// ============================================================================
await runSuite('6. Synchronous Contract & Reactive Integrity of recordRoomSwipe', async () => {
  const host = { id: 'sync_user_1', name: 'User 1', avatar: '👑', likes: [] };
  const guest = { id: 'sync_user_2', name: 'User 2', avatar: '🍿', likes: [] };

  const room = await createRoom({ hostUser: host });
  await joinRoom({ roomCode: room.code, user: guest });

  const targetMovie = movies[0]; // First movie in catalog

  let callbackCount = 0;
  let latestMatchFromListener = null;
  const unsub = subscribeToRoom(room.code, (r) => {
    callbackCount++;
    if (r && r.matches && r.matches.length > 0) {
      latestMatchFromListener = r.matches[r.matches.length - 1];
    }
  });

  // Check synchronous non-match
  const syncResult1 = recordRoomSwipe({ movieId: targetMovie.id, liked: true, userId: 'sync_user_1' });
  assert.equal(syncResult1, null, 'Unilateral like must return null synchronously');
  assert.equal(latestMatchFromListener, null);
  recordPass();

  // Check synchronous mutual match
  const syncResult2 = recordRoomSwipe({ movieId: targetMovie.id, liked: true, userId: 'sync_user_2' });
  assert.ok(syncResult2, 'Mutual like must return non-null match object synchronously');
  assert.equal(syncResult2.matched, true);
  assert.equal(syncResult2.movieId, targetMovie.id);
  assert.equal(syncResult2.movie.id, targetMovie.id);
  assert.equal(typeof syncResult2.timestamp, 'number');
  assert.ok(Array.isArray(syncResult2.users));
  assert.equal(syncResult2.users.length, 2);
  recordPass();

  // Check that listener was invoked reactively
  assert.ok(callbackCount >= 2, `Listener should have been invoked on each swipe (count: ${callbackCount})`);
  assert.ok(latestMatchFromListener, 'Listener must have captured the mutual match');
  assert.equal(latestMatchFromListener.movieId, targetMovie.id);
  recordPass();

  // Test invalid parameters
  const invalidSwipe1 = recordRoomSwipe(null);
  assert.equal(invalidSwipe1, null, 'recordRoomSwipe(null) must return null without throwing');
  const invalidSwipe2 = recordRoomSwipe({});
  assert.equal(invalidSwipe2, null, 'recordRoomSwipe({}) must return null without throwing');
  recordPass();

  unsub();
  await leaveRoom();
});

// ============================================================================
// SUMMARY & VERDICT
// ============================================================================
console.log('\n╔══════════════════════════════════════════════════════════════════╗');
console.log(`║  Stress & Edge-Case Harness Results:                             ║`);
console.log(`║  Total Suites: ${totalSuites} | Passed: ${passedSuites} | Failed: ${totalSuites - passedSuites}                 ║`);
console.log(`║  Total Assertions: ${totalAssertions} | Passed: ${passedAssertions} | Failed: ${totalAssertions - passedAssertions}           ║`);
console.log('╚══════════════════════════════════════════════════════════════════╝\n');

if (failures.length > 0) {
  console.error('💥 FAILURE DETAILS:');
  failures.forEach((f, idx) => {
    console.error(`\n[#${idx + 1}] Suite: ${f.suite}`);
    console.error(`Error: ${f.error}`);
    if (f.stack) console.error(f.stack);
  });
  process.exit(1);
} else {
  console.log('🎉 VERDICT: ALL STRESS & EDGE-CASE CHALLENGES PASSED (100% EMPIRICAL SUCCESS)!');
  process.exit(0);
}
