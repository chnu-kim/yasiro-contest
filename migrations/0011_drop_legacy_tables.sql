-- 레거시 테이블 제거. guestbook(0002)은 방명록 제거(#38) 뒤 읽지 않고, sessions(0001)는 0009부터 읽지 않으며 0010에서 행을 지웠다.
-- 이 뒤로 #38 이전 코드로 롤백하면 방명록이, #37 이전 코드로 롤백하면 옛 callback의 sessions INSERT가 500이 난다.
-- 그때는 해당 테이블을 다시 만드는 새 마이그레이션을 먼저 적용한다. 인덱스는 DROP TABLE과 함께 지워진다.
DROP TABLE IF EXISTS guestbook;
DROP TABLE IF EXISTS sessions;
