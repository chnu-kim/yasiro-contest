import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
  },
  // 페이지 사이 이동만 부드럽게(React <ViewTransition>, layout). 'page' 타입이 붙은 링크에서만 움직인다
  experimental: {
    viewTransition: true,
  },
  // 방명록(/to-yasiro)은 2026-11에 없앴다. 검색엔진에 남은 주소는 홈으로 영구 이동
  async redirects() {
    return [{ source: '/to-yasiro', destination: '/', permanent: true }];
  },
};

export default nextConfig;
