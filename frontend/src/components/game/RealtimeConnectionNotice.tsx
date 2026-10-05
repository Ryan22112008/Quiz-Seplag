import { useRealtimeStore } from '@/stores/realtimeStore';
import { Alert } from '@/components/ui/Alert';

export function RealtimeConnectionNotice() {
  const state = useRealtimeStore((store) => store.connectionState);
  if (state === 'synced') return null;
  const copy: Record<Exclude<typeof state, 'synced'>, { title: string; message: string }> = {
    disconnected: { title: 'Conexão interrompida', message: 'Tentaremos restabelecer a conexão com a sala.' },
    connecting: { title: 'Conectando à sala', message: 'Preparando sua entrada na partida.' },
    connected: { title: 'Sincronizando', message: 'Recebendo o estado atual da sala.' },
    reconnecting: { title: 'Restabelecendo conexão', message: 'Aguarde enquanto voltamos à sala.' },
    syncing: { title: 'Atualizando partida', message: 'Carregando as informações mais recentes.' },
    error: { title: 'Sem conexão', message: 'Não foi possível conectar à sala. Confira sua internet e tente novamente.' },
  };
  return <Alert variant="warning" title={copy[state].title}>{copy[state].message}</Alert>;
}
