import type { CSSProperties } from "react";
import type { LandscapeObject } from "@/domain/models";
import { buildLandscapePlanSchedule, getLandscapePlanCode } from "@/lib/landscape-plan";

export function LandscapePlanOverlay({
  objects,
  schoolName,
}: {
  objects: LandscapeObject[];
  schoolName: string;
}) {
  const schedule = buildLandscapePlanSchedule(objects);

  return (
    <section className="approximate-plan-overlay" aria-label="항공사진 기반 예상 식재 배치계획도">
      <div className="approximate-plan-title">
        <span>CONCEPT PLAN</span>
        <strong>예상 식재·배치계획도</strong>
        <small>{schoolName} · 상대 배치</small>
      </div>

      <div className="approximate-plan-north" aria-label="사진 위쪽을 임시 북쪽으로 표시">
        <strong>N</strong>
        <i />
        <small>사진 위쪽</small>
      </div>

      {objects.map((object) => {
        const code = getLandscapePlanCode(object.materialId);
        if (!code) return null;
        return (
          <span
            key={object.id}
            className="approximate-plan-object-code"
            style={{
              left: `${object.x * 100}%`,
              top: `${object.y * 100}%`,
              zIndex: object.zIndex + 1,
            } as CSSProperties}
          >
            {code}
          </span>
        );
      })}

      <div className="approximate-plan-schedule">
        <strong>재료 수량표</strong>
        {schedule.length > 0 ? (
          <table>
            <thead><tr><th>코드</th><th>재료</th><th>수량</th></tr></thead>
            <tbody>
              {schedule.map((item) => (
                <tr key={item.materialId}><td>{item.code}</td><td>{item.label}</td><td>{item.quantity}</td></tr>
              ))}
            </tbody>
          </table>
        ) : <p>재료를 배치하면 자동으로 표시됩니다.</p>}
      </div>

      <p className="approximate-plan-disclaimer">항공사진 기반 예상안 · 축척과 실제 치수 없음</p>
    </section>
  );
}
