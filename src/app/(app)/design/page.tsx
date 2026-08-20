import { notFound } from "next/navigation";
import { DesignShowcase } from "./design-showcase";

export const metadata = { title: "Design reference" };

/** Dev-only reference page for every components/ui/ primitive in every state. Not linked from nav. */
export default function DesignPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return <DesignShowcase />;
}
