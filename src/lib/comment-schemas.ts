import { z } from "zod";

export const commentPayloadSchema = z.object({
  id: z.string(),
  body: z.string(),
  createdAt: z.string(),
  user: z.object({
    id: z.string(),
    name: z.string().nullable(),
    image: z.string().nullable(),
  }),
});

export const commentsResponseSchema = z.object({
  comments: z.array(commentPayloadSchema),
});
