import { defineConfig } from "vitest/config";

// 새 /games 모듈(src/lib/games/**, src/lib/chzzk-category.ts)만 100% 커버리지를 강제한다.
// 기존 chzzk-auth.ts는 fetch 함수가 테스트 밖이라 전역 threshold는 두지 않는다.
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    coverage: {
      provider: "v8",
      include: ["src/lib/**/*.ts"],
      exclude: ["src/lib/**/*.test.ts", "src/lib/**/types.ts"],
      reporter: ["text", "json-summary"],
      thresholds: {
        "src/lib/games/**": { lines: 100, branches: 100, functions: 100, statements: 100 },
        "src/lib/chzzk-category.ts": { lines: 100, branches: 100, functions: 100, statements: 100 },
      },
    },
  },
});
