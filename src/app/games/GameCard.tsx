import { Eye, Pencil } from 'lucide-react';
import { formatDate } from '@/lib/games/query';
import type { BoardGame } from './boardTypes';
import Poster from './Poster';
import styles from './GameCard.module.css';

export interface CardAdmin {
  onEdit: (game: BoardGame, trigger: HTMLButtonElement) => void;
  onUnhide: (game: BoardGame) => void;
}

export default function GameCard({
  game,
  onOpen,
  admin,
}: {
  game: BoardGame;
  onOpen: (game: BoardGame, trigger: HTMLButtonElement) => void;
  admin?: CardAdmin;
}) {
  return (
    <li className={game.hidden ? `${styles.card} ${styles.isHidden}` : styles.card}>
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
          {game.hidden && <span className={styles.hiddenChip}>숨김</span>}
          <span className={styles.date}>{formatDate(game.firstPlayed)}</span>
          {game.status === 'fail' && <span className={styles.failChip}>정복 못함</span>}
          {game.status === 'endless' && <span className={styles.endlessChip}>끝없는 탐험</span>}
          {game.status === 'clear' && <span className={styles.srOnly}>정복</span>}
        </p>
      </div>
      {admin && !game.hidden && (
        // 제목 버튼의 ::after가 카드 전체를 덮으므로 형제로 두고 z-index로 위에 올린다. 마우스 호버·키보드 포커스에서만 보이고 터치 기기에서는 숨긴다.
        <button
          type="button"
          className={styles.editChip}
          aria-label={`${game.name} 수정`}
          onClick={(e) => admin.onEdit(game, e.currentTarget)}
        >
          <Pencil size={14} strokeWidth={1.8} aria-hidden="true" />
          수정
        </button>
      )}
      {admin && game.hidden && (
        <button type="button" className={styles.unhideBtn} onClick={() => admin.onUnhide(game)}>
          <Eye size={16} strokeWidth={1.8} aria-hidden="true" />
          <span>
            다시 보이기<span className={styles.srOnly}>: {game.name}</span>
          </span>
        </button>
      )}
    </li>
  );
}
