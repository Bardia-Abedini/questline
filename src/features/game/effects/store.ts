import { create } from 'zustand';

/** A floating "+XP / +gold" pill. Several grants close together merge into one. */
export interface FloatFx {
  id: number;
  xp: number;
  gold: number;
  xpBefore: number;
  xpAfter: number;
  at: number;
}

export type NoteFx =
  | { id: number; kind: 'achievement'; achievementIds: string[]; gold: number }
  | { id: number; kind: 'loot_gold'; amount: number }
  | { id: number; kind: 'loot_item'; itemId: string }
  | { id: number; kind: 'daily'; questKey: string; gold: number }
  | { id: number; kind: 'redeem'; title: string };

export type CelebrationFx =
  | {
      id: number;
      kind: 'level';
      level: number;
      /** First level reached in this burst (several level-ups merge into one card). */
      fromLevel: number;
      goldGift: number;
      milestone: boolean;
    }
  | { id: number; kind: 'boss' };

interface FxState {
  floats: FloatFx[];
  notes: NoteFx[];
  celebrations: CelebrationFx[];
}

let nextId = 1;
const MERGE_MS = 500;

export const useFx = create<FxState>(() => ({ floats: [], notes: [], celebrations: [] }));

type NoteInput = NoteFx extends infer N ? (N extends NoteFx ? Omit<N, 'id'> : never) : never;
type CelebrationInput = CelebrationFx extends infer C
  ? C extends CelebrationFx
    ? Omit<C, 'id'>
    : never
  : never;

export const fx = {
  float(input: Omit<FloatFx, 'id' | 'at'>, now = Date.now()): number {
    const { floats } = useFx.getState();
    const last = floats[floats.length - 1];
    if (last && now - last.at < MERGE_MS) {
      const merged = {
        ...last,
        xp: last.xp + input.xp,
        gold: last.gold + input.gold,
        xpBefore: Math.min(last.xpBefore, input.xpBefore),
        xpAfter: Math.max(last.xpAfter, input.xpAfter),
      };
      useFx.setState({ floats: [...floats.slice(0, -1), merged] });
      return last.id;
    }
    const id = nextId++;
    useFx.setState({ floats: [...floats, { ...input, id, at: now }].slice(-1) });
    return id;
  },
  note(input: NoteInput): number {
    const id = nextId++;
    const { notes } = useFx.getState();
    // Several badges at once become one note.
    if (input.kind === 'achievement') {
      const prev = notes.find((n) => n.kind === 'achievement');
      if (prev && prev.kind === 'achievement') {
        useFx.setState({
          notes: notes.map((n) =>
            n.id === prev.id
              ? {
                  ...prev,
                  achievementIds: [...prev.achievementIds, ...input.achievementIds],
                  gold: prev.gold + input.gold,
                }
              : n,
          ),
        });
        return prev.id;
      }
    }
    useFx.setState({ notes: [...notes, { ...input, id } as NoteFx].slice(-3) });
    return id;
  },
  celebrate(input: CelebrationInput): number {
    const { celebrations } = useFx.getState();
    const last = celebrations[celebrations.length - 1];
    if (input.kind === 'level' && last?.kind === 'level') {
      const merged = {
        ...last,
        level: Math.max(last.level, input.level),
        fromLevel: Math.min(last.fromLevel, input.fromLevel),
        goldGift: last.goldGift + input.goldGift,
        milestone: last.milestone || input.milestone,
      };
      useFx.setState({ celebrations: [...celebrations.slice(0, -1), merged] });
      return last.id;
    }
    const id = nextId++;
    useFx.setState((s) => ({
      celebrations: [...s.celebrations, { ...input, id } as CelebrationFx],
    }));
    return id;
  },
  dismissFloat(id: number) {
    useFx.setState((s) => ({ floats: s.floats.filter((f) => f.id !== id) }));
  },
  dismissNote(id: number) {
    useFx.setState((s) => ({ notes: s.notes.filter((n) => n.id !== id) }));
  },
  dismissCelebration(id: number) {
    useFx.setState((s) => ({ celebrations: s.celebrations.filter((c) => c.id !== id) }));
  },
  clear() {
    useFx.setState({ floats: [], notes: [], celebrations: [] });
  },
};
