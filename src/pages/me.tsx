import Page from "@/app/forum/me/page";
import { useSeo } from "@/lib/seo/use-seo";

export function Component() {
  useSeo();
  return <Page />;
}
