interface PlanPreviewProps {
  variant?: "landing" | "teacher" | "student";
  showMaterials?: boolean;
}

export function PlanPreview({
  variant = "landing",
  showMaterials = true,
}: PlanPreviewProps) {
  return (
    <div className={`plan-preview plan-preview--${variant}`} aria-label="학교 조경 배치도 예시">
      <div className="plan-grid" aria-hidden="true" />
      <div className="plan-building plan-building--a">
        <span>본관</span>
      </div>
      <div className="plan-building plan-building--b">
        <span>체육관</span>
      </div>
      <div className="plan-ground">
        <span>운동장</span>
      </div>
      <div className="plan-path plan-path--a" />
      <div className="plan-path plan-path--b" />
      <div className="plan-zone">
        <span>조경 설계 가능 공간</span>
      </div>
      {showMaterials ? (
        <>
          <span className="plan-tree plan-tree--a" aria-label="나무" />
          <span className="plan-tree plan-tree--b" aria-label="나무" />
          <span className="plan-tree plan-tree--c" aria-label="나무" />
          <span className="plan-bench" aria-label="벤치" />
          <span className="plan-flowerbed" aria-label="화단" />
        </>
      ) : null}
      <div className="plan-scale">20 m</div>
    </div>
  );
}
