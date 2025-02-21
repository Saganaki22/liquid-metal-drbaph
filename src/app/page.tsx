import Page from './share/[id]/page';

const DEFAULT_LOGO_ID = 'punisher';

export default function Home() {
  return (
    <Page
      params={{
        id: DEFAULT_LOGO_ID
      }}
    />
  );
}
