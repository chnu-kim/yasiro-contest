import { ViewTransition } from 'react';

// template는 경로가 바뀔 때마다 새로 붙으므로 <ViewTransition>의 enter/exit가 페이지 단위로 일어난다(layout에 두면 update라 안 움직인다).
// 'page' 타입 링크(lib/page-transition)로 옮길 때만 본문이 살짝 바뀐다. 필터·첫 로드·뒤로 가기는 그대로(default none).
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <ViewTransition enter={{ page: 'page-in', default: 'none' }} exit={{ page: 'page-out', default: 'none' }} default="none">
      {children}
    </ViewTransition>
  );
}
