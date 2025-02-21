import { redirect } from 'next/navigation';

const DEFAULT_LOGO_ID = 'punisher';

export default function Home() {
  redirect(`/liquid-metal-drbaph/share/${DEFAULT_LOGO_ID}`);
  return null;
}
