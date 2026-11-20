"use client";

import { createContext, useContext, useReducer, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Check, Plus } from "lucide-react";
import { Button } from "@/design";
import { followReducer, initialFollow, type FollowState } from "@/lib/host-profile";
import { setFollowing } from "./actions";
import s from "./Profile.module.css";

// The Follow button and the follower count it changes (FR-32). One click follows; "Following" then
// unfollows. Both change at once and settle on the API's answer (src/lib/host-profile.ts followReducer).

type Follow = { state: FollowState; toggle: () => void; error: string | null };
const FollowContext = createContext<Follow | null>(null);

export function FollowProvider({ hostId, following, count, signInHref, children }: { hostId: string; following: boolean; count: number; signInHref: string; children: ReactNode }) {
  const t = useTranslations("profile.page");
  const router = useRouter();
  const [state, dispatch] = useReducer(followReducer, initialFollow(following, count));
  const [error, setError] = useState<string | null>(null);

  const toggle = async () => {
    if (state.pending) return;
    const next = !state.following;
    setError(null);
    dispatch({ type: "toggle" });
    const result = await setFollowing(hostId, next).catch(() => ({ ok: false as const, reason: "failed" as const }));
    if (result.ok) {
      dispatch({ type: "settled", following: result.following, count: result.followerCount });
      return;
    }
    dispatch({ type: "failed" });
    if (result.reason === "signIn") router.push(signInHref);
    else setError(result.reason === "self" ? t("selfFollow") : t("followFailed"));
  };

  return <FollowContext.Provider value={{ state, toggle, error }}>{children}</FollowContext.Provider>;
}

/** "1,240 followers", once there is at least one. */
export function FollowerCount() {
  const t = useTranslations("profile.page");
  const follow = useContext(FollowContext);
  if (!follow || follow.state.count < 1) return null;
  return <span className={s.metaItem}>{t("followers", { count: follow.state.count })}</span>;
}

export function FollowButton() {
  const t = useTranslations("profile.page");
  const follow = useContext(FollowContext);
  if (!follow) return null;
  const { following } = follow.state;
  return (
    <span className={s.follow}>
      <Button
        type="button"
        variant={following ? "secondary" : "primary"}
        aria-pressed={following}
        onClick={follow.toggle}
      >
        {following ? <Check size={20} strokeWidth={1.75} aria-hidden /> : <Plus size={20} strokeWidth={1.75} aria-hidden />}
        {following ? t("following") : t("follow")}
      </Button>
      {follow.error && <span className={s.followError} role="alert">{follow.error}</span>}
    </span>
  );
}
