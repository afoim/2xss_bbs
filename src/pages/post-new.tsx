import Page from "@/app/forum/post/new/page";
import { useSeo } from "@/lib/seo/use-seo";

export function Component() {
  useSeo();
  return <Page />;
}
