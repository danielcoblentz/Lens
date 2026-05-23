import {
  requestPresignedUploadUrl,
  fetchSessionStatus,
  queryRAG,
  pollSessionUntilReady,
} from './aws';

const originalFetch = global.fetch;

beforeEach(() => {
  global.fetch = jest.fn();
});

afterAll(() => {
  global.fetch = originalFetch;
});

const mockFetchOnce = (body: unknown, ok = true, text = '') => {
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok,
    json: async () => body,
    text: async () => text,
  });
};

describe('requestPresignedUploadUrl', () => {
  it('returns sessionId and uploadUrl on success', async () => {
    mockFetchOnce({ sessionId: 'abc', uploadUrl: 'https://s3/put' });
    const result = await requestPresignedUploadUrl();
    expect(result).toEqual({ sessionId: 'abc', uploadUrl: 'https://s3/put' });
  });

  it('throws with the server response when the call fails', async () => {
    mockFetchOnce({}, false, 'boom');
    await expect(requestPresignedUploadUrl()).rejects.toThrow(/boom/);
  });
});

describe('fetchSessionStatus', () => {
  it('returns the parsed status', async () => {
    mockFetchOnce({ sessionId: 'abc', status: 'READY_FOR_QUERY' });
    const result = await fetchSessionStatus('abc');
    expect(result.status).toBe('READY_FOR_QUERY');
  });

  it('throws when the backend returns non-2xx', async () => {
    mockFetchOnce({}, false, 'not found');
    await expect(fetchSessionStatus('missing')).rejects.toThrow(/not found/);
  });
});

describe('queryRAG', () => {
  it('posts the query and returns the answer', async () => {
    mockFetchOnce({ sessionId: 'abc', answer: '42' });
    const result = await queryRAG('abc', 'what?');
    expect(result.answer).toBe('42');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/query'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ sessionId: 'abc', query: 'what?' }),
      }),
    );
  });
});

describe('pollSessionUntilReady', () => {
  it('returns once status is READY_FOR_QUERY', async () => {
    mockFetchOnce({ sessionId: 'abc', status: 'PROCESSING' });
    mockFetchOnce({ sessionId: 'abc', status: 'READY_FOR_QUERY' });

    const result = await pollSessionUntilReady('abc', { intervalMs: 1 });
    expect(result.status).toBe('READY_FOR_QUERY');
  });

  it('returns the ERROR status without throwing', async () => {
    mockFetchOnce({ sessionId: 'abc', status: 'ERROR', error: 'parse failed' });
    const result = await pollSessionUntilReady('abc', { intervalMs: 1 });
    expect(result.status).toBe('ERROR');
    expect(result.error).toBe('parse failed');
  });

  it('aborts when signal is fired', async () => {
    const ctrl = new AbortController();
    ctrl.abort();
    await expect(
      pollSessionUntilReady('abc', { intervalMs: 1, signal: ctrl.signal }),
    ).rejects.toThrow(/cancelled/);
  });
});
