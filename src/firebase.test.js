import { createMatchRoom, joinMatchRoom, searchUserByUsername, normalizeSearchTerm } from './firebase';
import { getDatabase, ref, set, get, update } from 'firebase/database';

jest.mock('firebase/app', () => ({
  initializeApp: jest.fn(() => ({})),
}));

jest.mock('firebase/database', () => ({
  __esModule: true,
  getDatabase: jest.fn(() => ({})), // Mock database object so !database check passes
  ref: jest.fn().mockImplementation((db, path) => ({ isMockRef: true, path })),
  set: jest.fn(() => Promise.resolve()),
  get: jest.fn(),
  onValue: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
}));

jest.mock('firebase/auth', () => ({
  getAuth: jest.fn(),
  createUserWithEmailAndPassword: jest.fn(),
  signInWithEmailAndPassword: jest.fn(),
  signOut: jest.fn(),
  updateProfile: jest.fn(),
}));

describe('searchUserByUsername', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('normalizes search terms by trimming, lowercasing, and removing @ and #', () => {
    expect(normalizeSearchTerm('@Sanya#1234')).toBe('sanya1234');
    expect(normalizeSearchTerm('  @Мария  ')).toBe('мария');
    expect(normalizeSearchTerm('')).toBe('');
  });

  it('returns empty array when database or identifier is missing/empty', async () => {
    const res1 = await searchUserByUsername('');
    expect(res1).toEqual([]);

    const res2 = await searchUserByUsername(null);
    expect(res2).toEqual([]);
  });

  it('performs substring matching across online and offline users in RTDB /users', async () => {
    const mockUsersData = {
      user_1: {
        profile: {
          username: 'sanya_online',
          name: 'Александр',
          tag: '@sanya_online#1111',
          email: 'sanya.online@gmail.com',
          avatar: '😎'
        }
      },
      user_2: {
        profile: {
          username: 'sanya_offline',
          name: 'Саня Офлайн',
          tag: '@sanya_offline#2222',
          email: 'sanya.offline@gmail.com',
          avatar: '😴'
        }
      },
      user_3: {
        profile: {
          username: 'charlie',
          name: 'Чарли',
          tag: '@charlie#3333',
          email: 'charlie@gmail.com'
        }
      }
    };

    const snapshot = {
      exists: () => true,
      val: () => mockUsersData
    };

    get.mockImplementation(async (refObj) => {
      if (refObj?.path === 'users') {
        return snapshot;
      }
      return { exists: () => false, val: () => null };
    });

    const results = await searchUserByUsername('@sanya');
    expect(results).toHaveLength(2);
    expect(results[0].uid).toBe('user_1');
    expect(results[0].profile.username).toBe('sanya_online');
    expect(results[1].uid).toBe('user_2');
    expect(results[1].profile.username).toBe('sanya_offline');
  });

  it('handles Cyrillic display names and case-insensitive queries', async () => {
    const mockUsersData = {
      user_cyrillic: {
        profile: {
          username: 'mariya99',
          name: 'Мария Иванова',
          tag: '@mariya99#5555'
        }
      }
    };

    get.mockImplementation(async (refObj) => {
      if (refObj?.path === 'users') {
        return { exists: () => true, val: () => mockUsersData };
      }
      return { exists: () => false, val: () => null };
    });

    const results = await searchUserByUsername('мария');
    expect(results).toHaveLength(1);
    expect(results[0].uid).toBe('user_cyrillic');
    expect(results[0].profile.name).toBe('Мария Иванова');
  });

  it('returns empty array when search yields no matches', async () => {
    get.mockImplementation(async (refObj) => {
      if (refObj?.path === 'users') {
        return { exists: () => true, val: () => ({}) };
      }
      return { exists: () => false, val: () => null };
    });

    const results = await searchUserByUsername('nonexistent_user_xyz');
    expect(results).toEqual([]);
  });
});

describe('createMatchRoom', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create a room with lobby status and 6-digit numeric code', async () => {
    const mockDate = 1620000000000;
    jest.spyOn(Date, 'now').mockReturnValue(mockDate);

    ref.mockImplementation((db, path) => ({ isMockRef: true, path }));
    const hostName = 'Alice';
    const roomCode = await createMatchRoom(hostName);

    expect(roomCode).toBeTruthy();
    expect(typeof roomCode).toBe('string');
    expect(roomCode).toMatch(/^\d{6}$/);

    expect(ref).toHaveBeenCalledWith(expect.anything(), `matchRooms/${roomCode}`);

    expect(set).toHaveBeenCalledWith({ isMockRef: true, path: `matchRooms/${roomCode}` }, expect.objectContaining({
      hostName: 'Alice',
      status: 'lobby',
      createdAt: mockDate,
    }));

    jest.restoreAllMocks();
  });

  it('should create a room with filters when provided', async () => {
    const mockDate = 1620000000000;
    jest.spyOn(Date, 'now').mockReturnValue(mockDate);

    ref.mockImplementation((db, path) => ({ isMockRef: true, path }));
    const hostName = 'Bob';
    const filters = { genre: 'комедия' };
    const roomCode = await createMatchRoom(hostName, filters);

    expect(set).toHaveBeenCalledWith({ isMockRef: true, path: `matchRooms/${roomCode}` }, expect.objectContaining({
      hostName: 'Bob',
      status: 'lobby',
      filters: { genre: 'комедия' },
      createdAt: mockDate,
    }));

    jest.restoreAllMocks();
  });

  it('should generate a 6 digit numeric room code', async () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.123456789);

    const roomCode = await createMatchRoom('Charlie');

    expect(roomCode).toMatch(/^\d{6}$/);

    jest.restoreAllMocks();
  });
});

describe('joinMatchRoom cooperative logic', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should join room successfully in lobby mode', async () => {
    const mockRoomData = {
      hostName: 'HostUser',
      status: 'lobby',
      createdAt: 123456789
    };

    const snapshot = {
      exists: () => true,
      val: () => mockRoomData
    };
    
    const { get: mockGet, update: mockUpdate } = require('firebase/database');
    mockGet.mockResolvedValue(snapshot);
    mockUpdate.mockResolvedValue(true);

    const { joinMatchRoom } = require('./firebase');

    const success = await joinMatchRoom('482910', 'GuestUser');
    expect(success).toBe(true);

    expect(mockUpdate).toHaveBeenCalled();
    const updateCallArgs = mockUpdate.mock.calls[0][1];
    
    expect(updateCallArgs.guestName).toBe('GuestUser');
    expect(updateCallArgs.guestReady).toBe(false);
  });
});
