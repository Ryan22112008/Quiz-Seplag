import { useRef, useState } from 'react';
import { ImagePlus, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { api } from '@/services/api/client';
import { imageSource } from '@/lib/imageSource';

export function ImagePicker({ value, onChange, label }: { value?: string; onChange: (url?: string) => void; label: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const selectImage = async (file?: File) => {
    if (!file) return;
    setError('');
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
      setError('Use PNG, JPEG ou WebP de até 5 MB.');
      return;
    }
    setBusy(true);
    try { onChange(await api.uploadImage(file)); }
    catch (uploadError) { setError(uploadError instanceof Error ? uploadError.message : 'Não foi possível enviar a imagem.'); }
    finally { setBusy(false); if (inputRef.current) inputRef.current.value = ''; }
  };

  return <div className="flex flex-wrap items-center gap-2">
    <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" aria-label={label} onChange={(event) => void selectImage(event.target.files?.[0])} />
    <Button variant="outline" size="sm" disabled={busy} onClick={() => inputRef.current?.click()}><ImagePlus className="size-4" aria-hidden="true" />{busy ? 'Enviando…' : value ? 'Substituir imagem' : 'Adicionar imagem'}</Button>
    {value && <><img src={imageSource(value)} alt={`Prévia: ${label}`} className="size-14 rounded-md border border-border object-cover" /><Button variant="ghost" size="icon" aria-label={`Remover imagem: ${label}`} onClick={() => { onChange(undefined); setError(''); }}><X className="size-4" aria-hidden="true" /></Button></>}
    {error && <span role="alert" className="type-caption w-full text-danger-600">{error}</span>}
  </div>;
}
