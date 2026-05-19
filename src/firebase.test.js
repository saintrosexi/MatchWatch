import { createMatchRoom } from './firebase';
import { getDatabase, ref, set } from 'firebase/database';

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
  beforeAll(() => {
    // Math.random() in createMatchRoom generates string of max length 6:
    // Math.random().toString(36).substring(2, 8).toUpperCase()
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create a room with default deck when customDeck is not provided', async () => {
    const mockDate = 1620000000000;
    jest.spyOn(Date, 'now').mockReturnValue(mockDate);

    // Using default Math.random behaviour

    ref.mockImplementation((db, path) => ({ isMockRef: true, path }));
    const hostName = 'Alice';
    const roomCode = await createMatchRoom(hostName);

    expect(roomCode).toBeTruthy();
    expect(typeof roomCode).toBe('string');
    expect(roomCode.length).toBeLessThanOrEqual(6);

    expect(ref).toHaveBeenCalledWith(expect.anything(), `matchRooms/${roomCode}`);

    expect(set).toHaveBeenCalledWith({ isMockRef: true, path: `matchRooms/${roomCode}` }, expect.objectContaining({
      hostName: 'Alice',
      status: 'waiting',
      createdAt: mockDate,
    }));

    // Check if default deck was created and shuffled (849 cards)
    const setCallArgs = set.mock.calls[0][1];
    expect(setCallArgs.deck).toBeInstanceOf(Array);
    expect(setCallArgs.deck).toHaveLength(849);

    // Verify it contains numbers from 1 to 849
    expect(setCallArgs.deck).toContain(1);
    expect(setCallArgs.deck).toContain(849);

    // Clean up
    jest.restoreAllMocks();
  });

  it('should create a room with custom deck when provided', async () => {
    const mockDate = 1620000000000;
    jest.spyOn(Date, 'now').mockReturnValue(mockDate);

    ref.mockImplementation((db, path) => ({ isMockRef: true, path }));
    const hostName = 'Bob';
    const customDeck = [10, 20, 30];
    const roomCode = await createMatchRoom(hostName, customDeck);

    expect(set).toHaveBeenCalledWith({ isMockRef: true, path: `matchRooms/${roomCode}` }, expect.objectContaining({
      hostName: 'Bob',
      status: 'waiting',
      createdAt: mockDate,
    }));

    const setCallArgs = set.mock.calls[0][1];
    expect(setCallArgs.deck).toBeInstanceOf(Array);
    expect(setCallArgs.deck).toHaveLength(3);
    expect(setCallArgs.deck).toEqual(expect.arrayContaining([10, 20, 30]));

    jest.restoreAllMocks();
  });

  it('should generate a 6 character uppercase alphanumeric room code', async () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.123456789);

    const roomCode = await createMatchRoom('Charlie');

    expect(roomCode).toBe("4FZZZX");

    jest.restoreAllMocks();
  });
});
