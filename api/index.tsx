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
  away: { name: string; id: string };
  home: { name: string; id: string };
  scheduled: string;
}

interface TeamProfile {
  id: string;
  name: string;
  logo_url?: string; // Assuming the API provides this
}

const teamProfileCache: { [key: string]: TeamProfile } = {}

async function fetchTeamProfile(teamId: string): Promise<TeamProfile> {
  if (teamProfileCache[teamId]) {
    return teamProfileCache[teamId]
  }

  const apiUrl = `https://api.sportradar.com/mlb/trial/v7/en/teams/${teamId}/profile.json?api_key=${API_KEY}`
  
  try {
    const response = await fetch(apiUrl)
    const data = await response.json()
    const profile: TeamProfile = {
      id: data.id,
      name: data.name,
      logo_url: data.logo_url // Adjust this based on actual API response
    }
    teamProfileCache[teamId] = profile
    return profile
  } catch (error) {
    console.error('Error fetching team profile:', error)
    return { id: teamId, name: 'Unknown Team' }
  }
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
    const games = await fetchMLBSchedule()
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

    const [awayTeam, homeTeam] = await Promise.all([
      fetchTeamProfile(game.away.id),
      fetchTeamProfile(game.home.id)
    ])

    const gameTime = new Date(game.scheduled).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'America/New_York'
    })

    // Note: You'd need to implement an actual image generation service
    return c.res({
      image: `https://api.yourservice.com/generate-image?awayTeam=${awayTeam.name}&homeTeam=${homeTeam.name}&awayLogo=${awayTeam.logo_url || ''}&homeLogo=${homeTeam.logo_url || ''}&gameTime=${gameTime}&gameNumber=${index + 1}&totalGames=${games.length}`,
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