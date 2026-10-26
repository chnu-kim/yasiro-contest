import { defineConfig } from "vitest/config";

// /games 모듈(src/lib/games/**, src/lib/chzzk-category.ts)과 인증·세션 모듈(session, auth-routes, chzzk-auth)은 100% 커버리지를 강제한다.
// src/lib/games/** 에 포함되는 D1 전환 모듈: rows, repo, admin, diff, patch, youtube-meta, seed, api.
// test-d1.ts는 테스트 전용 D1 대역(node:sqlite)이라 제외한다(자체 동작은 test-d1.test.ts로 확인).
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    coverage: {
      provider: "v8",
      include: ["src/lib/**/*.ts"],
      exclude: ["src/lib/**/*.test.ts", "src/lib/**/types.ts", "src/lib/games/test-d1.ts"],
      reporter: ["text", "json-summary"],
      thresholds: {
        "src/lib/games/**": { lines: 100, branches: 100, functions: 100, statements: 100 },
        "src/lib/chzzk-category.ts": { lines: 100, branches: 100, functions: 100, statements: 100 },
        "src/lib/session.ts": { lines: 100, branches: 100, functions: 100, statements: 100 },
        "src/lib/auth-routes.ts": { lines: 100, branches: 100, functions: 100, statements: 100 },
        "src/lib/chzzk-auth.ts": { lines: 100, branches: 100, functions: 100, statements: 100 },
      },
    },
  },
});
