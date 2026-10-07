import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { avatarCharacters, DEFAULT_AVATAR_CHARACTER, type AvatarCharacterId } from '@/lib/playerAvatarOptions';

interface AvatarPickerModalProps {
  open: boolean;
  name: string;
  characterId?: string;
  onClose: () => void;
  onSave: (characterId: AvatarCharacterId) => void;
}

export function AvatarPickerModal({ open, name, characterId, onClose, onSave }: AvatarPickerModalProps) {
  const [character, setCharacter] = useState<AvatarCharacterId>((characterId as AvatarCharacterId) || DEFAULT_AVATAR_CHARACTER);
  useEffect(() => {
    if (open) setCharacter((characterId as AvatarCharacterId) || DEFAULT_AVATAR_CHARACTER);
  }, [open, characterId]);

  return <Modal open={open} onClose={onClose} title="Personalize seu avatar" description="Escolha o personagem que vai aparecer no jogo." actions={<><Button variant="outline" onClick={onClose}>Cancelar</Button><Button onClick={() => onSave(character)}><Check className="size-4" />Pronto</Button></>}>
    <div className="mb-5 flex flex-col items-center rounded-2xl border border-border bg-surface-muted p-4">
      <span className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">Pré-visualização</span>
      <Avatar name={name || 'Jogador'} size="xl" characterId={character} className="ring-4 ring-white/10 shadow-lg" />
      <span className="mt-2 text-sm font-semibold text-neutral-900">{name || 'Seu personagem'}</span>
    </div>
    <div role="tabpanel" aria-label="Personagem" className="grid grid-cols-4 gap-2 sm:grid-cols-4">{avatarCharacters.map((item) => <button key={item.id} type="button" aria-label={item.label} aria-pressed={character === item.id} onClick={() => setCharacter(item.id)} className={`flex flex-col items-center gap-1 rounded-xl border p-2 transition hover:border-primary-400 hover:bg-primary-50 ${character === item.id ? 'border-primary-500 bg-primary-50 ring-2 ring-primary-500/20' : 'border-border bg-surface'}`}><span className="text-3xl" aria-hidden="true">{item.emoji}</span><span className="text-[11px] font-medium text-neutral-700">{item.label}</span></button>)}</div>
  </Modal>;
}
