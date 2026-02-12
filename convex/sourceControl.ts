import { v } from "convex/values";

import { mutation, query } from "./_generated/server";
import { verifyAuth } from "./auth";
import { Id } from "./_generated/dataModel";

export const getBaselines = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const identity = await verifyAuth(ctx);

    const project = await ctx.db.get("projects", args.projectId);
    if (!project || project.ownerId !== identity.subject) return [];

    return await ctx.db
      .query("file_baselines")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
  },
});

export const setBaselines = mutation({
  args: {
    projectId: v.id("projects"),
    updates: v.array(
      v.object({
        fileId: v.id("files"),
        content: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const identity = await verifyAuth(ctx);

    const project = await ctx.db.get("projects", args.projectId);
    if (!project || project.ownerId !== identity.subject) {
      throw new Error("Unauthorized");
    }

    const now = Date.now();
    for (const { fileId, content } of args.updates) {
      const existing = await ctx.db
        .query("file_baselines")
        .withIndex("by_project_file", (q) =>
          q.eq("projectId", args.projectId).eq("fileId", fileId)
        )
        .unique();

      if (existing) {
        await ctx.db.patch(existing._id, { content, updatedAt: now });
      } else {
        await ctx.db.insert("file_baselines", {
          projectId: args.projectId,
          fileId,
          content,
          updatedAt: now,
        });
      }
    }
  },
});
