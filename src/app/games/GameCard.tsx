
import { formatDate } from '@/lib/games/query';
import type { IndexedGame } from '@/lib/games/types';
import Poster from './Poster';
import styles from './GameCard.module.css';

export default function GameCard({
  game,
  onOpen,
}: {
  game: IndexedGame;
  onOpen: (game: IndexedGame, trigger: HTMLButtonElement) => void;
}) {
  return (
    <li className={styles.card}>
      <div className={styles.cardCover}>
        <Poster game={game} stampSize={88} stampStyle={{ right: -12, bottom: -18 }} />
      </div>
      <div className={styles.cardBody}>
        <h2 className={styles.cardTitle}>
          <button
            type="button"
            className={styles.cardOpen}
            aria-haspopup="dialog"
            data-game-id={game.id}
            onClick={(e) => onOpen(game, e.currentTarget)}
          >
            {game.name}
          </button>
        </h2>
        <p className={styles.cardMeta}>
          <span className={styles.date}>{formatDate(game.firstPlayed)}</span>
          {game.status === 'fail' && <span className={styles.failChip}>정복 못함</span>}
          {game.status === 'endless' && <span className={styles.endlessChip}>끝없는 탐험</span>}
          {game.status === 'clear' && <span className={styles.srOnly}>정복</span>}
        </p>
      </div>
    </li>
  );
}
