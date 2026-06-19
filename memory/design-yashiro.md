---
name: design-yashiro
description: 야시로 사이트 공통 디자인 시스템 — 색상 토큰, 폰트, 애니메이션, 패턴, 페이지 구조
metadata:
  type: project
---

원본 디자인: `_design/design-handoff/untitled/project/야시로 스트리머 사이트.dc.html`

## 색상 토큰 (CSS 변수)

### 라이트 모드 (`:root`)
| 변수 | 값 | 용도 |
|---|---|---|
| `--bg` | `#F5F0E8` | 페이지 배경 |
| `--surface` | `#E8DFD0` | 카드·섹션 배경 |
| `--border` | `rgba(26,24,20,0.14)` | 테두리 |
| `--text` | `#1A1814` | 본문 |
| `--text-dim` | `#7A6550` | 보조 텍스트 |
| `--accent` | `#C47A0A` | 강조 (버튼, 하이라이트) |
| `--accent-d` | `#9E6008` | 강조 hover |
| `--accent-bg` | `rgba(196,122,10,0.10)` | 강조 배경 |
| `--gutter` | `48px` | 페이지 좌우 표준 여백 |
| `--radius-sm` | `3px` | 표준 border-radius |

### 다크 모드 (`[data-theme="dark"]`)
| 변수 | 값 |
|---|---|
| `--bg` | `#1A1814` |
| `--surface` | `#2C2118` |
| `--border` | `rgba(245,240,232,0.12)` |
| `--text` | `#F0E8D8` |
| `--text-dim` | `#9E8A6E` |
| `--accent` | `#F5A623` |
| `--accent-d` | `#D4891A` |
| `--accent-bg` | `rgba(245,166,35,0.10)` |

## 폰트
```
Cinzel         — 400·600·700  (숫자, 영문 레이블, YASHIRO 로고, Nav 로고)
Noto Sans KR   — 300·400·500·700  (본문, UI 텍스트)
Noto Serif KR  — 700·900  (야시로 타이틀 헤드라인)
```
로드: Google Fonts `<link>` (layout.tsx `<head>`) — next/font 아님 (한국어 subset 호환성)

## 애니메이션 키프레임 (globals.css)
- `blink` — 1.6s, LIVE 도트 깜빡임
- `float` — 3~3.5s, 꿀붕이 마스코트 부유
- `fadeUp` — 0.7s, 히어로 좌측 진입 애니메이션

## 이미지 에셋 (public/)
- `kkul.png` — 꿀붕이 마스코트. nav·footer·히어로 캐릭터 패널에 사용
- `yashiro1.png` — 야시로 캐릭터 (스팀펑크 고글, 전신)
- `yashiro4.png` — 야시로 캐릭터 (대체)

### 블렌드 모드 규칙
- 밝은 배경 위: `mix-blend-mode: multiply` (흰색 → 투명)
- 어두운 배경 위(`[data-theme="dark"]`): `mix-blend-mode: screen`
- 히어로 캐릭터 패널은 배경 `#EAE0D0` **고정** → 다크 모드에서도 항상 `multiply` OK
  (다크 모드에서 패널 배경을 바꾸면 캐릭터가 뭉개지기 때문)

## 디자인 감성
스팀펑크 + 따뜻한 크래프트 느낌. 베이지-황갈색 팔레트, 황금색 액센트.
모서리 `--radius-sm: 3px` 미니멀. 타이포 강약이 강함 (900 weight 헤드라인 vs 300 본문).

---

## 페이지 구조

### Nav (`src/components/Nav.tsx`)
3열 레이아웃: `[로고] [링크] [액션]`
- 로고: Cinzel 폰트 "야시로" + kkul.png (float 애니메이션, multiply blend)
- 링크: "스트리밍" → chzzk.naver.com
- 액션: 테마 버튼 + LIVE 버튼 (blink 도트)

**테마 아이콘 CSS-only 패턴** (useState 없음 → hydration 불일치 방지):
```css
.iconLight { display: block; }
.iconDark  { display: none; }
:global([data-theme="dark"]) .iconDark  { display: block; }
:global([data-theme="dark"]) .iconLight { display: none; }
```
두 아이콘(🌙/☀️)을 모두 렌더링하고 CSS로 show/hide — React state 없음.

### 히어로 섹션 (랜딩 페이지 `/`)
2열 그리드 (`1fr 1fr`), `min-height: calc(100vh - 60px)`:
- **좌:** fadeUp 애니메이션, `padding: 60px 56px` (--gutter보다 넓은 의도적 값)
  - 강조 배지 (액센트 보더 + 7×7 도트, borderRadius:1)
  - h1 "야시로" — Noto Serif KR 900, 100px
  - 3px 두께 액센트 라인 (width:48, borderRadius:2)
  - 설명 텍스트 — 300 weight, lineHeight:2
  - "방송 입장하기" 버튼 → chzzk.naver.com
- **우:** 캐릭터 패널
  - 배경 `#EAE0D0` 고정 + 40px 격자 패턴
  - yashiro1.png — fill, objectPosition bottom center, multiply blend
  - kkul.png — 우하단 absolute, float 3.5s 애니메이션

### 푸터
`borderTop: 1px solid var(--border)`, `padding: 24px var(--gutter)`, flex space-between
- 좌: "YASHIRO" (Cinzel 700, letterSpacing 0.14em) + kkul.png (30px, multiply/screen blend)
- 우: 저작권 텍스트 (12px, text-dim, 300 weight)

---

## 공통 컴포넌트 패턴

### 섹션 구분선 (재사용 가능 패턴 — 현재 랜딩에는 미사용)
```tsx
<div className={styles.divider}>       // flex row, gap 16px
  <div className={styles.dividerLine} /> // flex:1, height 1px, --border
  <div className={styles.dividerLabel}>  // flex, gap 8px
    <span className={styles.dividerDot} />  // 7x7px, --accent, borderRadius:1
    <span className={styles.dividerText}>{label}</span>
  </div>
  <div className={styles.dividerLine} />
</div>
```

### 강조 배지
```tsx
<div style={{ border: '1px solid var(--accent)', padding: '6px 14px',
  borderRadius: 'var(--radius-sm)', background: 'var(--accent-bg)', width: 'fit-content',
  display: 'inline-flex', alignItems: 'center', gap: 8 }}>
  <span style={{ width:7, height:7, background:'var(--accent)', borderRadius:1,
    display:'inline-block', flexShrink:0 }} />
  <span style={{ fontSize:12, color:'var(--accent)', fontWeight:500,
    letterSpacing:'0.07em' }}>레이블</span>
</div>
```

### 카드 hover (CSS Module)
```css
.card { border: 1px solid var(--border); border-radius: var(--radius-sm);
  transition: transform 0.2s, border-color 0.2s, box-shadow 0.2s; }
.card:hover { transform: translateY(-3px); border-color: var(--accent);
  box-shadow: 0 4px 16px rgba(196,122,10,0.12); }
```

See also: [[project-yashiro-contest]], [[css-structure-yashiro]]
