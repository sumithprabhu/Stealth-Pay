import { PlaygroundProviders } from "./providers";

export default function PlaygroundLayout({ children }: { children: React.ReactNode }) {
  return <PlaygroundProviders>{children}</PlaygroundProviders>;
}
