import { z } from "zod";

export const groupMemberSchema = z.object({
  userId: z.string(),
  role: z.enum(["OWNER", "EDITOR", "VIEWER"]),
  status: z.string(),
  name: z.string(),
  email: z.string().nullable(),
  image: z.string().nullable(),
});

export const groupMembersResponseSchema = z.object({
  members: z.array(groupMemberSchema),
});
