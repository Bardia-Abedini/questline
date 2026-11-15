import { useState } from 'react';
import { useFormat } from '@/i18n/useFormat';
import { InsufficientGoldError } from '@/services';
import { Button, Icon, showToast } from '@/ui';
import { AlreadyOwnedError, ItemLockedError } from '../logic/shop';
import { scheduleRefresh } from '../setup';
import { useGameT, useGold } from '../ui/hooks';

/** Friendly "almost there" note instead of an error. */
export function NeedMore({ missing }: { missing: number }) {
  const { t } = useGameT();
  const { number } = useFormat();
  return (
    <p className="flex items-start gap-1.5 text-sm text-gold-text" data-testid="need-more">
      <Icon name="coin" size={16} className="mt-0.5 shrink-0 text-gold" />
      <span>
        <span className="font-bold">{t('shop.need_more', { n: number(missing) })}</span>{' '}
        <span className="text-muted">{t('shop.need_more_hint')}</span>
      </span>
    </p>
  );
}

/**
 * A buy button that shows the friendly not-enough-gold note when the player is short, and
 * turns any purchase error into a gentle message.
 */
export function BuyButton({
  price,
  onBuy,
  label,
  disabled,
  size = 'md',
  fullWidth,
}: {
  price: number;
  onBuy: () => Promise<unknown>;
  label?: string;
  disabled?: boolean;
  size?: 'sm' | 'md';
  fullWidth?: boolean;
}) {
  const { t } = useGameT();
  const { number } = useFormat();
  const gold = useGold();
  const [busy, setBusy] = useState(false);
  if (gold < price) return <NeedMore missing={price - gold} />;
  return (
    <Button
      size={size}
      icon="coin"
      loading={busy}
      disabled={disabled}
      fullWidth={fullWidth}
      aria-label={label}
      onClick={async () => {
        setBusy(true);
        try {
          await onBuy();
          showToast({ title: t('shop.bought'), tone: 'gold', duration: 2500 });
          scheduleRefresh();
        } catch (error) {
          if (error instanceof InsufficientGoldError) {
            showToast({
              title: t('shop.need_more', {
                n: number(error.needed - error.available),
              }),
              description: t('shop.need_more_hint'),
              tone: 'gold',
            });
          } else if (error instanceof ItemLockedError) {
            showToast({ title: t('shop.locked', { level: number(error.level) }), tone: 'info' });
          } else if (!(error instanceof AlreadyOwnedError)) {
            showToast({ title: t('shop.error_generic'), tone: 'warning' });
          }
        } finally {
          setBusy(false);
        }
      }}
    >
      {t('shop.buy_for', { price: number(price) })}
    </Button>
  );
}
