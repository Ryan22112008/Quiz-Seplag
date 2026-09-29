import { useParams } from 'react-router-dom';
import { ComingSoonPage } from './ComingSoonPage';

/**
 * TEMPORARY — target of the PIN form (`/jogar/:pin`).
 * It only proves the navigation works: lobby/game screens belong to the next step.
 */
export function PlayPage() {
  const { pin } = useParams<{ pin: string }>();

  return (
    <ComingSoonPage
      title="A partida ainda não está disponível"
      description={
        pin
          ? `O PIN ${pin} foi aceito e a navegação até aqui já funciona. Lobby e jogo chegam nas próximas etapas.`
          : 'Informe um PIN válido para entrar em uma partida.'
      }
    />
  );
}
