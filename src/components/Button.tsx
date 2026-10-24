// 공유 버튼. props: variant('primary'|'secondary'|'ghost'), size('md' 44px | 'lg' 52px), href(있으면 링크),
// external(새 탭 + 스크린리더 안내), icon/iconEnd(16~20px SVG), block(전폭). href가 없으면 <button>으로, 나머지 props는 그대로 전달.
// 색·hover는 테마 토큰(--btn-primary-*)을 쓰는 Button.module.css에 있다. 위치·여백은 style로 넘긴다.
import Link from 'next/link';
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';
import styles from './Button.module.css';

type Common = {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'md' | 'lg';
  icon?: ReactNode;
  iconEnd?: ReactNode;
  block?: boolean;
  children: ReactNode;
};

type AsLink = Common & { href: string; external?: boolean } & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'children'>;
type AsButton = Common & { href?: undefined; external?: never } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'>;

export type ButtonProps = AsLink | AsButton;

export default function Button(props: ButtonProps) {
  const { variant = 'primary', size = 'md', icon, iconEnd, block, children, className, ...rest } = props;
  const cls = [styles.btn, styles[variant], styles[size], block ? styles.block : '', className ?? '']
    .filter(Boolean)
    .join(' ');
  const inner = (
    <>
      {icon && <span className={styles.icon} aria-hidden="true">{icon}</span>}
      <span>{children}</span>
      {iconEnd && <span className={styles.icon} aria-hidden="true">{iconEnd}</span>}
    </>
  );

  if (rest.href !== undefined) {
    const { href, external, ...anchor } = rest as Omit<AsLink, keyof Common | 'className'>;
    if (external) {
      return (
        <a href={href} target="_blank" rel="noreferrer" className={cls} {...anchor}>
          {inner}
          <span className={styles.srOnly}> (새 탭에서 열림)</span>
        </a>
      );
    }
    return (
      <Link href={href} className={cls} {...anchor}>
        {inner}
      </Link>
    );
  }

  const { type = 'button', ...button } = rest as Omit<AsButton, keyof Common | 'className'>;
  return (
    <button type={type} className={cls} {...button}>
      {inner}
    </button>
  );
}
