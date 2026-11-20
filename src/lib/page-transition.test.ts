import { describe, expect, it } from 'vitest';
import { PAGE_TRANSITION } from './page-transition';

describe('PAGE_TRANSITION', () => {
  it("template의 <ViewTransition>이 기다리는 'page' 타입 하나만 붙인다", () => {
    expect(PAGE_TRANSITION).toEqual(['page']);
  });
});
