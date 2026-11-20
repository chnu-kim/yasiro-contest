import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
  },
  // 방명록(/to-yasiro)은 2026-11에 없앴다. 검색엔진에 남은 주소는 홈으로 영구 이동
  async redirects() {
    return [{ source: '/to-yasiro', destination: '/', permanent: true }];
  },
};

export default nextConfig;
