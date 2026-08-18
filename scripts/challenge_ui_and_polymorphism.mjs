// MatchWatch 3 — Empirical Challenger 2 Verification Harness
// Testing API Polymorphism, UI Integration, Match Deduplication, and Deep-Link Parsing

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

console.log('⚔️  Starting Empirical Challenger 2 Test Harness...\n');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function syncTest(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✅ [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${name}`);
    console.error(err);
    failedTests++;
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
    failedTests++;
    process.exitCode = 1;
  }
}

// ============================================================================
// SECTION 1: Exhaustive API Polymorphism Testing
// ============================================================================
console.log('--- SECTION 1: API Polymorphism Tests ---');

// 1.1 createRoom polymorphism
await asyncTest('1.1.1 createRoom with empty args (defaults)', async () => {
  const room = await createRoom();
  assert.ok(room, 'Room created with default parameters');
  assert.match(room.code, /^[A-Z0-9]{4}$/);
  assert.equal(room.preset, 'compromise_25');
  assert.equal(room.members.length, 1);
  assert.equal(room.members[0].isHost, true);
  await leaveRoom();
});

await asyncTest('1.1.2 createRoom with user object as first positional arg', async () => {
  const user = { id: 'usr_pos_1', name: 'Player 1', avatar: '🎯', likes: [10, 20] };
  const room = await createRoom(user, 'popcorn_party', { category: 'movie' });
  assert.equal(room.preset, 'popcorn_party');
  assert.equal(room.members[0].id, 'usr_pos_1');
  assert.deepEqual(room.customFilters, { category: 'movie' });
  assert.equal(room.deck.length, 25);
  await leaveRoom();
});

await asyncTest('1.1.3 createRoom with { hostUser, preset, customFilters }', async () => {
  const host = { id: 'usr_obj_1', name: 'Host 1', avatar: '👑', likes: [5, 15] };
  const room = await createRoom({
    hostUser: host,
    preset: 'noir_thriller',
    customFilters: { category: 'movie' }
  });
  assert.equal(room.preset, 'noir_thriller');
  assert.equal(room.members[0].id, 'usr_obj_1');
  assert.deepEqual(room.customFilters, { category: 'movie' });
  assert.equal(room.deck.length, 25);
  await leaveRoom();

  // Test with series filter (bounded by pool size)
  const seriesRoom = await createRoom({
    hostUser: host,
    customFilters: { category: 'series' }
  });
  assert.ok(seriesRoom.deck.length > 0 && seriesRoom.deck.length <= 25, 'Deck size bounded by available series');
  assert.ok(seriesRoom.deck.every((m) => m.category === 'series'), 'All deck items must be series');
  await leaveRoom();
});

await asyncTest('1.1.4 createRoom with { user, preset } (alternative object key)', async () => {
  const user = { id: 'usr_alt_1', name: 'Host Alt', avatar: '🍿', likes: [] };
  const room = await createRoom({ user, preset: 'popcorn_party' });
  assert.equal(room.preset, 'popcorn_party');
  assert.equal(room.members[0].id, 'usr_alt_1');
  await leaveRoom();
});

// 1.2 joinRoom polymorphism
await asyncTest('1.2.1 joinRoom with positional args (code, user)', async () => {
  const host = { id: 'h_pos', name: 'Host Pos', likes: [1, 2] };
  const guest = { id: 'g_pos', name: 'Guest Pos', likes: [3, 4] };
  const room = await createRoom(host);
  const joined = await joinRoom(room.code, guest);
  assert.equal(joined.code, room.code);
  assert.equal(joined.members.length, 2);
  assert.equal(joined.status, 'active');
  assert.equal(joined.deck.length, 25);
  await leaveRoom();
});

await asyncTest('1.2.2 joinRoom with positional lowercase & untrimmed code ("  code  ", user)', async () => {
  const host = { id: 'h_trim', name: 'Host Trim', likes: [] };
  const guest = { id: 'g_trim', name: 'Guest Trim', likes: [] };
  const room = await createRoom(host);
  const rawCode = `  ${room.code.toLowerCase()}  `;
  const joined = await joinRoom(rawCode, guest);
  assert.equal(joined.code, room.code);
  assert.equal(joined.members.length, 2);
  await leaveRoom();
});

await asyncTest('1.2.3 joinRoom with { roomCode, user }', async () => {
  const host = { id: 'h_obj1', name: 'Host Obj1', likes: [] };
  const guest = { id: 'g_obj1', name: 'Guest Obj1', likes: [] };
  const room = await createRoom({ hostUser: host });
  const joined = await joinRoom({ roomCode: room.code, user: guest });
  assert.equal(joined.members.length, 2);
  assert.ok(joined.members.some((m) => m.id === 'g_obj1'));
  await leaveRoom();
});

await asyncTest('1.2.4 joinRoom with { code, user }', async () => {
  const host = { id: 'h_obj2', name: 'Host Obj2', likes: [] };
  const guest = { id: 'g_obj2', name: 'Guest Obj2', likes: [] };
  const room = await createRoom({ hostUser: host });
  const joined = await joinRoom({ code: room.code, user: guest });
  assert.equal(joined.members.length, 2);
  await leaveRoom();
});

await asyncTest('1.2.5 joinRoom with { roomCode, guestUser }', async () => {
  const host = { id: 'h_obj3', name: 'Host Obj3', likes: [] };
  const guest = { id: 'g_obj3', name: 'Guest Obj3', likes: [] };
  const room = await createRoom({ hostUser: host });
  const joined = await joinRoom({ roomCode: room.code, guestUser: guest });
  assert.equal(joined.members.length, 2);
  assert.ok(joined.members.some((m) => m.id === 'g_obj3'));
  await leaveRoom();
});

await asyncTest('1.2.6 joinRoom without explicit user (fallback to getCurrentUser)', async () => {
  const host = { id: 'h_fallback', name: 'Host Fallback', likes: [] };
  const room = await createRoom(host);
  const joined = await joinRoom(room.code);
  assert.equal(joined.members.length, 2);
  assert.equal(joined.status, 'active');
  await leaveRoom();
});

// 1.3 leaveRoom polymorphism
await asyncTest('1.3.1 leaveRoom with empty args (clears active state)', async () => {
  await createRoom();
  assert.ok(getActiveRoom());
  await leaveRoom();
  assert.equal(getActiveRoom(), null);
});

await asyncTest('1.3.2 leaveRoom with positional (code, userId)', async () => {
  const host = { id: 'h_leave1', name: 'Host Leave 1' };
  const room = await createRoom(host);
  await leaveRoom(room.code, 'h_leave1');
  assert.equal(getActiveRoom(), null);
});

await asyncTest('1.3.3 leaveRoom with object { roomCode, userId }', async () => {
  const host = { id: 'h_leave2', name: 'Host Leave 2' };
  const room = await createRoom(host);
  await leaveRoom({ roomCode: room.code, userId: 'h_leave2' });
  assert.equal(getActiveRoom(), null);
});

await asyncTest('1.3.4 leaveRoom with object { code, user: { id } }', async () => {
  const host = { id: 'h_leave3', name: 'Host Leave 3' };
  const room = await createRoom(host);
  await leaveRoom({ code: room.code, user: { id: 'h_leave3' } });
  assert.equal(getActiveRoom(), null);
});

// 1.4 recordRoomSwipe polymorphism
await asyncTest('1.4.1 recordRoomSwipe with positional args (movieId, liked, userId, roomCode)', async () => {
  const host = { id: 'u_p1', name: 'User 1', likes: [] };
  const guest = { id: 'u_p2', name: 'User 2', likes: [] };
  const room = await createRoom(host);
  await joinRoom(room.code, guest);

  const mId = room.deck[0].id;
  const res1 = recordRoomSwipe(mId, true, 'u_p1', room.code);
  assert.equal(res1, null, 'Single like is not mutual');

  const res2 = recordRoomSwipe(mId, true, 'u_p2', room.code);
  assert.ok(res2, 'Mutual like triggers match');
  assert.equal(res2.movieId, mId);
  assert.equal(res2.matched, true);

  await leaveRoom();
});

await asyncTest('1.4.2 recordRoomSwipe with object { movieId, liked: true/false, userId }', async () => {
  const host = { id: 'u_o1', name: 'User O1', likes: [] };
  const guest = { id: 'u_o2', name: 'User O2', likes: [] };
  const room = await createRoom({ hostUser: host });
  await joinRoom({ roomCode: room.code, user: guest });

  const m1 = room.deck[0].id;
  const m2 = room.deck[1].id;

  // Like on m1
  recordRoomSwipe({ movieId: m1, liked: true, userId: 'u_o1' });
  const match1 = recordRoomSwipe({ movieId: m1, liked: true, userId: 'u_o2' });
  assert.ok(match1, 'Match on m1');

  // Dislike on m2
  recordRoomSwipe({ movieId: m2, liked: false, userId: 'u_o1' });
  const match2 = recordRoomSwipe({ movieId: m2, liked: true, userId: 'u_o2' });
  assert.equal(match2, null, 'No match on disliked movie');

  await leaveRoom();
});

await asyncTest('1.4.3 recordRoomSwipe with decision: "like" / "dislike" / "superlike" and id / user object', async () => {
  const host = { id: 'u_d1', name: 'User D1', likes: [] };
  const guest = { id: 'u_d2', name: 'User D2', likes: [] };
  const room = await createRoom(host);
  await joinRoom(room.code, guest);

  const m1 = room.deck[2].id;
  const m2 = room.deck[3].id;

  // Superlike + like -> Match
  recordRoomSwipe({ id: m1, decision: 'superlike', user: { id: 'u_d1' } });
  const match1 = recordRoomSwipe({ id: m1, decision: 'like', userId: 'u_d2' });
  assert.ok(match1, 'Superlike + like forms match');
  assert.equal(match1.movieId, m1);

  // Dislike -> No Match
  recordRoomSwipe({ id: m2, decision: 'dislike', userId: 'u_d1' });
  const match2 = recordRoomSwipe({ id: m2, decision: 'like', userId: 'u_d2' });
  assert.equal(match2, null);

  await leaveRoom();
});

// 1.5 subscribeToRoom polymorphism
await asyncTest('1.5.1 subscribeToRoom global and room-specific subscribers', async () => {
  const host = { id: 'sub_host', name: 'Sub Host', likes: [] };
  const room = await createRoom(host);

  let globalUpdates = 0;
  let roomUpdates = 0;

  const unsubGlobal = subscribeToRoom((r) => {
    if (r) globalUpdates++;
  });

  const unsubRoom = subscribeToRoom(room.code, (r) => {
    if (r) roomUpdates++;
  });

  // Both should have received initial snapshot
  assert.ok(globalUpdates >= 1, 'Global subscriber received initial state');
  assert.ok(roomUpdates >= 1, 'Room subscriber received initial state');

  const guest = { id: 'sub_guest', name: 'Sub Guest', likes: [] };
  await joinRoom(room.code, guest);

  // Both should have received join update
  assert.ok(globalUpdates >= 2, 'Global subscriber updated on join');
  assert.ok(roomUpdates >= 2, 'Room subscriber updated on join');

  // Clean unsubscribes
  unsubGlobal();
  unsubRoom();

  const prevGlobal = globalUpdates;
  const prevRoom = roomUpdates;

  await leaveRoom();

  // After unsubscribe, count should not increase
  assert.equal(globalUpdates, prevGlobal, 'Unsubscribed global listener received no more events');
  assert.equal(roomUpdates, prevRoom, 'Unsubscribed room listener received no more events');
});

// ============================================================================
// SECTION 2: Match Celebration Deduplication Logic
// ============================================================================
console.log('\n--- SECTION 2: Match Celebration Deduplication Tests ---');

await asyncTest('2.1 Simulate 10 swipe events with 3 matches, verify celebration deduplication', async () => {
  const host = { id: 'usr_alpha', name: 'Alpha', likes: [] };
  const guest = { id: 'usr_beta', name: 'Beta', likes: [] };

  const room = await createRoom(host);
  await joinRoom(room.code, guest);

  const active = getActiveRoom();
  const deckMovies = active.deck.slice(0, 10); // 10 test movies

  // Simulation of App.jsx reactive celebration tracking
  const seenMatchIds = new Set();
  const celebratedMatches = [];
  let subscriptionCallCount = 0;

  const unsubscribe = subscribeToRoom((roomState) => {
    subscriptionCallCount++;
    if (roomState && Array.isArray(roomState.matches)) {
      roomState.matches.forEach((m) => {
        const mId = m.movieId || m.movie?.id;
        if (mId && !seenMatchIds.has(mId)) {
          seenMatchIds.add(mId);
          celebratedMatches.push({
            movieId: mId,
            title: m.movie?.titleRu || m.movie?.title,
            celebratedAtCallIndex: subscriptionCallCount
          });
        }
      });
    }
  });

  // Swipe Event Schedule (10 swipes across both users):
  // Movie 0: Mutual LIKE -> Match 1
  // Movie 1: Alpha LIKE, Beta PASS -> No match
  // Movie 2: Alpha PASS, Beta LIKE -> No match
  // Movie 3: Mutual LIKE -> Match 2
  // Movie 4: Mutual PASS -> No match
  // Movie 5: Mutual LIKE -> Match 3

  // Swipe 1 & 2: Movie 0
  recordRoomSwipe({ movieId: deckMovies[0].id, liked: true, userId: 'usr_alpha' });
  recordRoomSwipe({ movieId: deckMovies[0].id, liked: true, userId: 'usr_beta' });

  // Swipe 3 & 4: Movie 1
  recordRoomSwipe({ movieId: deckMovies[1].id, liked: true, userId: 'usr_alpha' });
  recordRoomSwipe({ movieId: deckMovies[1].id, liked: false, userId: 'usr_beta' });

  // Swipe 5 & 6: Movie 2
  recordRoomSwipe({ movieId: deckMovies[2].id, liked: false, userId: 'usr_alpha' });
  recordRoomSwipe({ movieId: deckMovies[2].id, liked: true, userId: 'usr_beta' });

  // Swipe 7 & 8: Movie 3
  recordRoomSwipe({ movieId: deckMovies[3].id, liked: true, userId: 'usr_alpha' });
  recordRoomSwipe({ movieId: deckMovies[3].id, liked: true, userId: 'usr_beta' });

  // Swipe 9 & 10: Movie 4 & Movie 5
  recordRoomSwipe({ movieId: deckMovies[4].id, liked: false, userId: 'usr_alpha' });
  recordRoomSwipe({ movieId: deckMovies[4].id, liked: false, userId: 'usr_beta' });

  recordRoomSwipe({ movieId: deckMovies[5].id, liked: true, userId: 'usr_alpha' });
  recordRoomSwipe({ movieId: deckMovies[5].id, liked: true, userId: 'usr_beta' });

  // Total matches recorded in room
  const finalRoom = getActiveRoom();
  assert.equal(finalRoom.matches.length, 3, `Expected 3 matches in room, got ${finalRoom.matches.length}`);

  // Total celebrated matches triggered
  assert.equal(celebratedMatches.length, 3, `Expected exactly 3 celebrated matches, got ${celebratedMatches.length}`);

  const celebratedMovieIds = celebratedMatches.map((c) => c.movieId);
  assert.deepEqual(celebratedMovieIds, [deckMovies[0].id, deckMovies[3].id, deckMovies[5].id]);

  // Verify that duplicate swipes on already matched movie do NOT create duplicate matches or celebrations
  recordRoomSwipe({ movieId: deckMovies[0].id, liked: true, userId: 'usr_alpha' });
  recordRoomSwipe({ movieId: deckMovies[0].id, liked: true, userId: 'usr_beta' });

  const updatedRoom = getActiveRoom();
  assert.equal(updatedRoom.matches.length, 3, 'Room matches count must remain 3');
  assert.equal(celebratedMatches.length, 3, 'Celebrated matches count must remain 3');

  // Verify that subsequent subscriber updates with existing match list do not re-trigger celebrations
  assert.ok(subscriptionCallCount >= 6, `Subscriber was notified multiple times (${subscriptionCallCount} times)`);
  assert.equal(celebratedMatches.length, 3, 'Celebrations were not duplicated despite multiple subscriber emissions');

  unsubscribe();
  await leaveRoom();
});

await asyncTest('2.2 Verify seenMatchIds reset on leaveRoom and new session initiation', async () => {
  const seenMatchIds = new Set();
  let celebratedCount = 0;

  // Session 1
  const r1 = await createRoom({ hostUser: { id: 'u1' } });
  await joinRoom(r1.code, { id: 'u2' });
  const m1Id = r1.deck[0].id;

  const unsub1 = subscribeToRoom((room) => {
    if (room && room.matches) {
      room.matches.forEach((m) => {
        const id = m.movieId || m.movie?.id;
        if (id && !seenMatchIds.has(id)) {
          seenMatchIds.add(id);
          celebratedCount++;
        }
      });
    } else if (!room) {
      seenMatchIds.clear();
    }
  });

  recordRoomSwipe(m1Id, true, 'u1');
  recordRoomSwipe(m1Id, true, 'u2');
  assert.equal(celebratedCount, 1);

  // Leave room -> resets seenMatchIds
  await leaveRoom();
  assert.equal(seenMatchIds.size, 0, 'seenMatchIds cleared on room exit');

  // Session 2: Same movie in a new room can be celebrated again
  const r2 = await createRoom({ hostUser: { id: 'u3' } });
  await joinRoom(r2.code, { id: 'u4' });
  recordRoomSwipe(m1Id, true, 'u3');
  recordRoomSwipe(m1Id, true, 'u4');

  assert.equal(celebratedCount, 2, 'Movie celebrates again in new independent room session');

  unsub1();
  await leaveRoom();
});

// ============================================================================
// SECTION 3: Deep-Link URL Search Parameter & Telegram Parser Logic
// ============================================================================
console.log('\n--- SECTION 3: Deep-Link URL and Telegram Parser Tests ---');

// Extracted parser matching App.jsx implementation exactly
function parseDeepLink(searchString, telegramStartParam) {
  let targetRoomCode = null;

  // 1. URL search parameters
  if (searchString) {
    const params = new URLSearchParams(searchString);
    targetRoomCode = params.get('room') || params.get('roomCode') || params.get('join');
  }

  // 2. Telegram WebApp start_param
  if (!targetRoomCode && telegramStartParam) {
    const startParam = telegramStartParam;
    if (typeof startParam === 'string') {
      if (startParam.startsWith('room_')) {
        targetRoomCode = startParam.replace('room_', '');
      } else if (startParam.length === 4) {
        targetRoomCode = startParam;
      }
    }
  }

  if (targetRoomCode) {
    const cleanCode = targetRoomCode.trim().toUpperCase();
    if (cleanCode.length === 4 && /^[A-Z0-9]{4}$/.test(cleanCode)) {
      return cleanCode;
    }
  }

  return null;
}

const deepLinkCases = [
  // Malformed / Empty cases -> must return null
  { search: '?room=', tg: null, expected: null, desc: 'Empty ?room=' },
  { search: '?room=abc', tg: null, expected: null, desc: '3-char code ?room=abc' },
  { search: '?room=ABCD123', tg: null, expected: null, desc: '7-char code ?room=ABCD123' },
  { search: '?unknown=1', tg: null, expected: null, desc: 'Unrelated query ?unknown=1' },
  { search: '?room=!@#$', tg: null, expected: null, desc: 'Special chars ?room=!@#$' },
  { search: '', tg: null, expected: null, desc: 'Empty search and empty tg' },

  // Valid URL search parameter formats
  { search: '?room=ABCD', tg: null, expected: 'ABCD', desc: 'Standard ?room=ABCD' },
  { search: '?room=abcd', tg: null, expected: 'ABCD', desc: 'Lowercase ?room=abcd' },
  { search: '?room=  EFGH  ', tg: null, expected: 'EFGH', desc: 'Untrimmed ?room=  EFGH  ' },
  { search: '?roomCode=KLMN', tg: null, expected: 'KLMN', desc: 'Alternative ?roomCode=KLMN' },
  { search: '?join=OPQR', tg: null, expected: 'OPQR', desc: 'Alternative ?join=OPQR' },
  { search: '?utm_source=tg&room=STUV&theme=dark', tg: null, expected: 'STUV', desc: 'Multi-param query with ?room=STUV' },

  // Telegram start_param formats
  { search: '', tg: 'room_XYZW', expected: 'XYZW', desc: 'Telegram start_param=room_XYZW' },
  { search: '', tg: 'room_xyzw', expected: 'XYZW', desc: 'Telegram start_param=room_xyzw (lowercase)' },
  { search: '', tg: 'XYZW', expected: 'XYZW', desc: 'Telegram start_param=XYZW (4-char direct)' },
  { search: '', tg: 'xyzw', expected: 'XYZW', desc: 'Telegram start_param=xyzw (4-char direct lowercase)' },
  { search: '', tg: 'room_', expected: null, desc: 'Telegram start_param=room_ (empty code)' },
  { search: '', tg: 'room_toolongcode', expected: null, desc: 'Telegram start_param=room_toolongcode' },
  { search: '', tg: 'abc', expected: null, desc: 'Telegram start_param=abc (3 chars)' },
  { search: '', tg: 'toolong', expected: null, desc: 'Telegram start_param=toolong' },
  { search: '', tg: 12345, expected: null, desc: 'Telegram non-string type' },

  // Precedence
  { search: '?room=AAAA', tg: 'room_BBBB', expected: 'AAAA', desc: 'URL search param takes precedence over Telegram start_param' }
];

deepLinkCases.forEach((tc, idx) => {
  syncTest(`3.${idx + 1} Deep-Link parser: ${tc.desc}`, () => {
    const result = parseDeepLink(tc.search, tc.tg);
    assert.equal(result, tc.expected, `Expected ${tc.expected}, got ${result} for search="${tc.search}", tg="${tc.tg}"`);
  });
});

// ============================================================================
// Summary
// ============================================================================
console.log(`\n========================================`);
console.log(`Challenger 2 Test Results: ${passedTests} / ${totalTests} Passed (${failedTests} Failed)`);
console.log(`========================================\n`);

if (failedTests === 0) {
  console.log('🎉 All challenger tests passed with 100% compliance!');
  process.exit(0);
} else {
  console.error(`💥 Verification failed with ${failedTests} failure(s)`);
  process.exit(1);
}
