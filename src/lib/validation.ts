import { z } from "zod";

export const joinClassSchema = z.object({
  classCode: z
    .string()
    .trim()
    .min(6, "수업 코드는 6자리 이상입니다.")
    .max(10, "수업 코드는 10자리 이하입니다.")
    .regex(/^[A-Za-z0-9]+$/, "수업 코드는 영문과 숫자만 입력하세요."),
  nickname: z
    .string()
    .trim()
    .min(1, "닉네임을 입력하세요.")
    .max(12, "닉네임은 12자 이하로 입력하세요."),
});

export type JoinClassInput = z.infer<typeof joinClassSchema>;
