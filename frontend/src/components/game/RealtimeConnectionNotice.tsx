import { useRealtimeStore } from '@/stores/realtimeStore';
import { Alert } from '@/components/ui/Alert';

export function RealtimeConnectionNotice() {
  const state = useRealtimeStore((store) => store.connectionState);
  if (state === 'synced') return null;
  const copy: Record<Exclude<typeof state, 'synced'>, { title: string; message: string }> = {
    disconnected: { title: 'Conexão interrompida', message: 'Tentaremos restabelecer a conexão com a sala.' },
    connecting: { title: 'Conectando', message: 'Estabelecendo conexão com o servidor.' },
    connected: { title: 'Sincronizando', message: 'Recebendo o estado atual da sala.' },
    reconnecting: { title: 'Reconectando', message: 'A sala continua sob controle do servidor. Aguarde a sincronização.' },
    syncing: { title: 'Sincronizando', message: 'Atualizando sala, partida, questão e ranking.' },
    error: { title: 'Conexão indisponível', message: 'Não foi possível conectar ao servidor realtime.' },
  };
  return <Alert variant="warning" title={copy[state].title}>{copy[state].message}</Alert>;
}
