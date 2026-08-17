import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { PlanPreview } from "@/components/PlanPreview";
import { PROJECT_FLOW } from "@/data/demo-project";

export default function HomePage() {
  return (
    <div className="site-shell landing-page">
      <AppHeader current="home" />

      <main>
        <section className="hero-section">
          <div className="hero-copy">
            <p className="eyebrow">조경전문가 직업체험</p>
            <h1>
              우리가 매일 지나는 학교,
              <br />
              <em>직접 설계해 볼까요?</em>
            </h1>
            <p className="hero-description">
              실제 학교 공간을 도면으로 읽고, 조경 재료를 배치하고,
              미니조경 작품까지 만드는 하나의 설계 프로젝트입니다.
            </p>
            <div className="hero-actions">
              <Link className="button button--primary button--large" href="/join">
                수업 코드로 시작하기
                <span aria-hidden="true">→</span>
              </Link>
              <Link className="button button--quiet button--large" href="/teacher">
                교사 수업 준비
              </Link>
            </div>
            <dl className="hero-facts">
              <div>
                <dt>01</dt>
                <dd>실제 학교 공간</dd>
              </div>
              <div>
                <dt>02</dt>
                <dd>도면 중심 설계</dd>
              </div>
              <div>
                <dt>03</dt>
                <dd>실제 재료 제작</dd>
              </div>
            </dl>
          </div>

          <div className="hero-visual">
            <div className="visual-caption visual-caption--top">
              <span className="caption-index">SITE 01</span>
              <strong>푸른솔중학교 중앙 광장</strong>
            </div>
            <PlanPreview />
            <div className="visual-caption visual-caption--bottom">
              <div>
                <small>현재 단계</small>
                <strong>평면 조경 설계</strong>
              </div>
              <span className="status-dot">설계 중</span>
            </div>
          </div>
        </section>

        <section className="journey-section" aria-labelledby="journey-title">
          <div className="section-heading">
            <p className="eyebrow">PROJECT JOURNEY</p>
            <h2 id="journey-title">한 공간을 보고, 생각하고, 실제로 만듭니다.</h2>
          </div>
          <div className="journey-grid">
            {PROJECT_FLOW.map((flow, index) => (
              <article className="journey-panel" key={flow.part}>
                <div className="journey-panel__number">0{index + 1}</div>
                <div>
                  <p>{flow.part}</p>
                  <h3>{flow.title}</h3>
                  <span>{flow.description}</span>
                  <ol>
                    {flow.steps.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ol>
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <p>GARDENING CAREER LAB</p>
        <span>같은 공간도 목적과 생각에 따라 다른 설계가 됩니다.</span>
      </footer>
    </div>
  );
}
