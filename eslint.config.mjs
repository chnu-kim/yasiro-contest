import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // no-page-custom-font는 Pages Router(_document.js)용 규칙이다. App Router의 루트 layout에 둔
    // Google Fonts <link>는 모든 페이지에 적용되므로 오탐이다. next/font는 한국어 subset 문제로
    // 쓰지 않는다(CLAUDE.md 스타일). 폰트를 로드하는 이 파일에서만 끈다.
    files: ["src/app/layout.tsx"],
    rules: { "@next/next/no-page-custom-font": "off" },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Cloudflare 빌드·로컬 런타임 산출물
    ".open-next/**",
    ".wrangler/**",
  ]),
]);

export default eslintConfig;
