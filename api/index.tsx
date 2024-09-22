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
const BACKGROUND_IMAGE = 'https://bafybeibowmohuk5b6xmxyh6mikmk2zo7y56nz2yaowknf6lgaq5xkqqnpm.ipfs.w3s.link/Frame%2060%20(1).png'

interface Game {
  id: string;
  away: { name: string; id: string };
  home: { name: string; id: string };
  scheduled: string;
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

const baseStyles = {
  backgroundImage: `url(${BACKGROUND_IMAGE})`,
  backgroundSize: 'cover',
  width: '100%',
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  alignItems: 'center',
  color: 'white',
  fontSize: 32,
  fontWeight: 'bold',
  textAlign: 'center',
}

app.frame('/', async (c) => {
  console.log('Root frame called')
  try {
    const games = await fetchMLBSchedule()

    if (!games || games.length === 0) {
      return c.res({
        image: (
          <div style={baseStyles}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div>No MLB Games Today</div>
            </div>
          </div>
        ),
        intents: [
          <Button>Refresh</Button>
        ]
      })
    }

    return c.res({
      image: (
        <div style={baseStyles}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div>MLB Schedule</div>
            <div>{games.length} Games Today</div>
          </div>
        </div>
      ),
      intents: [
        <Button action="/games/0">View Games</Button>,
      ],
    })
  } catch (error) {
    console.error('Error in root frame:', error)
    return c.res({
      image: (
        <div style={baseStyles}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div>Error Occurred</div>
          </div>
        </div>
      ),
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
        image: (
          <div style={baseStyles}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div>No MLB Games Today</div>
            </div>
          </div>
        ),
        intents: [
          <Button action="/">Back to Start</Button>
        ]
      })
    }

    const index = parseInt(c.req.param('index'))
    const game = games[index]

    const gameTime = new Date(game.scheduled).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'America/New_York'
    })

    return c.res({
      image: (
        <div style={baseStyles}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div>{game.away.name} @ {game.home.name}</div>
            <div>{gameTime} ET</div>
            <div>Game {index + 1} of {games.length}</div>
          </div>
        </div>
      ),
      intents: [
        index > 0 && <Button action={`/games/${index - 1}`}>Previous</Button>,
        index < games.length - 1 && <Button action={`/games/${index + 1}`}>Next</Button>,
        <Button action="/">Back to Start</Button>,
      ].filter(Boolean),
    })
  } catch (error) {
    console.error('Error in game frame:', error)
    return c.res({
      image: (
        <div style={baseStyles}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div>Error Occurred</div>
          </div>
        </div>
      ),
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