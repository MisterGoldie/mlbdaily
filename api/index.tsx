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
  id: string;
  wins: number;
  losses: number;
}

async function fetchMLBSchedule(): Promise<Game[] | null> {
  const date = new Date().toISOString().split('T')[0].replace(/-/g, '/')
  const apiUrl = `https://api.sportradar.com/mlb/trial/v7/en/games/${date}/schedule.json?api_key=${API_KEY}`

  try {
    const response = await fetch(apiUrl)
    const data = await response.json()
    return data.games
  } catch (error) {
    console.error('Error fetching schedule:', error)
    return null
  }
}

async function fetchStandings(): Promise<{[key: string]: TeamStanding}> {
  const apiUrl = `https://api.sportradar.us/mlb/trial/v7/en/seasons/2024/REG/standings.json?api_key=${API_KEY}`

  try {
    const response = await fetch(apiUrl)
    const data = await response.json()
    const standings: {[key: string]: TeamStanding} = {}
    data.leagues.forEach((league: any) => {
      league.divisions.forEach((division: any) => {
        division.teams.forEach((team: any) => {
          standings[team.id] = {
            id: team.id,
            wins: team.win,
            losses: team.loss
          }
        })
      })
    })
    return standings
  } catch (error) {
    console.error('Error fetching standings:', error)
    return {}
  }
}

async function fetchTeamLogos(): Promise<{[key: string]: string}> {
  const apiUrl = `https://api.sportradar.com/mlb-images-t3/ap/logos/manifest.json?api_key=${API_KEY}`

  try {
    const response = await fetch(apiUrl)
    const data = await response.json()
    const logos: {[key: string]: string} = {}
    data.assetlist.forEach((asset: any) => {
      if (asset.type === 'primary') {
        logos[asset.team_id] = `https://api.sportradar.com/mlb-images-t3/ap${asset.links[1].href}`
      }
    })
    return logos
  } catch (error) {
    console.error('Error fetching team logos:', error)
    return {}
  }
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
    const [games, standings, logos] = await Promise.all([fetchMLBSchedule(), fetchStandings(), fetchTeamLogos()])
    if (!games || games.length === 0) {
      return c.res({
        image: 'https://placehold.co/600x400/png?text=No+MLB+Games+Today',
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

    const awayStanding = standings[game.away.id]
    const homeStanding = standings[game.home.id]

    let statusInfo = game.status === 'scheduled' ? `${gameTime} ET` : 
                     game.status === 'inprogress' ? `In Progress\nInning: ${game.inning_half || ''} ${game.inning || ''}\nScore: ${game.away_score || 0}-${game.home_score || 0}` :
                     `Final: ${game.away_score || 0}-${game.home_score || 0}`

    const awayRecord = awayStanding ? `(${awayStanding.wins}-${awayStanding.losses})` : '(0-0)'
    const homeRecord = homeStanding ? `(${homeStanding.wins}-${homeStanding.losses})` : '(0-0)'

    const awayLogo = logos[game.away.id] || ''
    const homeLogo = logos[game.home.id] || ''

    const imageText = `${game.away.name} ${awayRecord} @ ${game.home.name} ${homeRecord}\n${statusInfo}\nGame ${index + 1} of ${games.length}\nAway Logo: ${awayLogo}\nHome Logo: ${homeLogo}`

    return c.res({
      image: `https://placehold.co/600x400/png?text=${encodeURIComponent(imageText)}`,
      intents: [
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

const isProduction = process.env.NODE_ENV === 'production'
devtools(app, isProduction ? { assetsPath: '/.frog' } : { serveStatic })

export const GET = handle(app)
export const POST = handle(app)