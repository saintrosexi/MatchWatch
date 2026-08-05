import { createMatchRoom, joinMatchRoom } from './firebase';
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
