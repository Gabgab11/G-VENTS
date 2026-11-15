import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import AuthScreen from "./AuthScreen";
import SignInArt from "./SignInArt";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.meta");
  return { title: t("signIn") };
}

export default function SignInPage() {
  return <AuthScreen mode="signin" art={<SignInArt />} />;
}
