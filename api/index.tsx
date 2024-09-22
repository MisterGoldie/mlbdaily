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
        last_10_lost: team.last_10_lost
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

app.frame('/', async (c) => {
  console.log('Root frame called')
  try {
    const games = await fetchMLBSchedule()

    if (!games || games.length === 0) {
      return c.res({
        image: 'https://placehold.co/600x400/png?text=No+MLB+Games+Today',
        intents: [
          <Button>Refresh</Button>
        ]
      })
    }

    return c.res({
      image: `https://placehold.co/600x400/png?text=${encodeURIComponent(`MLB Schedule\n${games.length} Games Today`)}`,
      intents: [
        <Button action="/games/0">View Games</Button>,
      ],
    })
  } catch (error) {
    console.error('Error in root frame:', error)
    return c.res({
      image: 'https://placehold.co/600x400/png?text=Error+Occurred',
      intents: [
        <Button>Refresh</Button>
      ]
    })
  }
})

app.frame('/games/:index', async (c) => {
  console.log('Game frame called with index:', c.req.param('index'))
  try {
    const [games, standings] = await Promise.all([fetchMLBSchedule(), fetchStandings()])
    
    if (!games || games.length === 0 || !standings) {
      return c.res({
        image: 'https://placehold.co/600x400/png?text=No+Data+Available',
        intents: [
          <Button action="/">Back to Start</Button>
        ]
      })
    }

    const index = parseInt(c.req.param('index'))
    const game = games[index]

    if (!game) {
      return c.res({
        image: 'https://placehold.co/600x400/png?text=Game+Not+Found',
        intents: [
          <Button action="/">Back to Start</Button>
        ]
      })
    }

    const gameTime = new Date(game.scheduled).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'America/New_York'
    })

    let statusInfo = game.status === 'scheduled' ? `${gameTime} ET` : 
                     game.status === 'inprogress' ? `In Progress\nInning: ${game.inning_half || ''} ${game.inning || ''}\nScore: ${game.away_score || 0}-${game.home_score || 0}` :
                     `Final: ${game.away_score || 0}-${game.home_score || 0}`

    const awayStanding = findTeamStanding(standings, game.away.id)
    const homeStanding = findTeamStanding(standings, game.home.id)

    const awayRecord = awayStanding ? `${awayStanding.win}-${awayStanding.loss}` : 'N/A'
    const homeRecord = homeStanding ? `${homeStanding.win}-${homeStanding.loss}` : 'N/A'

    const imageText = `${game.away.name} (${awayRecord}) @ ${game.home.name} (${homeRecord})\n${statusInfo}\nGame ${index + 1} of ${games.length}`

    return c.res({
      image: `https://placehold.co/600x400/png?text=${encodeURIComponent(imageText)}`,
      intents: [
        <Button action={`/comparison/${index}`}>Team Comparison</Button>,
        index > 0 && <Button action={`/games/${index - 1}`}>Previous</Button>,
        index < games.length - 1 && <Button action={`/games/${index + 1}`}>Next</Button>,
        <Button action="/">Back to Start</Button>,
      ].filter(Boolean),
    })
  } catch (error) {
    console.error('Error in game frame:', error)
    return c.res({
      image: 'https://placehold.co/600x400/png?text=Error+Occurred',
      intents: [
        <Button action="/">Back to Start</Button>
      ]
    })
  }
})

app.frame('/comparison/:index', async (c) => {
  console.log('Comparison frame called with index:', c.req.param('index'))
  try {
    const [games, standings] = await Promise.all([fetchMLBSchedule(), fetchStandings()])
    
    if (!games || games.length === 0 || !standings) {
      return c.res({
        image: 'https://placehold.co/600x400/png?text=No+Data+Available',
        intents: [
          <Button action="/">Back to Start</Button>
        ]
      })
    }

    const index = parseInt(c.req.param('index'))
    const game = games[index]

    if (!game) {
      return c.res({
        image: 'https://placehold.co/600x400/png?text=Game+Not+Found',
        intents: [
          <Button action="/">Back to Start</Button>
        ]
      })
    }

    const awayStanding = findTeamStanding(standings, game.away.id)
    const homeStanding = findTeamStanding(standings, game.home.id)

    if (!awayStanding || !homeStanding) {
      return c.res({
        image: 'https://placehold.co/600x400/png?text=Team+Data+Not+Available',
        intents: [
          <Button action={`/games/${index}`}>Back to Game</Button>,
          <Button action="/">Back to Start</Button>
        ]
      })
    }

    const comparisonText = `${game.away.name} vs ${game.home.name}\n` +
      `Record: ${awayStanding.win}-${awayStanding.loss} vs ${homeStanding.win}-${homeStanding.loss}\n` +
      `Win %: ${awayStanding.win_p.toFixed(3)} vs ${homeStanding.win_p.toFixed(3)}\n` +
      `Games Back: ${awayStanding.games_back} vs ${homeStanding.games_back}\n` +
      `Streak: ${awayStanding.streak} vs ${homeStanding.streak}\n` +
      `Last 10: ${awayStanding.last_10_won}-${awayStanding.last_10_lost} vs ${homeStanding.last_10_won}-${homeStanding.last_10_lost}`

    return c.res({
      image: `https://placehold.co/600x400/png?text=${encodeURIComponent(comparisonText)}`,
      intents: [
        <Button action={`/games/${index}`}>Back to Game</Button>,
        <Button action="/">Back to Start</Button>
      ],
    })
  } catch (error) {
    console.error('Error in comparison frame:', error)
    return c.res({
      image: 'https://placehold.co/600x400/png?text=Error+Occurred',
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