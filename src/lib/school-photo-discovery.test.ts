import { describe, expect, it } from "vitest";
import { homepageImageCandidates, isPublicAddress, schoolUrl } from "./school-photo-discovery";
import { getDirectorySchool, parseSchoolQuery } from "./school-directory";

describe("school discovery", () => {
  it("resolves a school from its directory identity and handles region before or after the name", async () => {
    expect(parseSchoolQuery("광주광역시 남구 봉선중")).toEqual(parseSchoolQuery("봉선중 광주 남구"));
    expect(await getDirectorySchool("7402271", "봉선중학교")).toMatchObject({ schoolName: "봉선중학교", region: "광주 남구" });
    expect(await getDirectorySchool("not-a-code", "봉선중학교")).toBeNull();
  });
  it("prioritizes a labeled exterior and removes logos, untrusted hosts, board pictures and scripts", () => {
    const page = new URL("https://example.gen.ms.kr/main/home");
    const html = `
      <img alt="학교 전경" src="/img/campus.jpg">
      <img src="/img/main_visual1.jpg" alt="반갑습니다">
      <img src="/board/campus-view.jpg"><img src="/img/logo.png">
      <meta content="/img/campus.jpg" property="og:image">
      <img alt="학교 전경" src="http://127.0.0.1/a.jpg">
      <script>const x='<img alt="학교 전경" src="/secret.jpg">'</script>`;
    expect(homepageImageCandidates(html, page).map(c => c.url)).toEqual(["https://example.gen.ms.kr/img/campus.jpg", "https://example.gen.ms.kr/img/main_visual1.jpg"]);
  });
  it("constrains origins and connections to public school servers", () => {
    expect(schoolUrl("http://school.jbedu.kr/jeonju")?.protocol).toBe("https:");
    for (const input of ["https://example.com/photo", "file:///etc/hosts", "https://host.go.kr.evil.net", "https://user@host.go.kr/", "https://host.go.kr:555/path"]) expect(schoolUrl(input)).toBeNull();
    for (const address of ["127.0.0.1", "10.1.2.3", "169.254.169.254", "172.21.9.10", "192.168.4.4", "::1", "100.64.2.4"]) expect(isPublicAddress(address)).toBe(false);
    expect(isPublicAddress("8.8.8.8")).toBe(true);
  });
});
