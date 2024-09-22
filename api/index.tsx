import { Button, Frog } from 'frog'
import { devtools } from 'frog/dev'
import { serveStatic } from 'frog/serve-static'
import { handle } from 'frog/vercel'

export const app = new Frog({
  assetsPath: '/',
  basePath: '/api',
  title: 'MLB Schedule',
})

const API_KEY = 'FBKXX1hlX9Uo4vJ1y7Lcv7A9ScCFJSTpZwpXZdbX'

interface Game {
  id: string;
  status: string;
  scheduled: string;
  away: { name: string; id: string };
  home: { name: string; id: string };
  away_score?: number;
  home_score?: number;
  inning?: number;
  inning_half?: string;
}

interface TeamStanding {
  team: { id: string; name: string };
  win: number;
  loss: number;
  win_p: number;
  games_back: number;
  streak: string;
  last_10_won: number;
  last_10_lost: number;
  league_rank?: number;
  division_rank?: number;
}

let standingsCache: TeamStanding[] | null = null;

async function fetchMLBSchedule(): Promise<Game[] | null> {
  const date = new Date().toISOString().split('T')[0].replace(/-/g, '/')
  const apiUrl = `https://api.sportradar.com/mlb/trial/v7/en/games/${date}/schedule.json?api_key=${API_KEY}`

  try {
    const response = await fetch(apiUrl)
    const data = await response.json()
    console.log('Schedule data:', JSON.stringify(data, null, 2))
    return data.games
  } catch (error) {
    console.error('Error fetching schedule:', error)
    return null
  }
}

async function fetchStandings(): Promise<TeamStanding[] | null> {
  if (standingsCache) return standingsCache;

  const apiUrl = `https://api.sportradar.com/mlb/trial/v7/en/seasons/2024/REG/standings.json?api_key=${API_KEY}`

  try {
    const response = await fetch(apiUrl)
    const data = await response.json()
    console.log('Standings data:', JSON.stringify(data, null, 2))
    standingsCache = data.league.season.leagues
      .flatMap((league: any) => league.divisions)
      .flatMap((division: any) => division.teams)
      .map((team: any) => ({
        team: { id: team.id, name: team.name },
        win: team.win,
        loss: team.loss,
        win_p: team.win_p,
        games_back: team.games_back,
        streak: team.streak,
        last_10_won: team.last_10_won,
        last_10_lost: team.last_10_lost,
        league_rank: team.rank?.league,
        division_rank: team.rank?.division
      }))
    return standingsCache
  } catch (error) {
    console.error('Error fetching standings:', error)
    return null
  }
}

function findTeamStanding(standings: TeamStanding[], teamId: string): TeamStanding | undefined {
  return standings.find(standing => standing.team.id === teamId)
}

app.frame('/comparison/:index', async (c) => {
  console.log('Comparison frame called with index:', c.req.param('index'))
  try {
    const [games, standings] = await Promise.all([fetchMLBSchedule(), fetchStandings()])
    
    if (!games || games.length === 0 || !standings) {
      return c.res({
        image: 'https://placehold.co/1000x1000/png?text=No+Data+Available',
        imageAspectRatio: '1:1',
        intents: [
          <Button action="/">Back to Start</Button>
        ]
      })
    }

    const index = parseInt(c.req.param('index'))
    const game = games[index]

    if (!game) {
      return c.res({
        image: 'https://placehold.co/1000x1000/png?text=Game+Not+Found',
        imageAspectRatio: '1:1',
        intents: [
          <Button action="/">Back to Start</Button>
        ]
      })
    }

    const awayStanding = findTeamStanding(standings, game.away.id)
    const homeStanding = findTeamStanding(standings, game.home.id)

    if (!awayStanding || !homeStanding) {
      return c.res({
        image: 'https://placehold.co/1000x1000/png?text=Team+Data+Not+Available',
        imageAspectRatio: '1:1',
        intents: [
          <Button action={`/games/${index}`}>Back to Game</Button>,
          <Button action="/">Back to Start</Button>
        ]
      })
    }

    const formatRecord = (win: number, loss: number) => `${win}-${loss}`
    const formatWinPercentage = (winP: number) => `${(winP * 100).toFixed(1)}%`
    const formatRank = (rank: number | undefined) => rank?.toString() || 'N/A'

    const comparisonText = `
${game.away.name.padEnd(20)}${game.home.name}

Record : ${formatRecord(awayStanding.win, awayStanding.loss).padStart(14)} ${formatRecord(homeStanding.win, homeStanding.loss).padStart(15)}
Win % : ${formatWinPercentage(awayStanding.win_p).padStart(14)} ${formatWinPercentage(homeStanding.win_p).padStart(15)}
Streak : ${awayStanding.streak.padStart(14)} ${homeStanding.streak.padStart(15)}
Last 10: ${`${awayStanding.last_10_won}-${awayStanding.last_10_lost}`.padStart(14)} ${`${homeStanding.last_10_won}-${homeStanding.last_10_lost}`.padStart(15)}
Streak : ${awayStanding.streak.padStart(14)} ${homeStanding.streak.padStart(15)}
LgRank : ${formatRank(awayStanding.league_rank).padStart(14)} ${formatRank(homeStanding.league_rank).padStart(15)}
DivRank: ${formatRank(awayStanding.division_rank).padStart(14)} ${formatRank(homeStanding.division_rank).padStart(15)}
GB : ${awayStanding.games_back.toString().padStart(14)} ${homeStanding.games_back.toString().padStart(15)}
`

    return c.res({
      image: `https://placehold.co/1000x1000/png?text=${encodeURIComponent(comparisonText)}`,
      imageAspectRatio: '1:1',
      intents: [
        <Button action={`/games/${index}`}>Back to Game</Button>,
        <Button action="/">Back to Start</Button>
      ],
    })
  } catch (error) {
    console.error('Error in comparison frame:', error)
    return c.res({
      image: 'https://placehold.co/1000x1000/png?text=Error+Occurred',
      imageAspectRatio: '1:1',
      intents: [
        <Button action="/">Back to Start</Button>
      ]
    })
  }
})

const isProduction = process.env.NODE_ENV === 'production'
devtools(app, isProduction ? { assetsPath: '/.frog' } : { serveStatic })

export const GET = handle(app)
export const POST = handle(app)