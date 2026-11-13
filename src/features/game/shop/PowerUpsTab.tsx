import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { db, useNow, type PowerUpType } from '@/data';
import { useFormat } from '@/i18n/useFormat';
import { Button, Card, Chip, Icon, showToast } from '@/ui';
import { POWER_UPS } from '../catalog/powerUps';
import {
  activateLuckyCharm,
  drinkDoubleXpPotion,
  luckyCharmActiveUntil,
  pendingPotion,
} from '../logic/powerUps';
import { buyPowerUp } from '../logic/shop';
import { scheduleRefresh } from '../setup';
import { useGameT } from '../ui/hooks';
import { BuyButton } from './common';

/** Power-ups: buy, see how many you have, use one; active state and time left. */
export function PowerUpsTab() {
  const { t, tx } = useGameT();
  const { number, duration } = useFormat();
  const now = useNow(30_000);
  const [busy, setBusy] = useState(false);
  const state = useLiveQuery(async () => {
    const units = (await db.inventory.where('kind').equals('power_up').toArray()).filter(
      (i) => i.deleted_at === null && i.used_at === null,
    );
    await db.power_up_activations.count();
    return {
      counts: Object.fromEntries(
        POWER_UPS.map((p) => [p.type, units.filter((u) => u.ref_id === p.type).length]),
      ) as Record<PowerUpType, number>,
      charmUntil: await luckyCharmActiveUntil(),
      potionWaiting: !!(await pendingPotion()),
    };
  }, [now]);

  const use = async (type: PowerUpType) => {
    setBusy(true);
    try {
      if (type === 'lucky_charm') {
        await activateLuckyCharm();
        showToast({ title: t('powerups.charm_on'), tone: 'gold', icon: 'leaf' });
      } else if (type === 'double_xp_potion') {
        const { appliedNow } = await drinkDoubleXpPotion();
        showToast({
          title: appliedNow ? t('powerups.potion_now') : t('powerups.potion_next'),
          tone: 'xp',
          icon: 'potion',
        });
      }
      scheduleRefresh();
    } catch {
      showToast({ title: t('shop.error_generic'), tone: 'warning' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted">{t('powerups.intro')}</p>
      <ul className="grid gap-3 sm:grid-cols-3">
        {POWER_UPS.map((p) => {
          const count = state?.counts[p.type] ?? 0;
          const charmLeft =
            p.type === 'lucky_charm' && state?.charmUntil ? state.charmUntil - now : null;
          const potionWaiting = p.type === 'double_xp_potion' && state?.potionWaiting;
          const name = tx(`powerups.${p.type}.name`);
          return (
            <Card
              as="li"
              key={p.type}
              className="flex flex-col gap-3"
              data-testid={`powerup-${p.type}`}
            >
              <div className="flex items-center gap-3">
                <span className="grid size-12 shrink-0 place-items-center rounded-full bg-xp-soft text-xp">
                  <Icon name={p.icon} size={28} />
                </span>
                <div className="min-w-0">
                  <h3 className="font-bold">{name}</h3>
                  <Chip size="sm" tone="gold" icon="coin">
                    {t('shop.price', { price: number(p.price) })}
                  </Chip>
                </div>
              </div>
              <p className="text-sm text-muted">{tx(`powerups.${p.type}.description`)}</p>
              <p className="text-sm font-bold" data-testid="powerup-count">
                {t('powerups.owned', { count: number(count) as never })}
              </p>
              {charmLeft !== null && charmLeft > 0 && (
                <Chip tone="success" icon="sparkle" data-testid="powerup-active">
                  {t('powerups.active_until', { time: duration(charmLeft) })}
                </Chip>
              )}
              {potionWaiting && (
                <Chip tone="xp" icon="potion" data-testid="powerup-active">
                  {t('powerups.potion_waiting')}
                </Chip>
              )}
              <div className="mt-auto flex flex-col gap-2">
                <BuyButton
                  price={p.price}
                  label={`${t('shop.buy')}: ${name}`}
                  onBuy={() => buyPowerUp(p.type)}
                />
                {p.type === 'daily_reroll'
                  ? count > 0 && <p className="text-sm text-muted">{t('powerups.reroll_hint')}</p>
                  : count > 0 && (
                      <Button
                        variant="secondary"
                        icon="bolt"
                        disabled={busy || (charmLeft ?? 0) > 0 || !!potionWaiting}
                        aria-label={`${t('powerups.activate')}: ${name}`}
                        onClick={() => void use(p.type)}
                      >
                        {(charmLeft ?? 0) > 0
                          ? t('powerups.already_active')
                          : t('powerups.activate')}
                      </Button>
                    )}
              </div>
            </Card>
          );
        })}
      </ul>
    </div>
  );
}
