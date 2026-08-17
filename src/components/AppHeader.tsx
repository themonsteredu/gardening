import Link from "next/link";

interface AppHeaderProps {
  compact?: boolean;
  current?: "home" | "teacher" | "student";
}

export function AppHeader({ compact = false, current }: AppHeaderProps) {
  return (
    <header className={`app-header ${compact ? "app-header--compact" : ""}`}>
      <Link className="brand" href="/" aria-label="가드닝 커리어 랩 홈">
        <span className="brand-mark" aria-hidden="true">
          <span />
          <span />
        </span>
        <span>
          <strong>GARDENING</strong>
          <small>CAREER LAB</small>
        </span>
      </Link>

      <nav aria-label="주요 메뉴">
        <Link
          className={current === "student" ? "is-current" : ""}
          href="/join"
        >
          학생 입장
        </Link>
        <Link
          className={current === "teacher" ? "is-current" : ""}
          href="/teacher"
        >
          교사 공간
        </Link>
      </nav>
    </header>
  );
}
