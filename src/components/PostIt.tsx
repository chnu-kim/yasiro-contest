import type { CSSProperties } from 'react';
import styles from './PostIt.module.css';
import { getPostItStyle } from '@/lib/guestbook';

// 종이색은 탐험 톤 5색. getPostItStyle은 0~6을 돌려주므로 5로 접는다(색 선택 로직 자체는 lib 그대로).
const TONES = 5;

interface PostItProps {
  id: string;
  message: string;
  channelName: string;
  size?: 'default' | 'sm';
}

export default function PostIt({ id, message, channelName, size = 'default' }: PostItProps) {
  const { colorIndex, rotation } = getPostItStyle(id);
  const tone = colorIndex % TONES;

  return (
    <div className={`${styles.wrap} ${styles[`pin${tone}`]}`}>
      <div
        className={`${styles.card} ${styles[`color${tone}`]} ${size === 'sm' ? styles.sm : ''}`}
        style={{ '--rot': `${rotation}deg` } as CSSProperties}
      >
        <p className={styles.message}>{message}</p>
        <p className={styles.author}>— {channelName}</p>
      </div>
    </div>
  );
}
