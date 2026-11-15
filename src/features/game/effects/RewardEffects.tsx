import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router';
import { usePreferences } from '@/app/preferences/preferences';
import { PATHS } from '@/app/routing';
import { cottageTier, levelFromXp } from '@/domain/levels';
import { db, useSettings } from '@/data';
import { useFormat } from '@/i18n/useFormat';
import { useAppEvent } from '@/services';
import { Button, cx, Icon, IconButton } from '@/ui';
import { achievementById } from '../catalog/achievements';
import { cosmeticById, itemsUnlockedAt } from '../catalog/cosmetics';
import { titlesUnlockedAt } from '../catalog/titles';
import { ItemArt } from '../ui/ItemArt';
import { Badge } from '../ui/Badge';
import { useGameT } from '../ui/hooks';
import { defFor } from '../logic/dailyQuests';
import { buzz, playSound, useFxPrefs, type SoundName } from './sounds';
import { fx, useFx, type CelebrationFx, type FloatFx, type NoteFx } from './store';
import './effects.css';

/** Plays a sound and a buzz according to the player's settings. */
function useFeedback() {
  const settings = useSettings();
  const sound = usePreferences((s) => s.sound);
  const haptics = usePreferences((s) => s.haptics);
  const prefs = useFxPrefs();
  return (name: SoundName, small = false) => {
    if (small && prefs.celebrations === 'calm') return;
    if (sound) playSound(name, (settings?.sound_volume ?? 0.7) * prefs.volume);
    if (haptics) buzz(name === 'level' ? [20, 60, 30] : 12);
  };
}

/** Glows the header XP bar briefly (if the header is on screen). */
function pulseHeaderBar(reduceMotion: boolean) {
  if (reduceMotion) return;
  const bar = document.querySelector('header [role="progressbar"]');
  if (!(bar instanceof HTMLElement) || typeof bar.animate !== 'function') return;
  bar.animate(
    [
      { boxShadow: '0 0 0 0 transparent' },
      { boxShadow: '0 0 0 4px var(--ql-xp-soft), 0 0 12px var(--ql-xp)' },
      { boxShadow: '0 0 0 0 transparent' },
    ],
    { duration: 900, easing: 'ease-out' },
  );
}

function FloatPill({ f }: { f: FloatFx }) {
  const { t } = useGameT();
  const { number } = useFormat();
  const reduce = usePreferences((s) => s.resolved.reduceMotion);
  const before = levelFromXp(f.xpBefore);
  const after = levelFromXp(f.xpAfter);
  const start = before.progress;
  const end = after.level > before.level ? 1 : after.progress;
  const [width, setWidth] = useState(reduce ? end : start);
  useEffect(() => {
    const id = requestAnimationFrame(() => setWidth(end));
    const timer = window.setTimeout(() => fx.dismissFloat(f.id), reduce ? 2600 : 1900);
    return () => {
      cancelAnimationFrame(id);
      window.clearTimeout(timer);
    };
  }, [f.id, f.xp, f.gold, end, reduce]);

  return (
    <div
      key={`${f.id}-${f.xp}-${f.gold}`}
      className="qg-float pointer-events-none flex flex-col items-center gap-1.5 rounded-full border border-xp/30 bg-surface/95 px-4 py-2 shadow-lg"
      data-testid="reward-float"
    >
      {/* Amount and unit are separate boxes (spaced by the gap), so this pill never repeats
          the exact text of a screen's own reward summary; the full phrase is the label. */}
      <div
        role="img"
        aria-label={[
          f.xp > 0 ? t('effects.xp', { xp: number(f.xp) }) : '',
          f.gold > 0 ? t('effects.gold', { gold: number(f.gold) }) : '',
        ]
          .filter(Boolean)
          .join(' · ')}
        className="flex items-center gap-3 text-base font-extrabold"
      >
        {f.xp > 0 && (
          <span aria-hidden className="inline-flex items-center gap-1 text-xp">
            <Icon name="sparkle" filled size={18} />
            <span>+{number(f.xp)}</span>
            <span>{t('effects.xp_unit')}</span>
          </span>
        )}
        {f.gold > 0 && (
          <span aria-hidden className="inline-flex items-center gap-1 text-gold-text">
            <Icon name="coin" size={18} className="text-gold" />
            <span>+{number(f.gold)}</span>
            <span>{t('effects.gold_unit')}</span>
          </span>
        )}
      </div>
      {f.xp > 0 && (
        <div className="h-1.5 w-28 overflow-hidden rounded-full bg-xp-soft" aria-hidden>
          <div
            className="qg-bar-fill h-full rounded-full bg-xp"
            style={{ inlineSize: `${Math.round(width * 100)}%` }}
          />
        </div>
      )}
    </div>
  );
}

function NoteCard({ note }: { note: NoteFx }) {
  const { t, tx } = useGameT();
  const { number, lang } = useFormat();
  const navigate = useNavigate();
  useEffect(() => {
    const timer = window.setTimeout(() => fx.dismissNote(note.id), 5000);
    return () => window.clearTimeout(timer);
  }, [note]);

  let art: React.ReactNode = null;
  let title = '';
  let body = '';
  let link: string | null = null;
  switch (note.kind) {
    case 'achievement': {
      const first = achievementById(note.achievementIds[0]!);
      art = first ? <Badge def={first} unlocked size={44} /> : null;
      title =
        note.achievementIds.length > 1
          ? t('effects.achievements_several', { n: number(note.achievementIds.length) })
          : t('effects.achievement_title');
      body = t('effects.achievement_body', {
        name:
          note.achievementIds
            .slice(0, 2)
            .map((id) => tx(`achievements.${id}.name`))
            .join(lang === 'fa' ? '، ' : ', ') + (note.achievementIds.length > 2 ? '…' : ''),
        gold: number(note.gold),
      });
      link = `${PATHS.home}?tab=achievements`;
      break;
    }
    case 'loot_gold':
      art = <Icon name="coin" size={36} className="text-gold" />;
      title = t('effects.loot_gold_title');
      body = t('effects.loot_gold_body', { gold: number(note.amount) });
      break;
    case 'loot_item':
      art = <ItemArt itemId={note.itemId} size={44} />;
      title = t('effects.loot_item_title');
      body = t('effects.loot_item_body', {
        item: tx(cosmeticById(note.itemId)?.nameKey ?? note.itemId),
      });
      link = PATHS.home;
      break;
    case 'daily':
      art = <Icon name="sun" size={34} className="text-gold" />;
      title = t('effects.daily_done', { goal: tx(`daily.quests.${note.questKey}`) });
      body = t('daily.reward', { gold: number(note.gold) });
      break;
    case 'redeem':
      art = <Icon name="gift" size={34} className="text-primary" />;
      title = t('rewards.redeemed_title');
      body = t('rewards.redeemed_body', { title: note.title });
      break;
  }

  return (
    <div
      role="status"
      className="qg-pop pointer-events-auto flex w-full items-center gap-3 rounded-lg border-2 border-gold/40 bg-surface p-3 text-text shadow-lg"
      data-testid={`reward-note-${note.kind}`}
    >
      <span className="grid size-12 shrink-0 place-items-center">{art}</span>
      <div className="min-w-0 flex-1">
        <p className="font-bold">{title}</p>
        <p className="text-sm text-muted">{body}</p>
      </div>
      {link && (
        <button
          type="button"
          className="shrink-0 rounded-md px-2 py-1 text-sm font-bold text-primary hover:bg-surface-2"
          onClick={() => {
            fx.dismissNote(note.id);
            navigate(link);
          }}
        >
          {t('effects.see')}
        </button>
      )}
      <IconButton
        icon="close"
        size="sm"
        variant="ghost"
        label={t('effects.close')}
        onClick={() => fx.dismissNote(note.id)}
      />
    </div>
  );
}

const CONFETTI_COLORS = ['var(--ql-gold)', 'var(--ql-xp)', 'var(--ql-primary)', 'var(--ql-accent)'];

function Confetti() {
  const calm = useFxPrefs((s) => s.celebrations === 'calm');
  if (calm) return null;
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-visible">
      {Array.from({ length: 18 }, (_, i) => {
        const angle = (i / 18) * Math.PI * 2;
        const dist = 90 + (i % 3) * 30;
        return (
          <span
            key={i}
            className="qg-confetti"
            style={
              {
                background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
                animationDelay: `${(i % 4) * 30}ms`,
                '--qg-dx': `${Math.round(Math.cos(angle) * dist)}px`,
                '--qg-dy': `${Math.round(Math.sin(angle) * dist * 0.7)}px`,
                '--qg-rot': `${(i * 67) % 360}deg`,
              } as React.CSSProperties
            }
          />
        );
      })}
    </div>
  );
}

function CelebrationCard({ c }: { c: CelebrationFx }) {
  const { t, tx } = useGameT();
  const { number } = useFormat();
  const closeRef = useRef<HTMLButtonElement>(null);
  // In focus mode the card stays small and brief so the timer and step stay in view.
  const compact = useLocation().pathname.startsWith(PATHS.focus);
  useEffect(() => {
    const timer = window.setTimeout(() => fx.dismissCelebration(c.id), compact ? 3500 : 7000);
    return () => window.clearTimeout(timer);
  }, [c.id, compact]);
  const titleId = `qg-celebration-${c.id}`;

  const levels =
    c.kind === 'level'
      ? Array.from({ length: c.level - c.fromLevel + 1 }, (_, i) => c.fromLevel + i)
      : [];
  const items = levels.flatMap(itemsUnlockedAt);
  const titles = levels.flatMap(titlesUnlockedAt);
  const grew =
    c.kind === 'level' && c.milestone && cottageTier(c.level) > cottageTier(c.fromLevel - 1);

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      className="qg-pop pointer-events-auto relative w-full rounded-xl border-2 border-gold/50 bg-surface p-4 text-center text-text shadow-lg"
      data-testid={`celebration-${c.kind}`}
    >
      <Confetti />
      <div className="relative flex flex-col items-center gap-2">
        <span className="qg-glow grid size-12 place-items-center rounded-full bg-gold-soft text-gold">
          <Icon name={c.kind === 'boss' ? 'sword' : 'star'} filled size={32} />
        </span>
        <h2 id={titleId} className="text-2xl font-semibold">
          {c.kind === 'level'
            ? t('effects.level_up', { level: number(c.level) })
            : t('effects.boss_title')}
        </h2>
        {c.kind === 'level' ? (
          <>
            <p className="text-muted">{t('effects.level_up_body', { level: number(c.level) })}</p>
            {c.goldGift > 0 && (
              <p className="inline-flex items-center gap-1 rounded-full bg-gold-soft px-3 py-1 font-extrabold text-gold-text">
                <Icon name="coin" className="text-gold" />
                {t('effects.level_gift', { gold: number(c.goldGift) })}
              </p>
            )}
            {grew && <p className="font-bold text-accent">{t('effects.cottage_upgrade')}</p>}
            {titles.map((ti) => (
              <p key={ti.id} className="font-bold">
                {t('effects.unlocked_title', { title: tx(ti.nameKey) })}
              </p>
            ))}
            {!compact && items.length > 0 && (
              <div className="flex w-full flex-col items-center gap-1">
                <p className="text-sm font-bold text-muted">{t('effects.unlocked_items')}</p>
                <ul className="flex max-w-full flex-wrap justify-center gap-2">
                  {items.slice(0, 4).map((item) => (
                    <li key={item.id} className="flex w-16 flex-col items-center gap-0.5">
                      <span className="rounded-md bg-surface-2 p-1">
                        <ItemArt itemId={item.id} size={40} />
                      </span>
                      <span className="line-clamp-2 text-xs leading-tight">{tx(item.nameKey)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        ) : (
          <p className="text-muted">{t('effects.boss_body')}</p>
        )}
        <Button ref={closeRef} className="mt-2" onClick={() => fx.dismissCelebration(c.id)}>
          {t('effects.nice')}
        </Button>
      </div>
    </div>
  );
}

/**
 * Instant reward feedback on every route (focus mode too): floating +XP/+gold with a mini XP
 * bar, a glow on the header XP bar, loot and badge notes, level-up and boss celebrations,
 * synthesized sounds and a small buzz. Nothing here is modal; the player can keep tapping.
 */
export function RewardEffects() {
  const floats = useFx((s) => s.floats);
  const notes = useFx((s) => s.notes);
  const celebrations = useFx((s) => s.celebrations);
  const reduce = usePreferences((s) => s.resolved.reduceMotion);
  const feedback = useFeedback();

  useAppEvent('reward.granted', ({ grant }) => {
    const xp = grant.total.xp;
    const gold = grant.total.gold - grant.levelUps.reduce((s, l) => s + l.goldGift, 0);
    if (xp <= 0 && gold <= 0) return;
    fx.float({ xp, gold: Math.max(0, gold), xpBefore: grant.xpBefore, xpAfter: grant.xpAfter });
    pulseHeaderBar(reduce);
    feedback(xp > 0 ? 'step' : 'gold', true);
  });
  useAppEvent('level.up', (lu) => {
    fx.celebrate({ kind: 'level', ...lu, fromLevel: lu.level });
    feedback('level');
  });
  useAppEvent('loot.dropped', (loot) => {
    if (loot.kind === 'gold') fx.note({ kind: 'loot_gold', amount: loot.amount });
    else fx.note({ kind: 'loot_item', itemId: loot.itemId });
    feedback('loot');
  });
  useAppEvent('achievement.unlocked', ({ achievementId }) => {
    const def = achievementById(achievementId);
    fx.note({ kind: 'achievement', achievementIds: [achievementId], gold: def?.gold ?? 0 });
    feedback('achievement');
  });
  useAppEvent('quest.completed', ({ isBoss }) => {
    if (!isBoss) return;
    fx.celebrate({ kind: 'boss' });
    feedback('level');
  });
  useAppEvent('daily_quest.completed', ({ dailyQuestId, reward }) => {
    void db.daily_quests.get(dailyQuestId).then((row) => {
      if (row)
        fx.note({ kind: 'daily', questKey: defFor(row)?.key ?? row.quest_key, gold: reward.gold });
    });
  });
  useAppEvent('gold.spent', () => feedback('purchase', true));

  const celebration = celebrations[0];
  if (floats.length === 0 && notes.length === 0 && !celebration) return null;

  const top = 'top-[calc(var(--ql-header-h)+env(safe-area-inset-top)+0.5rem)]';
  // Two layers, so the pill fading out never moves the cards (no jump).
  return createPortal(
    <div aria-live="polite" data-testid="reward-effects">
      <div
        className={cx(
          'pointer-events-none fixed inset-x-0 z-[56] mx-auto flex w-full max-w-sm flex-col items-center gap-2 px-4',
          top,
        )}
      >
        {floats.map((f) => (
          <FloatPill key={f.id} f={f} />
        ))}
      </div>
      <div
        className={cx(
          'pointer-events-none fixed inset-x-0 z-[55] mx-auto mt-16 flex w-full max-w-sm flex-col items-center gap-2 px-4',
          top,
        )}
      >
        {celebration && <CelebrationCard key={celebration.id} c={celebration} />}
        {notes.map((n) => (
          <NoteCard key={n.id} note={n} />
        ))}
      </div>
    </div>,
    document.body,
  );
}
