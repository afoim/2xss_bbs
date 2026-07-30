import Page from "@/app/forum/auth/login/page";
import { useSeo } from "@/lib/seo/use-seo";

export function Component() {
  useSeo();
  return <Page />;
}
