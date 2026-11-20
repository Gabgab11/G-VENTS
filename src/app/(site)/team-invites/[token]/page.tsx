import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { UsersRound } from "lucide-react";
import { requireUser } from "@/lib/auth";
import SiteHeader from "@/components/SiteHeader";
import { Banner, Button, Card } from "@/design";
import { isInviteToken, type InviteProblem } from "@/app/(site)/host/events/[id]/team-roles";
import { acceptInvite, switchAccount } from "./actions";
import styles from "./invite.module.css";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("dashboard.invite");
  return { title: t("metaTitle"), robots: { index: false, follow: false } };
}

const PROBLEMS: readonly InviteProblem[] = ["wrong_account", "gone", "not_found", "failed"];

// The page a team invitation email links to (Change 4 chunk 5, D77). Signed-out visitors sign in
// first and come back here; accepting adds them to the event's team and opens its workspace (door
// staff: the scanner). The invitation is only accepted on the button, never by opening the link.
export default async function TeamInvitePage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ err?: string }> }) {
  const [{ token }, sp, t] = await Promise.all([params, searchParams, getTranslations("dashboard.invite")]);
  const valid = isInviteToken(token);
  const { user } = valid ? await requireUser(`/team-invites/${token}`) : { user: null };
  const problem = PROBLEMS.find((p) => p === sp.err);
  const titleKey = !valid || problem === "gone" || problem === "not_found" ? "unavailableTitle" : "title";

  return (
    <>
      <SiteHeader back="/" />
      <main className={styles.page} id="main">
        <Card className={styles.card}>
          <span className={styles.icon} aria-hidden><UsersRound size={24} strokeWidth={1.75} /></span>
          <h1 className={styles.title}>{t(titleKey)}</h1>
          {!valid ? (
            <>
              <p className={styles.text}>{t("problems.not_found")}</p>
              <Button href="/host" variant="secondary">{t("toHost")}</Button>
            </>
          ) : (
            <>
              {problem ? (
                <Banner tone={problem === "wrong_account" ? "warning" : "danger"} title={t(`problems.${problem}`)} />
              ) : (
                <p className={styles.text}>{t("body")}</p>
              )}
              {user?.email && <p className={styles.text}>{t.rich("signedInAs", { email: user.email, b: (c) => <strong><bdi>{c}</bdi></strong> })}</p>}
              <div className={styles.actions}>
                {problem !== "gone" && problem !== "not_found" && problem !== "wrong_account" && (
                  <form action={acceptInvite.bind(null, token)}>
                    <Button type="submit" variant="primary">{t("accept")}</Button>
                  </form>
                )}
                <form action={switchAccount.bind(null, token)}>
                  <Button type="submit" variant={problem === "wrong_account" ? "primary" : "secondary"}>{t("switchAccount")}</Button>
                </form>
              </div>
              {problem === "wrong_account" && <p className={styles.hint}>{t("wrongAccountHint")}</p>}
            </>
          )}
        </Card>
      </main>
    </>
  );
}
