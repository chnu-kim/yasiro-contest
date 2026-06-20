import styles from './PostIt.module.css';
import { getPostItStyle } from '@/lib/guestbook';

interface PostItProps {
  id: string;
  message: string;
  channelName: string;
  size?: 'default' | 'sm';
}

export default function PostIt({ id, message, channelName, size = 'default' }: PostItProps) {
  const { colorIndex, rotation } = getPostItStyle(id);

  return (
    <div className={`${styles.wrap} ${styles[`pin${colorIndex}`]}`}>
      <div
        className={`${styles.card} ${styles[`color${colorIndex}`]} ${size === 'sm' ? styles.sm : ''}`}
        style={{ transform: `rotate(${rotation}deg)` }}
      >
        <p className={styles.message}>{message}</p>
        <p className={styles.author}>— {channelName}</p>
      </div>
    </div>
  );
}
