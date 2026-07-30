import Page from "@/app/forum/admin/page";
import { useSeo } from "@/lib/seo/use-seo";

export function Component() {
  useSeo();
  return <Page />;
}
