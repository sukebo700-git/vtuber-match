"use client";

import { useEffect } from "react";
import { anonymousViewerProfile, getViewerIdentity, readStoredViewerProfile } from "@/lib/viewerIdentity";

type ViewerActivityTrackerProps = {
  streamerId: string;
  action?: "view" | "like";
};

export function ViewerActivityTracker({ streamerId, action = "view" }: ViewerActivityTrackerProps) {
  useEffect(() => {
    const identity = getViewerIdentity();
    const storedProfile = readStoredViewerProfile();
    const viewerProfile = identity.registered && storedProfile?.visible_to_matched_streamers !== false
      ? storedProfile
      : identity.registered
        ? { id: identity.id, display_name: identity.auth?.name || "", visible_to_matched_streamers: true }
      : anonymousViewerProfile(identity.id);

    fetch("/api/viewer-activity", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        streamer_id: streamerId,
        viewer_profile_id: identity.id,
        user_id: identity.id,
        action,
        viewer_profile: viewerProfile,
      }),
    }).catch(() => undefined);
  }, [action, streamerId]);

  return null;
}
