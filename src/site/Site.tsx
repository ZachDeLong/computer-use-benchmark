import { Layout } from './Layout';
import { usePath } from './router';
import { Landing } from './pages/Landing';
import { Play } from './pages/Play';
import { Leaderboard } from './pages/Leaderboard';
import { Replay, ReplayIndex } from './pages/Replay';

export function Site() {
  const path = usePath();
  let page;
  if (path === '/play') page = <Play />;
  else if (path === '/leaderboard') page = <Leaderboard />;
  else if (path === '/replay' || path === '/replay/') page = <ReplayIndex />;
  else if (path.startsWith('/replay/')) page = <Replay id={decodeURIComponent(path.slice('/replay/'.length))} />;
  else page = <Landing />;
  return <Layout>{page}</Layout>;
}
