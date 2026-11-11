import { isValidEmail, parseAuthCallback } from './auth';

jest.mock('expo-apple-authentication', () => ({}));
jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => jest.fn()),
}));

describe('parseAuthCallback', () => {
  it('reads a PKCE code from the query string', () => {
    expect(parseAuthCallback('stampa://auth/callback?code=abc123')).toMatchObject({
      code: 'abc123',
    });
  });
  it('reads tokens from the URL fragment', () => {
    expect(
      parseAuthCallback('stampa://auth/callback#access_token=at&refresh_token=rt&type=magiclink'),
    ).toMatchObject({ accessToken: 'at', refreshToken: 'rt' });
  });
  it('surfaces errors', () => {
    expect(
      parseAuthCallback(
        'stampa://auth/callback#error=access_denied&error_description=Link+expired',
      ),
    ).toMatchObject({ error: 'Link expired' });
  });
});

describe('isValidEmail', () => {
  it.each([
    ['a@b.co', true],
    ['  user@example.com ', true],
    ['nope', false],
    ['a@b', false],
    ['a b@c.com', false],
  ])('%s → %s', (email, valid) => expect(isValidEmail(email)).toBe(valid));
});
