import { useEffect, useState } from 'react';
import { AvatarSvg } from '@/art/avatar/AvatarSvg';
import { usePlayerStats } from '@/data';
import { Button, Card, Input, Select, showToast, ToggleChip } from '@/ui';
import { AVATAR_SLOTS, cosmeticsForSlot, type AvatarSlot } from '../catalog/cosmetics';
import { availableTitles } from '../catalog/titles';
import { equipAvatar, setDisplayName, setTitle } from '../logic/looks';
import { scheduleRefresh } from '../setup';
import { ItemPicker } from '../ui/ItemPicker';
import { useGameT, useLooks, useOwnedCosmetics } from '../ui/hooks';

const OPTIONAL: AvatarSlot[] = ['hat', 'accessory'];

/** The avatar editor: name, title and one slot at a time. */
export function AdventurerPanel() {
  const { t, tx } = useGameT();
  const { profile, look } = useLooks();
  const owned = useOwnedCosmetics() ?? new Set<string>();
  const level = usePlayerStats()?.level.level ?? 1;
  const [slot, setSlot] = useState<AvatarSlot>('hair');
  const [name, setName] = useState('');
  const savedName = profile?.display_name ?? '';
  useEffect(() => setName(savedName), [savedName]);

  const pick = async (id: string | null) => {
    try {
      await equipAvatar(slot, id);
      scheduleRefresh();
    } catch {
      showToast({ title: t('shop.error_generic'), tone: 'warning' });
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="mx-auto shrink-0 rounded-xl bg-primary-soft p-2">
          <AvatarSvg look={look} size={160} title={t('avatar.editor_title')} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void setDisplayName(name).then(() =>
                showToast({ title: t('avatar.name_saved'), tone: 'success' }),
              );
            }}
          >
            <Input
              label={t('avatar.name_label')}
              value={name}
              maxLength={40}
              placeholder={t('home.name_placeholder')}
              onChange={(e) => setName(e.target.value)}
              wrapperClassName="min-w-0 flex-1"
            />
            <Button type="submit" variant="secondary" disabled={name.trim() === savedName}>
              {t('avatar.save_name')}
            </Button>
          </form>
          <Select
            label={t('home.title_label')}
            value={profile?.title_id ?? ''}
            onChange={(e) => void setTitle(e.target.value || null)}
            options={[
              { value: '', label: t('home.no_title') },
              ...availableTitles(level).map((ti) => ({ value: ti.id, label: tx(ti.nameKey) })),
            ]}
          />
        </div>
      </Card>

      <div role="group" aria-label={t('avatar.slot_label')} className="flex flex-wrap gap-1.5">
        {AVATAR_SLOTS.map((s) => (
          <ToggleChip key={s} selected={slot === s} onChange={() => setSlot(s)}>
            {tx(`slots.${s}`)}
          </ToggleChip>
        ))}
      </div>
      <ItemPicker
        label={tx(`slots.${slot}`)}
        items={cosmeticsForSlot(slot)}
        owned={owned}
        selected={look[slot]}
        wearer={look}
        level={level}
        noneLabel={OPTIONAL.includes(slot) ? t('avatar.none') : undefined}
        onPick={(id) => void pick(id)}
      />
    </div>
  );
}
