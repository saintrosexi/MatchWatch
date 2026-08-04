import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import Profile from './Profile';

jest.mock('../firebase', () => ({
  auth: { currentUser: { uid: 'user1', displayName: 'ТестКиноман#1234', email: 'test@test.com' } },
  database: {},
  registerWithTag: jest.fn(),
  signInWithEmailAndPassword: jest.fn(),
  signInWithTelegram: jest.fn(),
  createTelegramAuthToken: jest.fn(),
  listenToTelegramAuthToken: jest.fn(),
  signOut: jest.fn(),
  updateUserTag: jest.fn()
}));

jest.mock('firebase/auth', () => ({
  onAuthStateChanged: jest.fn((auth, cb) => {
    cb({ uid: 'user1', displayName: 'ТестКиноман#1234', email: 'test@test.com' });
    return () => {};
  })
}));

jest.mock('firebase/database', () => ({
  ref: jest.fn(),
  set: jest.fn(),
  onValue: jest.fn((ref, cb) => {
    cb({ val: () => ({ profile: { bio: 'Киноман со стажем' }, appData: { decisions: { 1: 'like' }, favorites: { 1: true } } }) });
    return () => {};
  })
}));

jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }) => {
      const { initial, animate, exit, transition, whileHover, whileTap, ...rest } = props;
      return <div {...rest}>{children}</div>;
    }
  },
  AnimatePresence: ({ children }) => <>{children}</>
}));

describe('Profile Component', () => {
  test('renders Profile dashboard cleanly without throwing ReferenceError or crashing', () => {
    render(
      <Profile 
        user={{ uid: 'user1', displayName: 'ТестКиноман#1234' }}
        currentUserDecisions={{ 1: 'like' }}
        favorites={{ 1: true }}
        ratings={{ 1: 5 }}
      />
    );

    expect(screen.getByText(/5D Сенсорный Профиль/i)).toBeInTheDocument();
    expect(screen.getByText(/Статистика/i)).toBeInTheDocument();
  });
});
