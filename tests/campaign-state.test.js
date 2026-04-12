/**
 * Campaign State Machine Tests
 */
const STATE_TRANSITIONS = {
  draft: ['published', 'closed'],
  published: ['matching', 'closed'],
  matching: ['accepted', 'negotiating', 'closed'],
  negotiating: ['accepted', 'closed'],
  accepted: ['confirmed', 'closed'],
  confirmed: ['live', 'closed'],
  live: ['completed'],
  completed: ['verified'],
  verified: [],
  closed: [],
};

function isValid(from, to) {
  return STATE_TRANSITIONS[from]?.includes(to) || false;
}

describe('Campaign State Machine', () => {
  it('happy path: draft → verified', () => {
    const path = ['draft', 'published', 'matching', 'accepted', 'confirmed', 'live', 'completed', 'verified'];
    for (let i = 0; i < path.length - 1; i++) {
      expect(isValid(path[i], path[i + 1])).toBe(true);
    }
  });

  it('closeable states', () => {
    ['draft', 'published', 'matching', 'negotiating', 'accepted', 'confirmed'].forEach(s => {
      expect(isValid(s, 'closed')).toBe(true);
    });
  });

  it('live cannot close (must complete)', () => {
    expect(isValid('live', 'closed')).toBe(false);
  });

  it('terminal states have no transitions', () => {
    expect(STATE_TRANSITIONS.verified).toEqual([]);
    expect(STATE_TRANSITIONS.closed).toEqual([]);
  });

  it('invalid skips', () => {
    expect(isValid('draft', 'live')).toBe(false);
    expect(isValid('published', 'confirmed')).toBe(false);
    expect(isValid('completed', 'live')).toBe(false);
  });

  it('10 states defined', () => {
    expect(Object.keys(STATE_TRANSITIONS).length).toBe(10);
  });
});
