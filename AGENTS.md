<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

## 프로젝트 개요

야시로 스트리머 팬사이트 대회 출품 프로젝트. 출품작을 여러 개 제출 예정이며, 디자인 시스템을 공유하면서 각 출품작은 독립 페이지로 격리.

- **Stack:** Next.js 16.2.9 (App Router) · TypeScript · pnpm · CSS Modules + inline styles
- **폰트:** Google Fonts `<link>` (next/font 사용 안 함 — 한국어 subset 호환성 문제)
- **배포:** Cloudflare Pages (정적 export) · `pnpm deploy`
- **프로덕션:** https://yasiro-contest.pages.dev

---

## 파일 구조

```
src/
  app/
    layout.tsx          ← RootLayout, 폰트 <link>, 테마 초기화 스크립트
    globals.css         ← CSS 변수(토큰), keyframe 애니메이션만
    page.tsx            ← 랜딩(/) 출품작
    page.module.css     ← 랜딩 전용 인터랙션 스타일
    [출품작명]/
      page.tsx          ← 각 출품작 (격리)
      page.module.css
  components/
    Nav.tsx             ← 공유 네비게이션
    Nav.module.css
public/
  yashiro1.png          ← 야시로 캐릭터 (전신, 스팀펑크 고글)
  yashiro4.png          ← 야시로 캐릭터 (대체)
  kkul.png              ← 꿀붕이 마스코트 (nav·footer·히어로에 사용)
```

---

## CSS 규칙

### Module vs inline 기준

| 상황 | 방법 |
|---|---|
| hover, transition, animation, blend-mode 등 인터랙션/효과 | CSS Module |
| layout, spacing, typography, color 등 정적 스타일 | inline style (JSX) |

### 페이지 격리 원칙

각 출품작은 독립 `page.module.css`를 가진다. 공통 유틸리티 클래스를 `globals.css`에 추가하지 않는다.
공유 레이어는 CSS 토큰(`globals.css`)과 컴포넌트(`Nav`, `Footer`)뿐.

---

## 디자인 토큰 (`globals.css`)

### 색상 변수

| 변수 | 라이트 | 다크 |
|---|---|---|
| `--bg` | `#F5F0E8` | `#1A1814` |
| `--surface` | `#E8DFD0` | `#2C2118` |
| `--border` | `rgba(26,24,20,0.14)` | `rgba(245,240,232,0.12)` |
| `--text` | `#1A1814` | `#F0E8D8` |
| `--text-dim` | `#7A6550` | `#9E8A6E` |
| `--accent` | `#C47A0A` | `#F5A623` |
| `--accent-d` | `#9E6008` | `#D4891A` |
| `--accent-bg` | `rgba(196,122,10,0.10)` | `rgba(245,166,35,0.10)` |

### 스페이싱 / 반경

```
--gutter: 48px    ← 페이지 좌우 표준 여백 (footer, section 등)
--radius-sm: 3px  ← 표준 border-radius (버튼, 배지, 카드)
```

---

## 폰트

```
Cinzel         400·600·700  ← 영문 레이블, YASHIRO 로고, Nav
Noto Sans KR   300·400·500·700  ← 본문, UI 텍스트
Noto Serif KR  700·900  ← 야시로 타이틀 헤드라인
```

로드는 `layout.tsx <head>` 의 Google Fonts `<link>` 태그. `next/font`로 교체하지 말 것.

---

## 테마 시스템

- `localStorage` 키: `yashiro-theme` (`"light"` | `"dark"`)
- `document.documentElement` 에 `data-theme` attribute 설정
- flash 방지: `layout.tsx`에 inline `<script>` 로 초기화 (SSR/hydration 전에 실행)
- CSS는 `:root` (라이트) + `[data-theme="dark"]` 패턴

**Nav 테마 아이콘 패턴 (CSS-only — useState 없음):**

```css
.iconLight { display: block; }
.iconDark  { display: none; }
:global([data-theme="dark"]) .iconDark  { display: block; }
:global([data-theme="dark"]) .iconLight { display: none; }
```

두 아이콘을 모두 렌더링하고 CSS로 show/hide. React state 쓰면 hydration 불일치 발생.

---

## 이미지 블렌드 모드 규칙

- 밝은 배경 위 → `mix-blend-mode: multiply` (흰색 → 투명)
- 어두운 배경 위 → `mix-blend-mode: screen`
- 히어로 캐릭터 패널 배경은 `#EAE0D0` **고정** — 다크 모드에서도 바꾸지 말 것
  (배경을 어둡게 바꾸면 multiply blend가 캐릭터를 뭉갬)

---

## 애니메이션 키프레임 (`globals.css`)

| 이름 | 용도 |
|---|---|
| `blink` | 1.6s — LIVE 도트 깜빡임 |
| `float` | 3~3.5s — 꿀붕이 마스코트 부유 |
| `fadeUp` | 0.7s — 히어로 좌측 진입 |

---

## 공통 UI 패턴

### 강조 배지

```tsx
<div style={{
  display: 'inline-flex', alignItems: 'center', gap: 8,
  border: '1px solid var(--accent)', padding: '6px 14px',
  borderRadius: 'var(--radius-sm)', background: 'var(--accent-bg)', width: 'fit-content',
}}>
  <span style={{ width: 7, height: 7, background: 'var(--accent)',
    display: 'inline-block', borderRadius: 1, flexShrink: 0 }} />
  <span style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 500,
    letterSpacing: '0.07em' }}>레이블</span>
</div>
```

`borderRadius: 1` — 의도된 값. `--radius-sm`(3px)로 바꾸면 원형이 됨.

### 카드 hover (CSS Module)

```css
.card {
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  transition: transform 0.2s, border-color 0.2s, box-shadow 0.2s;
}
.card:hover {
  transform: translateY(-3px);
  border-color: var(--accent);
  box-shadow: 0 4px 16px rgba(196,122,10,0.12);
}
```

### 섹션 구분선

```tsx
<div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
  <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
    <span style={{ width: 7, height: 7, background: 'var(--accent)', borderRadius: 1 }} />
    <span style={{ fontSize: 12, color: 'var(--text-dim)', letterSpacing: '0.07em' }}>{label}</span>
  </div>
  <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
</div>
```

---

## static export 설정 (`next.config.ts`)

```ts
const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
};
```

`next/image`의 `fill` prop과 `sizes` 사용 가능. `loader` 커스터마이징 불필요.

---

## 배포

```bash
pnpm build    # out/ 생성
pnpm deploy   # wrangler pages deploy out --project-name yasiro-contest
```

CI/CD: GitHub Actions (`.github/workflows/deploy.yml`) — main push 시 자동 실행.
wrangler 4.x는 Node.js 22+ 필요.
