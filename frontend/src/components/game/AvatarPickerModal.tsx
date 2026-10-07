import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { avatarAccessories, avatarCharacters, DEFAULT_AVATAR_ACCESSORY, DEFAULT_AVATAR_CHARACTER, type AvatarAccessoryId, type AvatarCharacterId } from '@/lib/playerAvatarOptions';

type AvatarTab = 'character' | 'accessory';
interface AvatarPickerModalProps {
  open: boolean;
  name: string;
  characterId?: string;
  accessoryId?: string;
  onClose: () => void;
  onSave: (characterId: AvatarCharacterId, accessoryId: AvatarAccessoryId) => void;
}

export function AvatarPickerModal({ open, name, characterId, accessoryId, onClose, onSave }: AvatarPickerModalProps) {
  const [tab, setTab] = useState<AvatarTab>('character');
  const [character, setCharacter] = useState<AvatarCharacterId>((characterId as AvatarCharacterId) || DEFAULT_AVATAR_CHARACTER);
  const [accessory, setAccessory] = useState<AvatarAccessoryId>((accessoryId as AvatarAccessoryId) || DEFAULT_AVATAR_ACCESSORY);
  useEffect(() => {
    if (open) { setCharacter((characterId as AvatarCharacterId) || DEFAULT_AVATAR_CHARACTER); setAccessory((accessoryId as AvatarAccessoryId) || DEFAULT_AVATAR_ACCESSORY); setTab('character'); }
  }, [open, characterId, accessoryId]);

  return <Modal open={open} onClose={onClose} title="Personalize seu avatar" description="Escolha um personagem e um acessório para aparecer no jogo." actions={<><Button variant="outline" onClick={onClose}>Cancelar</Button><Button onClick={() => onSave(character, accessory)}><Check className="size-4" />Pronto</Button></>}>
    <div className="mb-5 flex flex-col items-center rounded-2xl border border-border bg-surface-muted p-4">
      <span className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">Pré-visualização</span>
      <Avatar name={name || 'Jogador'} size="xl" characterId={character} accessoryId={accessory} className="ring-4 ring-white/10 shadow-lg" />
      <span className="mt-2 text-sm font-semibold text-neutral-900">{name || 'Seu personagem'}</span>
    </div>
    <div role="tablist" aria-label="Categorias de personalização" className="mb-4 grid grid-cols-2 rounded-xl bg-neutral-100 p-1">
      <button type="button" role="tab" aria-selected={tab === 'character'} onClick={() => setTab('character')} className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${tab === 'character' ? 'bg-primary-600 text-white shadow-sm' : 'text-neutral-600 hover:text-neutral-900'}`}>Personagem</button>
      <button type="button" role="tab" aria-selected={tab === 'accessory'} onClick={() => setTab('accessory')} className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${tab === 'accessory' ? 'bg-primary-600 text-white shadow-sm' : 'text-neutral-600 hover:text-neutral-900'}`}>Acessório</button>
    </div>
    {tab === 'character' ? <div role="tabpanel" className="grid grid-cols-4 gap-2 sm:grid-cols-4">{avatarCharacters.map((item) => <button key={item.id} type="button" aria-label={item.label} aria-pressed={character === item.id} onClick={() => setCharacter(item.id)} className={`flex flex-col items-center gap-1 rounded-xl border p-2 transition hover:border-primary-400 hover:bg-primary-50 ${character === item.id ? 'border-primary-500 bg-primary-50 ring-2 ring-primary-500/20' : 'border-border bg-surface'}`}><span className="text-3xl" aria-hidden="true">{item.emoji}</span><span className="text-[11px] font-medium text-neutral-700">{item.label}</span></button>)}</div> : <div role="tabpanel" className="grid grid-cols-4 gap-2">{avatarAccessories.map((item) => <button key={item.id} type="button" aria-label={item.label} aria-pressed={accessory === item.id} onClick={() => setAccessory(item.id)} className={`flex min-h-20 flex-col items-center justify-center gap-1 rounded-xl border p-2 transition hover:border-primary-400 hover:bg-primary-50 ${accessory === item.id ? 'border-primary-500 bg-primary-50 ring-2 ring-primary-500/20' : 'border-border bg-surface'}`}><span className="text-3xl" aria-hidden="true">{item.emoji || '🙂'}</span><span className="text-[11px] font-medium text-neutral-700">{item.label}</span></button>)}</div>}
  </Modal>;
}
