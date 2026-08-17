import { describe, expect, it } from "vitest";
import {
  formatFileSize,
  resolveSiteImageMimeType,
  validateSiteImageCandidate,
} from "@/lib/site-image";

describe("site image upload", () => {
  it("브라우저가 MIME을 주지 않아도 확장자로 파일 형식을 확인한다", () => {
    expect(resolveSiteImageMimeType({ name: "학교배치도.PDF", size: 100, type: "" })).toBe(
      "application/pdf",
    );
  });

  it("지원하지 않는 파일과 20MB 초과 파일을 거부한다", () => {
    expect(validateSiteImageCandidate({ name: "plan.svg", size: 100, type: "image/svg+xml" })).toContain(
      "JPG",
    );
    expect(
      validateSiteImageCandidate({ name: "plan.png", size: 21 * 1024 * 1024, type: "image/png" }),
    ).toContain("20MB");
  });

  it("사람이 읽기 쉬운 파일 크기를 만든다", () => {
    expect(formatFileSize(1536)).toBe("2 KB");
    expect(formatFileSize(2.5 * 1024 * 1024)).toBe("2.5 MB");
  });
});
