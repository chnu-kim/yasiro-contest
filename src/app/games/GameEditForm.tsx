'use client';

import { useEffect, useId, useRef, useState, type MutableRefObject } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { classifyFailure, errorMessage, fixLabel, issueLinkLabel, loginHref, type WriteFailure } from '@/lib/games/client';
import { sortVods } from '@/lib/games/rows';
import {
  applyFix,
  changedFields,
  changedLabels,
  fieldDomId,
  formToInput,
  formToPatch,
  gameToForm,
  issuesHeadline,
  validateForm,
} from '@/lib/games/patch';
import { CHZZK_VOD_MESSAGE, isChzzkUrl, isValidIsoDate, youtubeVideoId } from '@/lib/games/schema';
import type {
  CategoryLink,
  CategorySearchItem,
  FormFieldKey,
  FormIssue,
  Game,
  GameForm,
  GameRecord,
  GameStatus,
  IndexedGame,
  YoutubeMeta,
} from '@/lib/games/types';
import { adminApi } from './adminApi';
import CategoryPicker from './CategoryPicker';
import { readDraft, removeDraft, writeDraft } from './drafts';
import Poster from './Poster';
import styles from './GameEditForm.module.css';

export type LeaveTo = 'view' | 'close';

const STATUS_CHOICES: ReadonlyArray<{ value: GameStatus; label: string }> = [
  { value: 'clear', label: '정복' },
  { value: 'fail', label: '정복 못함' },
  { value: 'endless', label: '끝없는 탐험' },
  { value: 'unknown', label: '모름' },
];

type AddState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; meta: YoutubeMeta; date: string };

function isMeta(v: unknown): v is YoutubeMeta {
  return typeof v === 'object' && v !== null && typeof (v as YoutubeMeta).title === 'string' && typeof (v as YoutubeMeta).url === 'string';
}

function isRecord(v: unknown): v is GameRecord {
  return typeof v === 'object' && v !== null && typeof (v as GameRecord).id === 'string' && typeof (v as GameRecord).version === 'number';
}

// 같은 상세 모달이 수정 모드로 바뀐 모습(B안). base=null이면 게임 추가의 2단계(빈 상세).
export default function GameEditForm({
  base: initialBase,
  seed,
  all,
  titleId,
  leaveRef,
  onRecord,
  onSaved,
  onLeave,
}: {
  base: (GameRecord & IndexedGame) | null;
  seed: GameForm;
  /** 목록 전체(숨긴 게임 포함). 중복 검증용 */
  all: readonly Game[];
  titleId: string;
  /** 모달의 Esc·배경 클릭·닫기 버튼이 부르는 "나가기". 바뀐 내용이 있으면 확인을 거친다 */
  leaveRef: MutableRefObject<((to: LeaveTo) => void) | null>;
  /** 충돌로 최신 내용을 받았을 때 목록 쪽 레코드도 맞추기 */
  onRecord: (record: GameRecord) => void;
  onSaved: (record: GameRecord, created: boolean) => void;
  onLeave: (to: LeaveTo) => void;
}) {
  const uid = useId();
  const [base, setBase] = useState<GameRecord | null>(initialBase);
  // 서버에 보낼 expectedVersion. 초안을 불러오면 그 초안을 쓰기 시작한 시점의 version으로 되돌려, 그 사이 다른 관리자가 고쳤다면 409로 알아채게 한다.
  const [expectedVersion, setExpectedVersion] = useState(initialBase?.version ?? 0);
  const baseId = base?.id ?? null;
  const [form, setForm] = useState<GameForm>(() => (initialBase === null ? seed : gameToForm(initialBase)));
  const [attempted, setAttempted] = useState(false);
  const [failure, setFailure] = useState<WriteFailure | null>(null);
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState<'form' | 'picker'>('form');
  const [pickQuery, setPickQuery] = useState('');
  const [picked, setPicked] = useState<CategorySearchItem | null>(null);
  const [discard, setDiscard] = useState<LeaveTo | null>(null);
  const [draft, setDraft] = useState(() => readDraft(initialBase?.id ?? null));
  const [addUrl, setAddUrl] = useState('');
  const [add, setAdd] = useState<AddState>({ kind: 'idle' });
  const [notice, setNotice] = useState('');
  const [focusReq, setFocusReq] = useState<{ id: string; n: number } | null>(null);
  const focusN = useRef(0);

  const fields = changedFields(base, form);
  const dirty = fields.length > 0;
  const live = attempted ? validateForm(form, all, baseId) : [];
  const shown = failure?.kind === 'invalid' ? failure.issues : live;
  const byField = new Map<FormFieldKey, FormIssue>();
  for (const i of shown) if (!byField.has(i.field)) byField.set(i.field, i);

  const requestFocus = (id: string) => setFocusReq({ id, n: ++focusN.current });
  useEffect(() => {
    document.getElementById(fieldDomId('name'))?.focus();
  }, []);
  useEffect(() => {
    if (focusReq === null) return;
    const el = document.getElementById(focusReq.id);
    el?.focus();
    el?.scrollIntoView({ block: 'center' });
  }, [focusReq]);

  // 모달 쪽에서 나가려 할 때(Esc·배경·닫기): 바뀐 게 없으면 바로, 있으면 확인을 거친다.
  const latest = useRef({ dirty, form, version: base === null ? null : expectedVersion });
  useEffect(() => {
    latest.current = { dirty, form, version: base === null ? null : expectedVersion };
  });
  const leaveGate = (to: LeaveTo) => {
    if (latest.current.dirty) setDiscard(to);
    else onLeave(to);
  };
  const gateRef = useRef(leaveGate);
  useEffect(() => {
    gateRef.current = leaveGate;
  });
  useEffect(() => {
    const ref = leaveRef;
    ref.current = (to) => {
      if (view === 'picker') setView('form');
      else gateRef.current(to);
    };
    return () => {
      ref.current = null;
    };
  }, [leaveRef, view]);

  // 저장하지 않고 닫히면(뒤로 가기 등) 입력을 초안으로 남긴다. 저장·버리기를 거친 경우는 skip.
  const skipDraft = useRef(false);
  const draftId = initialBase?.id ?? null;
  useEffect(() => {
    return () => {
      const cur = latest.current;
      if (skipDraft.current || !cur.dirty) return;
      writeDraft(draftId, cur.form, cur.version);
    };
  }, [draftId]);

  // 새로 고침·탭 닫기는 언마운트가 일어나지 않는다. 바뀐 내용이 있는 동안은 떠나기 전에 묻고(beforeunload),
  // 실제로 떠나면(pagehide) 초안으로 남긴다. 초안을 이미 남긴 경우(로그인 만료 → 다시 로그인)는 묻지 않는다.
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (skipDraft.current) return;
      e.preventDefault();
      e.returnValue = '';
    };
    const onPageHide = () => {
      const cur = latest.current;
      if (skipDraft.current || !cur.dirty) return;
      writeDraft(draftId, cur.form, cur.version);
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      window.removeEventListener('pagehide', onPageHide);
    };
  }, [dirty, draftId]);

  const patchForm = (patch: Partial<GameForm>) => setForm((f) => ({ ...f, ...patch }));

  const submit = async () => {
    if (saving) return;
    setAttempted(true);
    setFailure(null);
    const found = validateForm(form, all, baseId);
    if (found.length > 0) {
      requestFocus(fieldDomId(found[0].field));
      return;
    }
    setSaving(true);
    const res = base === null ? await adminApi.create(formToInput(form)) : await adminApi.update(base.id, expectedVersion, formToPatch(base, form));
    setSaving(false);
    await settle(res.status, res.body);
  };

  const settle = async (status: number, body: unknown) => {
    const game = (body as { game?: unknown } | null)?.game;
    if ((status === 200 || status === 201) && isRecord(game)) {
      skipDraft.current = true;
      removeDraft(baseId);
      onSaved(game, status === 201);
      return;
    }
    const f = classifyFailure(status, body, form);
    if (f.kind === 'expired' || f.kind === 'login') {
      writeDraft(baseId, form, base === null ? null : expectedVersion);
      skipDraft.current = true;
    }
    setFailure(f);
    // 저장 버튼이 잠깐 disabled가 되며 포커스가 body로 떨어진다. 알림의 첫 동작(없으면 알림 자체)으로 옮긴다
    if (f.kind === 'invalid') {
      if (f.issues.length > 0) requestFocus(fieldDomId(f.issues[0].field));
      else requestFocus(`${uid}-fail`);
    } else if (f.kind === 'conflict') requestFocus(`${uid}-conflict-latest`);
    else if (f.kind === 'expired' || f.kind === 'login') requestFocus(`${uid}-relogin`);
    else requestFocus(`${uid}-fail`);
  };

  const loadLatest = (rec: GameRecord) => {
    setBase(rec);
    setExpectedVersion(rec.version);
    setForm(gameToForm(rec));
    setFailure(null);
    setAttempted(false);
    onRecord(rec);
    setNotice('최신 내용을 불러왔어요.');
    requestFocus('game-edit-name');
  };

  const saveMine = async (rec: GameRecord) => {
    setSaving(true);
    setFailure(null);
    setExpectedVersion(rec.version);
    const res = await adminApi.update(rec.id, rec.version, formToPatch(rec, form));
    setSaving(false);
    await settle(res.status, res.body);
  };

  // ---- 다시보기 ----
  const loadMeta = async () => {
    const url = addUrl.trim();
    const dupId = youtubeVideoId(url);
    if (url === '') {
      setAdd({ kind: 'error', message: '유튜브 링크를 넣어 주세요.' });
    } else if (isChzzkUrl(url)) {
      setAdd({ kind: 'error', message: CHZZK_VOD_MESSAGE });
    } else if (dupId !== null && form.vods.some((v) => youtubeVideoId(v.url) === dupId)) {
      setAdd({ kind: 'error', message: '같은 영상이 이미 있어요.' });
    } else {
      setAdd({ kind: 'loading' });
      const res = await adminApi.youtube(url);
      if (res.status === 200 && isMeta(res.body)) {
        const meta = res.body;
        const again = youtubeVideoId(meta.url);
        if (again !== null && form.vods.some((v) => youtubeVideoId(v.url) === again)) setAdd({ kind: 'error', message: '같은 영상이 이미 있어요.' });
        else setAdd({ kind: 'ready', meta, date: meta.date ?? '' });
      } else if (res.status === 401) {
        setAdd({ kind: 'error', message: '로그인이 만료됐어요. 입력한 내용은 이 기기에 남기고 다시 로그인해 주세요.' });
      } else {
        setAdd({ kind: 'error', message: errorMessage(res.body, '영상 정보를 불러오지 못했어요.') });
      }
      return;
    }
    requestFocus(`${uid}-vod-url`);
  };

  const commitVod = () => {
    if (add.kind !== 'ready' || !isValidIsoDate(add.date)) return;
    const vod = { title: add.meta.title, url: add.meta.url, date: add.date };
    patchForm({ vods: sortVods([...form.vods, vod]) });
    setAdd({ kind: 'idle' });
    setAddUrl('');
    setNotice(`다시보기를 넣었어요. 저장하면 반영돼요.`);
    requestFocus(`${uid}-vod-url`);
  };

  const removeVod = (i: number) => {
    const title = form.vods[i].title;
    const rest = form.vods.filter((_, j) => j !== i);
    patchForm({ vods: rest });
    setNotice(`다시보기 “${title}”를 뺐어요. 저장하면 반영돼요.`);
    requestFocus(rest.length > 0 ? `${uid}-vod-rm-${Math.min(i, rest.length - 1)}` : `${uid}-vod-url`);
  };

  const setVodDate = (i: number, date: string) =>
    patchForm({ vods: form.vods.map((v, j) => (j === i ? { ...v, date } : v)) });

  const no = initialBase?.no ?? '—';
  const preview: IndexedGame = {
    id: base?.id ?? 'new-game',
    name: form.name.trim() === '' ? '새 게임' : form.name.trim(),
    firstPlayed: null,
    status: form.status,
    vods: [],
    ...(form.category?.posterUrl ? { posterUrl: form.category.posterUrl } : {}),
    ordinal: initialBase?.ordinal ?? 0,
    no,
  };

  const linkCategory = () => {
    if (picked === null) return;
    const link: CategoryLink = { categoryId: picked.categoryId, posterUrl: picked.posterUrl };
    patchForm({ category: link, ...(form.name.trim() === '' ? { name: picked.name } : {}) });
    setView('form');
    setNotice(`치지직 카테고리를 바꿨어요: ${picked.name}. 저장하면 반영돼요.`);
    requestFocus(`${uid}-cat-find`);
  };

  const err = (key: FormFieldKey) => byField.get(key);
  const describe = (key: FormFieldKey, extra?: string) => {
    const ids = [extra, err(key) ? `${fieldDomId(key)}-err` : undefined].filter(Boolean);
    return ids.length > 0 ? ids.join(' ') : undefined;
  };
  const errorText = (key: FormFieldKey) => {
    const issue = err(key);
    if (!issue) return null;
    return (
      <span id={`${fieldDomId(key)}-err`} className={styles.errText}>
        {issue.message}
        {issue.fix && (
          <button
            type="button"
            className={styles.fixBtn}
            onClick={() => {
              if (issue.fix) patchForm(applyFix(form, issue.fix));
              setNotice('첫 플레이 날짜를 고쳤어요.');
              // 이 버튼은 오류가 풀리면서 사라진다. 고친 칸으로 포커스를 옮긴다
              requestFocus(fieldDomId('firstPlayed'));
            }}
          >
            {fixLabel(issue.fix.date)}
          </button>
        )}
      </span>
    );
  };

  const eyebrow = base === null ? '새 기록 · 입력 중' : `EXPEDITION NO.${no} · 수정 중`;

  if (view === 'picker') {
    return (
      <div className={styles.form}>
        <div className={styles.body}>
          <div className={styles.pickerWrap}>
            <h3 id={titleId} className={styles.pickerTitle}>치지직 카테고리 찾기</h3>
            <CategoryPicker
              inputId={`${uid}-pick`}
              query={pickQuery}
              onQueryChange={setPickQuery}
              selfId={baseId}
              selected={picked}
              onSelect={setPicked}
            />
          </div>
        </div>
        <div className={styles.foot}>
          <button type="button" className={styles.textBtn} onClick={() => setView('form')}>
            뒤로
          </button>
          <div className={styles.footBtns}>
            <button type="button" className={styles.solid} disabled={picked === null} onClick={linkCategory}>
              이 카테고리로 연결
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form
      className={styles.form}
      aria-labelledby={titleId}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <div className={styles.body}>
        {shown.length > 0 && (
          <div role="alert" className={`${styles.alertBox} ${styles.summary}`}>
            <strong>{issuesHeadline(shown)}</strong>
            <ul className={styles.issueList}>
              {shown.map((i) => (
                <li key={`${i.field}-${i.message}`}>
                  <a
                    href={`#${fieldDomId(i.field)}`}
                    onClick={(e) => {
                      e.preventDefault();
                      requestFocus(fieldDomId(i.field));
                    }}
                  >
                    {issueLinkLabel(i)}
                  </a>
                  <span className={styles.issueMsg}> · {i.message}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className={styles.side}>
          <div className={styles.poster}>
            <Poster eager nameWideOnly game={preview} stampSize={108} stampStyle={{ right: -22, bottom: -24 }} />
          </div>
          <div id={fieldDomId('category')} tabIndex={-1} className={styles.cat}>
            {form.category ? (
              <p className={styles.catId}>
                <span>치지직 카테고리</span>
                <span className={styles.catIdValue}>{form.category.categoryId}</span>
              </p>
            ) : (
              <p className={styles.catId}>
                <span>치지직 카테고리</span>
                <span className={styles.catNone}>연결 없음 · 표본 라벨</span>
              </p>
            )}
            {errorText('category')}
            <button
              type="button"
              id={`${uid}-cat-find`}
              className={styles.outline}
              aria-label={form.category ? '다른 카테고리 찾기' : '치지직 카테고리 찾기'}
              onClick={() => {
                setPicked(null);
                setPickQuery(form.name.trim());
                setView('picker');
              }}
            >
              <span className={styles.long}>{form.category ? '다른 카테고리 찾기' : '카테고리 찾기'}</span>
              <span className={styles.short}>카테고리</span>
            </button>
            {form.category && (
              <button type="button" className={styles.unlink} onClick={() => patchForm({ category: null })}>
                연결 해제 · 표본 라벨로
              </button>
            )}
          </div>
        </div>

        <div className={styles.main}>
          <div className={styles.head}>
            <p className={styles.eyebrow}>
              <span className={styles.dot} aria-hidden="true" />
              {/* 모달의 접근 가능한 이름. 어떤 게임을 고치는지 들리도록 이름을 붙인다(화면에는 입력칸이 보인다) */}
              <span id={titleId}>
                {eyebrow}
                <span className={styles.srOnly}> · {form.name.trim() === '' ? '이름 없음' : form.name.trim()}</span>
              </span>
            </p>
            <label htmlFor={fieldDomId('name')} className={styles.srOnly}>이름</label>
            <input
              id={fieldDomId('name')}
              type="text"
              className={`${styles.input} ${styles.nameInput}`}
              value={form.name}
              maxLength={100}
              required
              placeholder="게임 이름"
              aria-invalid={err('name') ? true : undefined}
              aria-describedby={describe('name')}
              onChange={(e) => patchForm({ name: e.target.value })}
            />
            {errorText('name')}
            <label className={styles.stack}>
              <span className={styles.lbl}>원제 (선택)</span>
              <input
                id={fieldDomId('originalTitle')}
                type="text"
                lang="en"
                className={styles.input}
                value={form.originalTitle}
                maxLength={200}
                placeholder="영문 등 원래 제목"
                aria-invalid={err('originalTitle') ? true : undefined}
                aria-describedby={describe('originalTitle')}
                onChange={(e) => patchForm({ originalTitle: e.target.value })}
              />
              {errorText('originalTitle')}
            </label>
          </div>

          <div className={styles.facts}>
            <div className={styles.factRow}>
              <label htmlFor={fieldDomId('firstPlayed')} className={styles.factLabel}>첫 플레이</label>
              <input
                id={fieldDomId('firstPlayed')}
                type="date"
                className={styles.input}
                value={form.undated ? '' : form.firstPlayed}
                disabled={form.undated}
                aria-invalid={err('firstPlayed') ? true : undefined}
                aria-describedby={describe('firstPlayed')}
                onChange={(e) => patchForm({ firstPlayed: e.target.value })}
              />
              <label className={styles.check}>
                <input type="checkbox" checked={form.undated} onChange={(e) => patchForm({ undated: e.target.checked })} />
                날짜 기록 없음
              </label>
            </div>
            {errorText('firstPlayed')}
            <fieldset id={fieldDomId('status')} tabIndex={-1} className={styles.statusSet}>
              <legend className={styles.factLabel}>정복 여부</legend>
              <div className={styles.segment}>
                {STATUS_CHOICES.map((c) => (
                  <label key={c.value} className={form.status === c.value ? `${styles.seg} ${styles.segOn}` : styles.seg}>
                    <input
                      type="radio"
                      name={`${uid}-status`}
                      checked={form.status === c.value}
                      onChange={() => patchForm({ status: c.value })}
                    />
                    {c.label}
                  </label>
                ))}
              </div>
            </fieldset>
            {errorText('status')}
          </div>

          <fieldset id={fieldDomId('vods')} tabIndex={-1} className={styles.vods}>
            <legend className={styles.vodsLegend}>
              다시보기 <span className={styles.num}>{form.vods.length}</span>편 <span className={styles.legendNote}>· 유튜브 링크만</span>
            </legend>
            {errorText('vods')}
            {form.vods.length > 0 && (
              <ul className={styles.vodList}>
                {form.vods.map((v, i) => {
                  const rowKeys: FormFieldKey[] = [`vods.${i}.title`, `vods.${i}.url`, `vods.${i}.date`];
                  return (
                    <li key={v.url} id={fieldDomId(`vods.${i}.url`)} tabIndex={-1} className={rowKeys.some((k) => err(k)) ? `${styles.vod} ${styles.vodBad}` : styles.vod}>
                      <div className={styles.vodMain}>
                        <span id={fieldDomId(`vods.${i}.title`)} tabIndex={-1} className={styles.vodTitle} title={v.title}>
                          {v.title}
                        </span>
                        <span className={styles.vodMeta}>
                          YouTube ·
                          <input
                            id={fieldDomId(`vods.${i}.date`)}
                            type="date"
                            className={styles.vodDate}
                            value={v.date}
                            aria-label={`${v.title} 날짜`}
                            aria-invalid={err(`vods.${i}.date`) ? true : undefined}
                            aria-describedby={describe(`vods.${i}.date`)}
                            onChange={(e) => setVodDate(i, e.target.value)}
                            onBlur={() => patchForm({ vods: sortVods(form.vods) })}
                          />
                        </span>
                        {rowKeys.map((k) => err(k) && <span key={k}>{errorText(k)}</span>)}
                      </div>
                      <button
                        type="button"
                        id={`${uid}-vod-rm-${i}`}
                        className={styles.iconBtn}
                        aria-label={`${v.title} 삭제`}
                        onClick={() => removeVod(i)}
                      >
                        <Trash2 size={18} strokeWidth={1.8} aria-hidden="true" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            <div className={styles.addPanel}>
              <label htmlFor={`${uid}-vod-url`} className={styles.addLabel}>다시보기 추가 <span className={styles.legendNote}>· 유튜브 링크만</span></label>
              <div className={styles.addRow}>
                <input
                  id={`${uid}-vod-url`}
                  type="url"
                  inputMode="url"
                  className={styles.input}
                  value={addUrl}
                  placeholder="https://youtu.be/…"
                  aria-invalid={add.kind === 'error' ? true : undefined}
                  aria-describedby={add.kind === 'error' ? `${uid}-add-err` : undefined}
                  onChange={(e) => {
                    setAddUrl(e.target.value);
                    if (add.kind !== 'loading') setAdd({ kind: 'idle' });
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void loadMeta();
                    }
                  }}
                />
                <button type="button" className={styles.outline} disabled={add.kind === 'loading'} onClick={() => void loadMeta()}>
                  {add.kind === 'loading' ? '불러오는 중…' : '불러오기'}
                </button>
              </div>
              {add.kind === 'error' && (
                <p id={`${uid}-add-err`} className={styles.errText}>{add.message}</p>
              )}
              {add.kind === 'ready' && (
                <div className={styles.ready}>
                  <div className={styles.readyText}>
                    <span className={styles.readyTitle}>{add.meta.title}</span>
                    <span className={styles.readyMeta}>
                      <label htmlFor={`${uid}-add-date`}>날짜</label>
                      <input
                        id={`${uid}-add-date`}
                        type="date"
                        className={styles.vodDate}
                        value={add.date}
                        onChange={(e) => setAdd({ ...add, date: e.target.value })}
                      />
                      <span>{add.meta.date !== null && add.meta.date === add.date ? '· 제목에서 읽음' : add.meta.date === null ? '· 제목에서 못 읽었어요. 직접 넣어 주세요' : ''}</span>
                    </span>
                  </div>
                  <button type="button" className={styles.dark} disabled={!isValidIsoDate(add.date)} onClick={commitVod}>
                    <Plus size={16} strokeWidth={2} aria-hidden="true" />
                    넣기
                  </button>
                </div>
              )}
            </div>
          </fieldset>
        </div>
      </div>

      <div className={styles.foot}>
        {draft !== null && (
          <div className={styles.draftBar} role="group" aria-label="저장 안 한 내용">
            <span>저장 안 한 내용이 있어요.</span>
            <button
              type="button"
              className={styles.smallBtn}
              onClick={() => {
                setForm(draft.form);
                if (draft.baseVersion !== null) setExpectedVersion(draft.baseVersion);
                setDraft(null);
                removeDraft(baseId);
                setNotice('저장 안 한 내용을 불러왔어요.');
              }}
            >
              불러오기
            </button>
            <button
              type="button"
              className={styles.smallBtn}
              onClick={() => {
                setDraft(null);
                removeDraft(baseId);
              }}
            >
              버리기
            </button>
          </div>
        )}

        {failure?.kind === 'conflict' && (
          <div role="alert" className={`${styles.alertBox} ${styles.alertWarn}`}>
            <p>{failure.message}</p>
            <div className={styles.alertBtns}>
              <button type="button" id={`${uid}-conflict-latest`} className={styles.solid} onClick={() => loadLatest(failure.latest)}>최신 내용 불러오기</button>
              <button type="button" className={styles.outline} disabled={saving} onClick={() => void saveMine(failure.latest)}>내 내용으로 저장</button>
            </div>
          </div>
        )}

        {(failure?.kind === 'expired' || failure?.kind === 'login') && (
          <div role="alert" className={`${styles.alertBox} ${styles.alertNeutral}`}>
            <p>{failure.message}</p>
            <a id={`${uid}-relogin`} className={styles.outline} href={loginHref(baseId)}>치지직으로 다시 로그인</a>
          </div>
        )}

        {(failure?.kind === 'forbidden' || failure?.kind === 'missing' || failure?.kind === 'other' || (failure?.kind === 'invalid' && failure.issues.length === 0)) && (
          <div role="alert" id={`${uid}-fail`} tabIndex={-1} className={`${styles.alertBox} ${styles.alertNeutral}`}>
            <p>{failure.message}</p>
          </div>
        )}

        {discard !== null && (
          <div role="alert" className={`${styles.alertBox} ${styles.alertNeutral}`}>
            <p>저장하지 않은 변경이 있어요. 버리고 나갈까요?</p>
            <div className={styles.alertBtns}>
              <button type="button" className={styles.outline} autoFocus onClick={() => setDiscard(null)}>계속 수정</button>
              <button
                type="button"
                className={styles.danger}
                onClick={() => {
                  skipDraft.current = true;
                  removeDraft(baseId);
                  onLeave(discard);
                }}
              >
                버리기
              </button>
            </div>
          </div>
        )}

        <p role="status" className={styles.srOnly}>{notice}</p>

        <div className={styles.footRow}>
          <p className={styles.changed}>
            {base === null ? '입력한 항목' : '바뀐 항목'}{' '}
            <span className={styles.changedNum}>{fields.length}</span>
            {fields.length > 0 && <> · {changedLabels(fields).join(', ')}</>}
          </p>
          <div className={styles.footBtns}>
            <button type="button" className={styles.outline} onClick={() => leaveGate(base === null ? 'close' : 'view')}>
              취소
            </button>
            <button type="submit" className={styles.solid} disabled={saving || (base !== null && !dirty)}>
              {saving ? '저장 중…' : base === null ? '추가' : '저장'}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
